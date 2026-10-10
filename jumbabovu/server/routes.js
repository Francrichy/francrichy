import {Router} from 'express'; import bcrypt from 'bcryptjs'; import jwt from 'jsonwebtoken'; import {q} from './db.js'; import crypto from 'crypto'; import * as pesapal from './pesapal.js'; import {sendMail} from './mail.js'; import {notify} from './realtime.js'; import {settings,charges} from './fees.js'; import {autoRelease} from './jobs.js';
const r=Router(); const S=process.env.JWT_SECRET||'dev-secret';
const wrap=f=>(req,res)=>f(req,res).catch(e=>{console.error(e);res.status(500).json({error:'Server error'})});
const auth=(...roles)=>(req,res,next)=>{try{const u=jwt.verify((req.headers.authorization||'').slice(7),S);if(roles.length&&!roles.includes(u.role))return res.status(403).json({error:'Not allowed for your role'});req.user=u;next()}catch{res.status(401).json({error:'Please log in'})}};
const tok=u=>({token:jwt.sign(u,S,{expiresIn:'7d'}),user:u});
const myExporter=async uid=>(await q('SELECT id FROM exporters WHERE user_id=$1',[uid]))[0];

// Auth
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const mailOk=async(req,res,next)=>{const[u]=await q('SELECT email_verified FROM users WHERE id=$1',[req.user.id]);u?.email_verified?next():res.status(403).json({error:'Please verify your email first. Check your inbox for the link.'})};
const mailVerify=async(id,email)=>{const t=crypto.randomBytes(32).toString('hex');await q('UPDATE users SET email_token_hash=$2 WHERE id=$1',[id,sha(t)]);await sendMail(email,'Verify your jumbabovu email',`Welcome to jumbabovu.\n\nConfirm your email address: ${process.env.APP_URL||''}/verify-email?token=${t}\n\nIf you did not register, ignore this message.`).catch(console.error)};
r.post('/auth/register',wrap(async(req,res)=>{
  const{email,password,name,role,company,city,phone,country,accept_terms}=req.body;
  if(!email||!password||password.length<8||!['buyer','exporter'].includes(role))return res.status(400).json({error:'Enter an email, choose a role, and use a password of 8 or more characters'});
  if(!accept_terms)return res.status(400).json({error:'Please accept the Terms to continue'});
  if(!company||!phone||!country)return res.status(400).json({error:'Company name, country and phone are required'});
  const[u]=await q("INSERT INTO users(email,password_hash,role,name,phone,country,company,terms_accepted_at) VALUES(lower($1),$2,$3,$4,$5,$6,$7,now()) ON CONFLICT DO NOTHING RETURNING id,email,role,name,email_verified",[email,await bcrypt.hash(password,10),role,name||company,phone,country,company]);
  if(!u)return res.status(409).json({error:'This email is already registered'});
  if(role==='exporter')await q('INSERT INTO exporters(user_id,company_name,city,phone) VALUES($1,$2,$3,$4)',[u.id,company,city,phone]);
  await mailVerify(u.id,u.email);res.json(tok(u));
}));
r.post('/auth/login',wrap(async(req,res)=>{
  const[u]=await q('SELECT * FROM users WHERE email=lower($1)',[req.body.email||'']);
  if(!u||!(await bcrypt.compare(req.body.password||'',u.password_hash)))return res.status(401).json({error:'Wrong email or password'});
  res.json(tok({id:u.id,email:u.email,role:u.role,name:u.name,email_verified:u.email_verified}));
}));
r.get('/auth/me',auth(),wrap(async(req,res)=>{const[u]=await q('SELECT id,email,role,name,email_verified FROM users WHERE id=$1',[req.user.id]);u?res.json(u):res.status(401).json({error:'Please log in'})}));
r.post('/auth/verify-email',wrap(async(req,res)=>{
  const[u]=await q('UPDATE users SET email_verified=true,email_token_hash=NULL WHERE email_token_hash=$1 RETURNING id',[sha(String(req.body.token||''))]);
  u?res.json({ok:true}):res.status(400).json({error:'This link is invalid or was already used'});
}));
r.post('/auth/resend-verification',auth(),wrap(async(req,res)=>{
  const[u]=await q('SELECT email,email_verified FROM users WHERE id=$1',[req.user.id]);
  if(u.email_verified)return res.status(400).json({error:'Your email is already verified'});
  await mailVerify(req.user.id,u.email);res.json({ok:true});
}));
r.post('/auth/forgot',wrap(async(req,res)=>{
  const[u]=await q('SELECT id,email FROM users WHERE email=lower($1)',[req.body.email||'']);
  if(u){const t=crypto.randomBytes(32).toString('hex');await q("UPDATE users SET reset_token_hash=$2,reset_expires=now()+interval '1 hour' WHERE id=$1",[u.id,sha(t)]);
    await sendMail(u.email,'Reset your jumbabovu password',`Reset your password (valid for 1 hour): ${process.env.APP_URL||''}/reset-password?token=${t}\n\nIf you did not ask for this, ignore this message.`).catch(console.error)}
  res.json({ok:true});
}));
r.post('/auth/reset',wrap(async(req,res)=>{
  if(String(req.body.password||'').length<8)return res.status(400).json({error:'Use a password of 8 or more characters'});
  const[u]=await q('UPDATE users SET password_hash=$2,reset_token_hash=NULL,reset_expires=NULL WHERE reset_token_hash=$1 AND reset_expires>now() RETURNING id',[sha(String(req.body.token||'')),await bcrypt.hash(req.body.password,10)]);
  u?res.json({ok:true}):res.status(400).json({error:'This link is invalid or has expired'});
}));

// Catalogue
r.get('/categories',wrap(async(_,res)=>res.json(await q('SELECT * FROM categories ORDER BY id'))));
r.get('/products',wrap(async(req,res)=>{
  const{q:s='',category}=req.query;
  res.json(await q(`SELECT p.*,c.name category,e.company_name,e.verified FROM products p JOIN exporters e ON e.id=p.exporter_id LEFT JOIN categories c ON c.id=p.category_id
   WHERE p.status='active' AND ($1='' OR p.name ILIKE '%'||$1||'%') AND ($2::int IS NULL OR p.category_id=$2::int) ORDER BY e.verified DESC,p.id DESC`,[s,category||null]));
}));
r.get('/products/:id',wrap(async(req,res)=>{
  const[p]=await q(`SELECT p.*,c.name category,e.company_name,e.verified,e.city FROM products p JOIN exporters e ON e.id=p.exporter_id LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=$1`,[req.params.id]);
  p?res.json(p):res.status(404).json({error:'Product not found'});
}));
r.post('/products',auth('exporter'),mailOk,wrap(async(req,res)=>{
  const e=await myExporter(req.user.id);const b=req.body;
  if(!b.name)return res.status(400).json({error:'Product name is required'});
  const[p]=await q('INSERT INTO products(exporter_id,category_id,name,description,moq,capacity,origin,packaging,image_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[e.id,b.category_id||null,b.name,b.description,b.moq,b.capacity,b.origin,b.packaging,b.image_url]);
  res.json(p);
}));
r.get('/exporters',wrap(async(_,res)=>res.json(await q('SELECT e.*,(SELECT count(*)::int FROM products WHERE exporter_id=e.id) products,(SELECT round(avg(rating),1)::float FROM reviews WHERE exporter_id=e.id) rating FROM exporters e ORDER BY verified DESC,id DESC'))));
r.get('/exporters/:id',wrap(async(req,res)=>{
  const[e]=await q('SELECT * FROM exporters WHERE id=$1',[req.params.id]);
  if(!e)return res.status(404).json({error:'Exporter not found'});
  res.json({...e,rating:(await q('SELECT round(avg(rating),1)::float a,count(*)::int n FROM reviews WHERE exporter_id=$1',[e.id]))[0],reviews:await q('SELECT rv.rating,rv.comment,u.name buyer_name FROM reviews rv JOIN users u ON u.id=rv.buyer_id WHERE rv.exporter_id=$1 ORDER BY rv.id DESC LIMIT 20',[e.id]),products:await q("SELECT p.*,c.name category FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE exporter_id=$1 AND status='active'",[e.id])});
}));
r.patch('/exporters/:id/verify',auth('admin'),wrap(async(req,res)=>res.json((await q('UPDATE exporters SET verified=$2 WHERE id=$1 RETURNING *',[req.params.id,!!req.body.verified]))[0])));

// RFQs and quotations
r.post('/rfqs',auth('buyer'),mailOk,wrap(async(req,res)=>{
  const b=req.body;const[p]=await q('SELECT exporter_id FROM products WHERE id=$1',[b.product_id]);
  if(!p||!b.quantity)return res.status(400).json({error:'Choose a product and enter a quantity'});
  const[row]=await q('INSERT INTO rfqs(buyer_id,exporter_id,product_id,quantity,destination,target_price,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[req.user.id,p.exporter_id,b.product_id,b.quantity,b.destination,b.target_price,b.notes]);
  const[ex]=await q('SELECT user_id FROM exporters WHERE id=$1',[p.exporter_id]);await notify(ex.user_id,'rfq','New quote request received','/dashboard');res.json(row);
}));
r.get('/rfqs',auth('buyer','exporter'),wrap(async(req,res)=>{
  const buyer=req.user.role==='buyer';const e=buyer?null:await myExporter(req.user.id);
  res.json(await q(`SELECT r.*,p.name product,u.name buyer_name,ex.company_name FROM rfqs r JOIN products p ON p.id=r.product_id JOIN users u ON u.id=r.buyer_id JOIN exporters ex ON ex.id=r.exporter_id
   WHERE ${buyer?'r.buyer_id':'r.exporter_id'}=$1 ORDER BY r.id DESC`,[buyer?req.user.id:e.id]));
}));
r.post('/rfqs/:id/quotations',auth('exporter'),mailOk,wrap(async(req,res)=>{
  const e=await myExporter(req.user.id);const[rfq]=await q('SELECT id FROM rfqs WHERE id=$1 AND exporter_id=$2',[req.params.id,e.id]);
  if(!rfq)return res.status(404).json({error:'RFQ not found'});
  if(!(await q('SELECT payout_account_no FROM exporters WHERE id=$1',[e.id]))[0].payout_account_no)return res.status(400).json({error:'Add your payout account in your dashboard before sending quotations'});
  const b=req.body;if(!b.unit_price||!b.quantity||!(+b.total_amount>0))return res.status(400).json({error:'Unit price, quantity and total amount (TZS) are required'});
  if(!(await q('SELECT 1 FROM currencies WHERE code=$1 AND active',[b.currency||'TZS'])).length)return res.status(400).json({error:'Choose an available currency'});
  const[row]=await q('INSERT INTO quotations(rfq_id,unit_price,quantity,delivery_terms,valid_until,notes,total_amount,currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[rfq.id,b.unit_price,b.quantity,b.delivery_terms,b.valid_until||null,b.notes,b.total_amount,b.currency||'TZS']);
  const[bu]=await q('SELECT buyer_id FROM rfqs WHERE id=$1',[rfq.id]);await notify(bu.buyer_id,'quotation','You received a new quotation','/dashboard');res.json(row);
}));
r.get('/quotations',auth('buyer','exporter'),wrap(async(req,res)=>{
  const buyer=req.user.role==='buyer';const e=buyer?null:await myExporter(req.user.id);
  res.json(await q(`SELECT qt.*,p.name product,ex.company_name FROM quotations qt JOIN rfqs r ON r.id=qt.rfq_id JOIN products p ON p.id=r.product_id JOIN exporters ex ON ex.id=r.exporter_id
   WHERE ${buyer?'r.buyer_id':'r.exporter_id'}=$1 ORDER BY qt.id DESC`,[buyer?req.user.id:e.id]));
}));
r.patch('/quotations/:id',auth('buyer'),wrap(async(req,res)=>{
  if(!['accepted','rejected'].includes(req.body.status))return res.status(400).json({error:'Invalid status'});
  const[x]=await q('UPDATE quotations SET status=$2 WHERE id=$1 AND rfq_id IN(SELECT id FROM rfqs WHERE buyer_id=$3) AND status=\'sent\' RETURNING *',[req.params.id,req.body.status,req.user.id]);
  if(!x)return res.status(404).json({error:'Quotation not found or already answered'});
  const[ex]=await q('SELECT e.user_id FROM rfqs r JOIN exporters e ON e.id=r.exporter_id WHERE r.id=$1',[x.rfq_id]);await notify(ex.user_id,'quotation',`Your quotation was ${x.status}`,'/dashboard');
  if(x.status==='accepted'){
    const[o]=await q(`INSERT INTO orders(quotation_id,buyer_id,exporter_id,product_id,quantity,unit_price,amount,currency) SELECT qt.id,r.buyer_id,r.exporter_id,r.product_id,qt.quantity,qt.unit_price,qt.total_amount,qt.currency FROM quotations qt JOIN rfqs r ON r.id=qt.rfq_id WHERE qt.id=$1 ON CONFLICT(quotation_id) DO NOTHING RETURNING id`,[x.id]);
    if(o){const[n]=await q("UPDATE orders SET order_no='JB-'||to_char(now(),'YYMM')||'-'||lpad(id::text,4,'0') WHERE id=$1 RETURNING order_no",[o.id]);await notify(ex.user_id,'order',`Order ${n.order_no} was created`,'/orders')}
  }
  res.json(x);
}));

// Orders, escrow (funds held in the jumbabovu escrow bank account), disputes and reviews
const uidOf=async eid=>(await q('SELECT user_id FROM exporters WHERE id=$1',[eid]))[0].user_id;
const admins=async()=>(await q("SELECT id FROM users WHERE role='admin'")).map(a=>a.id);
const ev=(oid,event,actor,note)=>q('INSERT INTO escrow_events(order_id,event,actor_id,note) VALUES($1,$2,$3,$4)',[oid,event,actor,note||null]);
const done=async(res,o,text,...to)=>{
  if(!o)return res.status(409).json({error:'This step is not available for this order'});
  for(const t of to)await notify(t,'order',`${text} (${o.order_no})`,'/orders');
  res.json(o);
};
r.get('/escrow/info',auth(),(req,res)=>res.json({bank:process.env.ESCROW_BANK_NAME||'',account_name:process.env.ESCROW_ACCOUNT_NAME||'',account_no:process.env.ESCROW_ACCOUNT_NO||'',note:process.env.ESCROW_NOTE||'',online:{enabled:pesapal.enabled(),currencies:pesapal.currencies()}}));
r.get('/orders',auth(),wrap(async(req,res)=>{
  const u=req.user;const e=u.role==='exporter'?await myExporter(u.id):null;
  const where=u.role==='admin'?'true':u.role==='buyer'?'o.buyer_id=$1':'o.exporter_id=$1';
  const rows=await q(`SELECT o.*,p.name product,ex.company_name,ex.payout_method,ex.payout_bank_name,ex.payout_account_name,ex.payout_account_no,bu.name buyer_name,(SELECT id FROM reviews WHERE order_id=o.id) review_id,
    (SELECT id FROM disputes WHERE order_id=o.id AND status='open') dispute_id,(SELECT reason||': '||coalesce(details,'') FROM disputes WHERE order_id=o.id AND status='open') dispute_text
    FROM orders o JOIN products p ON p.id=o.product_id JOIN exporters ex ON ex.id=o.exporter_id JOIN users bu ON bu.id=o.buyer_id WHERE ${where} ORDER BY o.id DESC`,u.role==='admin'?[]:[u.role==='buyer'?u.id:e.id]);
  if(u.role!=='admin')rows.forEach(x=>{delete x.payout_method;delete x.payout_bank_name;delete x.payout_account_name;delete x.payout_account_no});res.json(rows);
}));
const lock=(id,c)=>q('UPDATE orders SET pay_currency=$2,fx_rate=$3,goods_pay=$4,txn_fee_pay=$5,total_pay=$6,seller_fee=$7,payout_fee=$8,seller_net=$9,platform_earnings_tzs=$10 WHERE id=$1',[id,c.pay_currency,c.fx_rate,c.goods_pay,c.txn_fee_pay,c.total_pay,c.seller_fee,c.payout_fee,c.seller_net,c.platform_earnings_tzs]);
r.get('/orders/:id/charges',auth('buyer'),wrap(async(req,res)=>{
  const[o]=await q('SELECT amount,currency FROM orders WHERE id=$1 AND buyer_id=$2',[req.params.id,req.user.id]);
  if(!o)return res.status(404).json({error:'Order not found'});
  try{const c=await charges(+o.amount,o.currency,req.query.currency||o.currency);res.json({pay_currency:c.pay_currency,fx_rate:c.fx_rate,goods_pay:c.goods_pay,txn_fee_pay:c.txn_fee_pay,total_pay:c.total_pay})}catch(e){res.status(400).json({error:e.message})}
}));
r.post('/orders/:id/paid',auth('buyer'),mailOk,wrap(async(req,res)=>{
  const[ord]=await q("SELECT * FROM orders WHERE id=$1 AND buyer_id=$2 AND payment_status='awaiting_deposit'",[req.params.id,req.user.id]);
  if(!ord)return done(res,null);
  let c;try{c=await charges(+ord.amount,ord.currency,req.body.pay_currency||ord.currency)}catch(e){return res.status(400).json({error:e.message})}
  await lock(ord.id,c);
  const[o]=await q("UPDATE orders SET payment_status='deposit_reported',deposit_ref=$2 WHERE id=$1 RETURNING *",[ord.id,String(req.body.reference||'').slice(0,100)]);
  await ev(o.id,'buyer_reported_payment',req.user.id,o.deposit_ref);
  await done(res,o,'Buyer reported an escrow payment, please verify it',...await admins());
}));
r.post('/orders/:id/confirm-funds',auth('admin'),wrap(async(req,res)=>{
  const[ord]=await q("SELECT * FROM orders WHERE id=$1 AND payment_status IN('awaiting_deposit','deposit_reported')",[req.params.id]);
  if(ord&&ord.total_pay==null){try{await lock(ord.id,await charges(+ord.amount,ord.currency,ord.currency))}catch(e){return res.status(400).json({error:e.message})}}
  const[o]=await q("UPDATE orders SET payment_status='funds_held',status='production' WHERE id=$1 AND payment_status IN('awaiting_deposit','deposit_reported') RETURNING *",[req.params.id]);
  if(o)await ev(o.id,'funds_confirmed_in_escrow',req.user.id);
  await done(res,o,'Payment received and held in escrow. The exporter can start production',o?.buyer_id,o&&await uidOf(o.exporter_id));
}));
r.post('/orders/:id/advance',auth('exporter'),wrap(async(req,res)=>{
  const e=await myExporter(req.user.id);
  const[o]=await q("UPDATE orders SET status=CASE status WHEN 'production' THEN 'ready' ELSE 'shipped' END,shipped_at=CASE WHEN status='ready' THEN now() ELSE shipped_at END WHERE id=$1 AND exporter_id=$2 AND status IN('production','ready') AND payment_status='funds_held' RETURNING *",[req.params.id,e.id]);
  if(o)await ev(o.id,'status_'+o.status,req.user.id);
  await done(res,o,`Order status is now ${o?.status}`,o?.buyer_id);
}));
r.post('/orders/:id/received',auth('buyer'),wrap(async(req,res)=>{
  const[o]=await q("UPDATE orders SET status='delivered',payment_status='awaiting_release' WHERE id=$1 AND buyer_id=$2 AND status='shipped' AND payment_status='funds_held' RETURNING *",[req.params.id,req.user.id]);
  if(o)await ev(o.id,'buyer_confirmed_delivery',req.user.id);
  await done(res,o,'Buyer confirmed goods received. Release is next',o&&await uidOf(o.exporter_id),...(o?await admins():[]));
  if(o)await autoRelease().catch(console.error);
}));
r.post('/orders/:id/release',auth('admin'),wrap(async(req,res)=>{
  const[o]=await q("UPDATE orders SET payment_status='released',status='completed' WHERE id=$1 AND payment_status='awaiting_release' RETURNING *",[req.params.id]);
  if(o)await ev(o.id,'release_approved',req.user.id);
  await done(res,o,'Escrow released. Your payout is being processed',o?.buyer_id,o&&await uidOf(o.exporter_id));
}));
r.post('/orders/:id/payout',auth('admin'),wrap(async(req,res)=>{
  const ref=String(req.body.reference||'').trim().slice(0,100);if(!ref)return res.status(400).json({error:'Enter the bank or mobile money reference'});
  const[o]=await q("UPDATE orders SET payout_ref=$2 WHERE id=$1 AND payment_status IN('released','partially_settled','refunded') AND payout_ref IS NULL RETURNING *",[req.params.id,ref]);
  if(o)await ev(o.id,'money_sent',req.user.id,ref);
  await done(res,o,'The money was sent out (ref '+ref+')',o?.buyer_id,o&&await uidOf(o.exporter_id));
}));
r.post('/orders/:id/dispute',auth('buyer'),wrap(async(req,res)=>{
  const{reason,details}=req.body;
  if(!['Wrong Product','Quantity Issue','Quality Issue','Shipment Issue','Other'].includes(reason))return res.status(400).json({error:'Choose a reason'});
  const[o]=await q("UPDATE orders SET payment_status='disputed' WHERE id=$1 AND buyer_id=$2 AND payment_status IN('funds_held','awaiting_release') RETURNING *",[req.params.id,req.user.id]);
  if(o){await q('INSERT INTO disputes(order_id,buyer_id,reason,details) VALUES($1,$2,$3,$4)',[o.id,req.user.id,reason,String(details||'').slice(0,2000)]);await ev(o.id,'dispute_opened',req.user.id,reason)}
  await done(res,o,'A dispute was opened and the escrow funds are frozen',o&&await uidOf(o.exporter_id),...(o?await admins():[]));
}));
r.post('/disputes/:id/resolve',auth('admin'),wrap(async(req,res)=>{
  const{decision,note}=req.body;const m={release:['released','completed'],refund:['refunded','cancelled'],partial:['partially_settled','completed']}[decision];
  if(!m)return res.status(400).json({error:'Choose a decision'});
  const[d]=await q("UPDATE disputes SET status='resolved',decision=$2,note=$3,resolved_at=now() WHERE id=$1 AND status='open' RETURNING *",[req.params.id,decision,note||null]);
  if(!d)return res.status(409).json({error:'This dispute is already resolved'});
  const[o]=await q('UPDATE orders SET payment_status=$2,status=$3 WHERE id=$1 RETURNING *',[d.order_id,m[0],m[1]]);
  await ev(o.id,'dispute_'+decision,req.user.id,note);
  await done(res,o,`Dispute decided: ${decision}`,o.buyer_id,await uidOf(o.exporter_id));
}));
r.post('/reviews',auth('buyer'),wrap(async(req,res)=>{
  const{order_id,rating,comment}=req.body;
  if(!(rating>=1&&rating<=5))return res.status(400).json({error:'Choose a rating from 1 to 5'});
  const[o]=await q("SELECT * FROM orders WHERE id=$1 AND buyer_id=$2 AND status IN('delivered','completed')",[order_id,req.user.id]);
  if(!o)return res.status(400).json({error:'You can review an order after delivery'});
  const[v]=await q('INSERT INTO reviews(order_id,buyer_id,exporter_id,rating,comment) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING *',[o.id,req.user.id,o.exporter_id,rating,String(comment||'').slice(0,1000)]);
  if(!v)return res.status(409).json({error:'You already reviewed this order'});
  await notify(await uidOf(o.exporter_id),'review',`New ${rating}-star review`,'/dashboard');res.json(v);
}));

// Pesapal online payment. Never trust the browser or the IPN query: always confirm with Pesapal's status API.
const applyPesapal=async tracking=>{
  if(!tracking)return null;
  const st=await pesapal.status(tracking);
  const[ord]=await q('SELECT * FROM orders WHERE pesapal_tracking_id=$1',[tracking]);
  if(!ord)return applyVerification(tracking,st);
  if(st.status_code===1){
    if(st.currency!==ord.pay_currency||Number(st.amount)+0.01<Number(ord.total_pay)){
      for(const a of await admins())await notify(a,'order',`Pesapal payment for ${ord.order_no} does not match the amount due. Please review`,'/orders');
      return ord;
    }
    const[o]=await q("UPDATE orders SET payment_status='funds_held',status='production' WHERE id=$1 AND payment_status IN('awaiting_deposit','deposit_reported') RETURNING *",[ord.id]);
    if(o){await ev(o.id,'funds_confirmed_pesapal',null,tracking);
      await notify(o.buyer_id,'order',`Payment received and held in escrow (${o.order_no})`,'/orders');
      await notify(await uidOf(o.exporter_id),'order',`Payment received and held in escrow. You can start production (${o.order_no})`,'/orders')}
    return o||ord;
  }
  if(st.status_code===2||st.status_code===0){
    const[o]=await q("UPDATE orders SET payment_status='awaiting_deposit' WHERE id=$1 AND payment_status='deposit_reported' AND payment_method='pesapal' RETURNING *",[ord.id]);
    if(o)await notify(o.buyer_id,'order',`Your online payment did not go through. You can try again (${o.order_no})`,'/orders');
  }
  if(st.status_code===3&&ord.payment_status==='funds_held')for(const a of await admins())await notify(a,'order',`Pesapal reversed the payment for ${ord.order_no}. Please review`,'/orders');
  return ord;
};
r.post('/orders/:id/pay-online',auth('buyer'),mailOk,wrap(async(req,res)=>{
  if(!pesapal.enabled())return res.status(503).json({error:'Online payment is not set up yet'});
  const cur=req.body.currency;
  if(!pesapal.currencies().includes(cur))return res.status(400).json({error:'Online payment is available in '+pesapal.currencies().join(', ')});
  const[ord]=await q("SELECT * FROM orders WHERE id=$1 AND buyer_id=$2 AND (payment_status='awaiting_deposit' OR (payment_status='deposit_reported' AND payment_method='pesapal'))",[req.params.id,req.user.id]);
  if(!ord)return res.status(409).json({error:'This order cannot be paid online now'});
  let c;try{c=await charges(+ord.amount,ord.currency,cur)}catch(e){return res.status(400).json({error:e.message})}
  await lock(ord.id,c);
  const ref=`${ord.order_no}-${Date.now()}`;const[u]=await q('SELECT email,name FROM users WHERE id=$1',[req.user.id]);
  let d;try{d=await pesapal.submitOrder({ref,amount:c.total_pay,currency:cur,description:`jumbabovu order ${ord.order_no}`,email:u.email,name:u.name})}catch(e){console.error(e);return res.status(502).json({error:'Could not start the online payment. Please try again.'})}
  await q("UPDATE orders SET payment_method='pesapal',payment_status='deposit_reported',pesapal_tracking_id=$2,pesapal_ref=$3 WHERE id=$1",[ord.id,d.order_tracking_id,ref]);
  await ev(ord.id,'online_payment_started',req.user.id,d.order_tracking_id);
  res.json({redirect_url:d.redirect_url});
}));
r.get('/pesapal/callback',async(req,res)=>{let o;try{o=await applyPesapal(String(req.query.OrderTrackingId||''))}catch(e){console.error(e)}res.redirect(o?.kind==='verification'?'/dashboard':'/orders')});
r.get('/pesapal/ipn',async(req,res)=>{
  const{OrderTrackingId:t,OrderMerchantReference:m,OrderNotificationType:n}=req.query;
  try{await applyPesapal(String(t||''))}catch(e){console.error(e)}
  res.json({orderNotificationType:n,orderTrackingId:t,orderMerchantReference:m,status:200});
});
r.post('/orders/:id/check-payment',auth('buyer','admin'),wrap(async(req,res)=>{
  const[o]=await q('SELECT * FROM orders WHERE id=$1 AND pesapal_tracking_id IS NOT NULL AND ($2=\'admin\' OR buyer_id=$3)',[req.params.id,req.user.role,req.user.id]);
  if(!o)return res.status(404).json({error:'No online payment found for this order'});
  res.json(await applyPesapal(o.pesapal_tracking_id));
}));
r.post('/uploads/sign',auth(),(req,res)=>{
  const{CLOUDINARY_CLOUD_NAME:c,CLOUDINARY_API_KEY:k,CLOUDINARY_API_SECRET:sec}=process.env;
  if(!c||!k||!sec)return res.status(503).json({error:'File uploads are not set up yet'});
  const kind=req.body.kind,folder=kind==='doc'?'jumbabovu/docs':kind==='product'?'jumbabovu/products':'jumbabovu/chat',type=kind==='doc'?'authenticated':null,timestamp=Math.floor(Date.now()/1000);
  res.json({cloud_name:c,api_key:k,timestamp,folder,type,signature:crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${type?`&type=${type}`:''}${sec}`).digest('hex')});
});

// Seller company profile, payout account and the optional paid Verified badge
const DOCS=['brela','tin','export_license','director_id'];
const EXP_FIELDS=['city','phone','address','about','brela_no','tin_no','payout_method','payout_bank_name','payout_account_name','payout_account_no'];
const feeBank=()=>{const f=process.env.FEE_ACCOUNT_NO?'FEE':'ESCROW';return{bank:process.env[f+'_BANK_NAME']||'',account_name:process.env[f+'_ACCOUNT_NAME']||'',account_no:process.env[f+'_ACCOUNT_NO']||''}};
const getV=async eid=>(await q('SELECT * FROM verifications WHERE exporter_id=$1 ORDER BY id DESC LIMIT 1',[eid]))[0];
const activate=async vid=>{
  const[v]=await q("UPDATE verifications SET status='active',paid_at=now() WHERE id=$1 AND status IN('awaiting_payment','payment_reported') RETURNING *",[vid]);
  if(!v)return null;
  const[e]=await q("UPDATE exporters SET verified=true,verified_until=GREATEST(now(),coalesce(verified_until,now()))+interval '1 year' WHERE id=$1 RETURNING user_id,verified_until",[v.exporter_id]);
  await q('UPDATE verifications SET valid_until=$2 WHERE id=$1',[v.id,e.verified_until]);
  await notify(e.user_id,'verification','Payment received. Your Verified badge is now active','/dashboard');return v;
};
const applyVerification=async(tracking,st)=>{
  const[v]=await q('SELECT * FROM verifications WHERE pesapal_tracking_id=$1',[tracking]);if(!v)return null;
  if(st.status_code===1&&st.currency==='TZS'&&Number(st.amount)+0.01>=Number(v.fee_tzs))await activate(v.id);
  return{kind:'verification'};
};
r.get('/exporter/me',auth('exporter'),wrap(async(req,res)=>res.json((await q(`SELECT ${EXP_FIELDS.join(',')},company_name,verified,verified_until FROM exporters WHERE user_id=$1`,[req.user.id]))[0])));
r.put('/exporter/me',auth('exporter'),wrap(async(req,res)=>{
  const b=req.body;if(b.payout_method&&!['bank','mobile'].includes(b.payout_method))return res.status(400).json({error:'Choose bank or mobile money'});
  const vals=EXP_FIELDS.map(k=>String(b[k]??'').slice(0,500)||null);
  await q(`UPDATE exporters SET ${EXP_FIELDS.map((k,i)=>`${k}=$${i+2}`).join(',')} WHERE user_id=$1`,[req.user.id,...vals]);res.json({ok:true});
}));
r.get('/verification',auth('exporter'),wrap(async(req,res)=>{
  const e=await myExporter(req.user.id);const v=await getV(e.id);
  const[ex]=await q('SELECT verified,verified_until FROM exporters WHERE id=$1',[e.id]);
  res.json({verification:v||null,exporter:ex,fee:+(await settings()).verified_fee_tzs,online:pesapal.enabled(),bank:feeBank()});
}));
r.post('/verification/submit',auth('exporter'),mailOk,wrap(async(req,res)=>{
  const e=await myExporter(req.user.id);const prev=await getV(e.id);
  if(prev&&['submitted','awaiting_payment','payment_reported'].includes(prev.status))return res.status(409).json({error:'You already have an application in progress'});
  const docs=(req.body.docs||[]).filter(d=>DOCS.includes(d.doc_type)&&String(d.public_id||'').startsWith('jumbabovu/docs/'));
  if(!DOCS.every(t=>docs.some(d=>d.doc_type===t)))return res.status(400).json({error:'Please upload all four documents'});
  const[v]=await q("INSERT INTO verifications(exporter_id,status) VALUES($1,'submitted') RETURNING *",[e.id]);
  for(const d of docs)await q('INSERT INTO verification_docs(verification_id,doc_type,public_id,resource_type,format,name) VALUES($1,$2,$3,$4,$5,$6)',[v.id,d.doc_type,String(d.public_id),d.resource_type==='raw'?'raw':'image',d.format||null,String(d.name||'').slice(0,120)]);
  for(const a of await admins())await notify(a,'verification','New Verified badge application to review','/dashboard');
  res.json(v);
}));
r.post('/verification/renew',auth('exporter'),wrap(async(req,res)=>{
  const e=await myExporter(req.user.id);const v=await getV(e.id);
  if(!v||!['active','expired'].includes(v.status))return res.status(409).json({error:'Renewal is not available'});
  res.json((await q("INSERT INTO verifications(exporter_id,status,fee_tzs) VALUES($1,'awaiting_payment',$2) RETURNING *",[e.id,+(await settings()).verified_fee_tzs]))[0]);
}));
r.post('/verification/paid',auth('exporter'),wrap(async(req,res)=>{
  const e=await myExporter(req.user.id);
  const[v]=await q("UPDATE verifications SET status='payment_reported',payment_method='bank',payment_ref=$2 WHERE id=(SELECT id FROM verifications WHERE exporter_id=$1 ORDER BY id DESC LIMIT 1) AND status='awaiting_payment' RETURNING *",[e.id,String(req.body.reference||'').slice(0,100)]);
  if(!v)return res.status(409).json({error:'No fee is due right now'});
  for(const a of await admins())await notify(a,'verification','A seller reported the Verified fee payment. Please confirm it','/dashboard');res.json(v);
}));
r.post('/verification/pay-online',auth('exporter'),wrap(async(req,res)=>{
  if(!pesapal.enabled())return res.status(503).json({error:'Online payment is not set up yet'});
  const e=await myExporter(req.user.id);const v=await getV(e.id);
  if(!v||v.status!=='awaiting_payment')return res.status(409).json({error:'No fee is due right now'});
  const[u]=await q('SELECT email,name FROM users WHERE id=$1',[req.user.id]);const ref=`VER-${v.id}-${Date.now()}`;
  let d;try{d=await pesapal.submitOrder({ref,amount:+v.fee_tzs,currency:'TZS',description:'jumbabovu Verified badge, 1 year',email:u.email,name:u.name})}catch(err){console.error(err);return res.status(502).json({error:'Could not start the online payment. Please try again.'})}
  await q("UPDATE verifications SET payment_method='pesapal',pesapal_tracking_id=$2,pesapal_ref=$3 WHERE id=$1",[v.id,d.order_tracking_id,ref]);
  res.json({redirect_url:d.redirect_url});
}));
r.get('/admin/verifications',auth('admin'),wrap(async(_,res)=>res.json(await q(`SELECT v.*,e.company_name,e.brela_no,e.tin_no,(SELECT json_agg(json_build_object('id',d.id,'doc_type',d.doc_type,'name',d.name)) FROM verification_docs d WHERE d.verification_id=v.id) docs
  FROM verifications v JOIN exporters e ON e.id=v.exporter_id WHERE v.status IN('submitted','awaiting_payment','payment_reported') ORDER BY v.id`))));
r.post('/admin/verifications/:id/review',auth('admin'),wrap(async(req,res)=>{
  const{decision,reason}=req.body;if(!['approve','reject'].includes(decision))return res.status(400).json({error:'Choose approve or reject'});
  if(decision==='reject'&&!String(reason||'').trim())return res.status(400).json({error:'Give the seller a reason'});
  const[v]=decision==='approve'
    ?await q("UPDATE verifications SET status='awaiting_payment',fee_tzs=$2 WHERE id=$1 AND status='submitted' RETURNING *",[req.params.id,+(await settings()).verified_fee_tzs])
    :await q("UPDATE verifications SET status='rejected',reject_reason=$2 WHERE id=$1 AND status='submitted' RETURNING *",[req.params.id,String(reason).slice(0,500)]);
  if(!v)return res.status(409).json({error:'This application was already reviewed'});
  await notify(await uidOf(v.exporter_id),'verification',decision==='approve'?`Your documents were approved. Pay the TZS ${Number(v.fee_tzs).toLocaleString()} fee to activate your Verified badge`:`Your Verified application was not approved: ${v.reject_reason}`,'/dashboard');
  res.json(v);
}));
r.post('/admin/verifications/:id/confirm-payment',auth('admin'),wrap(async(req,res)=>{const v=await activate(req.params.id);v?res.json(v):res.status(409).json({error:'Nothing to confirm'})}));
r.get('/admin/docs/:id/link',auth('admin'),wrap(async(req,res)=>{
  const{CLOUDINARY_CLOUD_NAME:c,CLOUDINARY_API_KEY:k,CLOUDINARY_API_SECRET:sec}=process.env;
  const[d]=await q('SELECT * FROM verification_docs WHERE id=$1',[req.params.id]);if(!d||!c)return res.status(404).json({error:'Document not found'});
  const p={expires_at:Math.floor(Date.now()/1000)+600,public_id:d.public_id,timestamp:Math.floor(Date.now()/1000),type:'authenticated'};if(d.format)p.format=d.format;
  const sig=crypto.createHash('sha1').update(Object.keys(p).sort().map(x=>`${x}=${p[x]}`).join('&')+sec).digest('hex');
  res.json({url:`https://api.cloudinary.com/v1_1/${c}/${d.resource_type}/download?${new URLSearchParams({...p,signature:sig,api_key:k})}`});
}));

// Admin fee settings and currencies
const NUM={seller_fee_pct:[0,100],platform_txn_pct:[0,100],gateway_fee_pct:[0,100],gateway_fee_fixed_tzs:[0,1e9],payout_fee_pct:[0,100],payout_fee_fixed_tzs:[0,1e9],fx_markup_pct:[0,100],auto_confirm_days:[1,60],verified_fee_tzs:[0,1e9]};
r.get('/currencies',wrap(async(_,res)=>res.json(await q('SELECT code,name FROM currencies WHERE active ORDER BY code'))));
r.get('/admin/settings',auth('admin'),wrap(async(_,res)=>res.json({settings:await settings(),currencies:await q('SELECT code,name,rate_to_tzs::float rate_to_tzs,active FROM currencies ORDER BY code')})));
r.put('/admin/settings',auth('admin'),wrap(async(req,res)=>{
  const b=req.body;
  for(const[k,[lo,hi]]of Object.entries(NUM))if(k in b&&!(+b[k]>=lo&&+b[k]<=hi))return res.status(400).json({error:`${k} must be between ${lo} and ${hi}`});
  if('release_mode' in b&&!['manual','auto'].includes(b.release_mode))return res.status(400).json({error:'Release mode must be manual or auto'});
  for(const k of [...Object.keys(NUM),'release_mode'])if(k in b)await q('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value',[k,String(b[k])]);
  res.json(await settings());
}));
r.put('/admin/currencies/:code',auth('admin'),wrap(async(req,res)=>{
  const rate=+req.body.rate_to_tzs;
  if(req.params.code==='TZS'||!(rate>=0))return res.status(400).json({error:'Invalid rate'});
  if(req.body.active&&!(rate>0))return res.status(400).json({error:'Enter a rate before activating '+req.params.code});
  res.json((await q('UPDATE currencies SET rate_to_tzs=$2,active=$3 WHERE code=$1 RETURNING code',[req.params.code,rate,!!req.body.active]))[0]);
}));

// Advertising (pricing off by default: price 0 until an admin sets one) and analytics
r.get('/ads/active',wrap(async(_,res)=>res.json(await q(`SELECT a.*,e.company_name,e.verified,p.name product_name,p.moq,p.image_url,c.name category FROM ads a JOIN exporters e ON e.id=a.exporter_id LEFT JOIN products p ON p.id=a.product_id LEFT JOIN categories c ON c.id=p.category_id WHERE a.status='approved' AND current_date BETWEEN a.start_date AND a.end_date ORDER BY a.id DESC LIMIT 20`))));
r.get('/my/products',auth('exporter'),wrap(async(req,res)=>res.json(await q('SELECT id,name FROM products WHERE exporter_id=$1 ORDER BY id DESC',[(await myExporter(req.user.id)).id]))));
r.get('/ads',auth('exporter','admin'),wrap(async(req,res)=>{
  const ex=req.user.role==='exporter'?await myExporter(req.user.id):null;
  res.json(await q(`SELECT a.*,e.company_name FROM ads a JOIN exporters e ON e.id=a.exporter_id ${ex?'WHERE a.exporter_id=$1':''} ORDER BY a.id DESC`,ex?[ex.id]:[]));
}));
r.post('/ads',auth('exporter'),wrap(async(req,res)=>{
  const e=await myExporter(req.user.id);const b=req.body;
  if(!['featured_product','featured_supplier','homepage_banner'].includes(b.type)||!b.start_date||!b.end_date||b.end_date<b.start_date)return res.status(400).json({error:'Choose an ad type and a valid date range'});
  let pid=null;if(b.type==='featured_product'){const[p]=await q('SELECT id FROM products WHERE id=$1 AND exporter_id=$2',[b.product_id,e.id]);if(!p)return res.status(400).json({error:'Choose one of your products'});pid=p.id}
  const[a]=await q('INSERT INTO ads(exporter_id,product_id,type,title,start_date,end_date) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[e.id,pid,b.type,String(b.title||'').slice(0,120),b.start_date,b.end_date]);
  for(const id of await admins())await notify(id,'ad','New advertisement request to review','/dashboard');
  res.json(a);
}));
r.patch('/ads/:id',auth('admin'),wrap(async(req,res)=>{
  const{status,price}=req.body;if(!['approved','rejected'].includes(status)||!(+price>=0))return res.status(400).json({error:'Invalid ad update'});
  const[a]=await q('UPDATE ads SET status=$2,price=$3 WHERE id=$1 RETURNING *',[req.params.id,status,+price]);
  if(!a)return res.status(404).json({error:'Ad not found'});
  await notify(await uidOf(a.exporter_id),'ad',`Your advertisement was ${status}`,'/dashboard');res.json(a);
}));
r.get('/analytics',auth('exporter','admin'),wrap(async(req,res)=>{
  const c=async(sql,p=[])=>(await q(sql,p))[0].n;const sum=(w,p=[])=>c(`SELECT coalesce(sum(orders.amount*c.rate_to_tzs),0)::float n FROM orders JOIN currencies c ON c.code=orders.currency WHERE ${w}`,p);
  if(req.user.role==='admin')return res.json({'Escrow funds held (TZS)':await sum("payment_status IN('funds_held','awaiting_release','disputed')"),'Awaiting fund verification':await c("SELECT count(*)::int n FROM orders WHERE payment_status='deposit_reported'"),'Released to exporters (TZS)':await sum("payment_status='released'"),'Refunded to buyers (TZS)':await sum("payment_status='refunded'"),'Platform earnings (TZS)':await c("SELECT coalesce(sum(platform_earnings_tzs),0)::float n FROM orders WHERE payment_status='released'"),'Payouts to send':await c("SELECT count(*)::int n FROM orders WHERE payment_status IN('released','partially_settled','refunded') AND payout_ref IS NULL"),'Open disputes':await c("SELECT count(*)::int n FROM disputes WHERE status='open'"),'All orders':await c('SELECT count(*)::int n FROM orders'),'Verification fees (TZS)':await c("SELECT coalesce(sum(fee_tzs),0)::float n FROM verifications WHERE status='active'"),'Verification requests to review':await c("SELECT count(*)::int n FROM verifications WHERE status IN('submitted','payment_reported')"),'Pending ad requests':await c("SELECT count(*)::int n FROM ads WHERE status='pending'")});
  const e=(await myExporter(req.user.id)).id;const acc=await c("SELECT count(*)::int n FROM quotations WHERE status='accepted' AND rfq_id IN(SELECT id FROM rfqs WHERE exporter_id=$1)",[e]);const all=await c('SELECT count(*)::int n FROM quotations WHERE rfq_id IN(SELECT id FROM rfqs WHERE exporter_id=$1)',[e]);
  res.json({'Orders':await c('SELECT count(*)::int n FROM orders WHERE exporter_id=$1',[e]),'In escrow for you (TZS)':await sum("exporter_id=$1 AND payment_status IN('funds_held','awaiting_release','disputed')",[e]),'Paid out to you (TZS)':await sum("exporter_id=$1 AND payment_status='released'",[e]),'Quotation acceptance rate':all?Math.round(100*acc/all)+'%':'n/a'});
}));

// Chat, notifications, stats
r.get('/conversations',auth('buyer','exporter'),wrap(async(req,res)=>res.json(await q(`SELECT c.id,
  CASE WHEN c.buyer_id=$1 THEN e.company_name ELSE u.name END other_name,CASE WHEN c.buyer_id=$1 THEN e.user_id ELSE c.buyer_id END other_id,
  (SELECT coalesce(nullif(body,''),'Attachment') FROM messages WHERE conversation_id=c.id ORDER BY id DESC LIMIT 1) last,
  (SELECT count(*)::int FROM messages WHERE conversation_id=c.id AND sender_id<>$1 AND NOT seen) unread
  FROM conversations c JOIN exporters e ON e.id=c.exporter_id JOIN users u ON u.id=c.buyer_id WHERE c.buyer_id=$1 OR e.user_id=$1
  ORDER BY (SELECT max(id) FROM messages WHERE conversation_id=c.id) DESC NULLS LAST,c.id DESC`,[req.user.id]))));
r.post('/conversations',auth('buyer'),mailOk,wrap(async(req,res)=>{
  const[c]=await q('INSERT INTO conversations(buyer_id,exporter_id) VALUES($1,$2) ON CONFLICT(buyer_id,exporter_id) DO UPDATE SET buyer_id=EXCLUDED.buyer_id RETURNING id',[req.user.id,req.body.exporter_id]);res.json(c);
}));
r.get('/conversations/:id/messages',auth('buyer','exporter'),wrap(async(req,res)=>res.json(await q(`SELECT m.* FROM messages m JOIN conversations c ON c.id=m.conversation_id JOIN exporters e ON e.id=c.exporter_id
  WHERE m.conversation_id=$1 AND (c.buyer_id=$2 OR e.user_id=$2) ORDER BY m.id`,[req.params.id,req.user.id]))));
r.get('/notifications',auth(),wrap(async(req,res)=>res.json({items:await q('SELECT * FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 20',[req.user.id]),unread:(await q('SELECT count(*)::int n FROM notifications WHERE user_id=$1 AND NOT read',[req.user.id]))[0].n})));
r.post('/notifications/read',auth(),wrap(async(req,res)=>{await q('UPDATE notifications SET read=true WHERE user_id=$1',[req.user.id]);res.json({ok:true})}));
r.get('/stats',auth(),wrap(async(req,res)=>{
  const u=req.user;const c=async(sql,p=[])=>(await q(sql,p))[0].n;
  if(u.role==='admin')return res.json({Buyers:await c("SELECT count(*)::int n FROM users WHERE role='buyer'"),Exporters:await c('SELECT count(*)::int n FROM exporters'),Products:await c('SELECT count(*)::int n FROM products'),'Total RFQs':await c('SELECT count(*)::int n FROM rfqs'),Conversations:await c('SELECT count(*)::int n FROM conversations')});
  if(u.role==='buyer')return res.json({'My RFQs':await c('SELECT count(*)::int n FROM rfqs WHERE buyer_id=$1',[u.id]),'Quotations received':await c('SELECT count(*)::int n FROM quotations WHERE rfq_id IN(SELECT id FROM rfqs WHERE buyer_id=$1)',[u.id]),Conversations:await c('SELECT count(*)::int n FROM conversations WHERE buyer_id=$1',[u.id])});
  const e=await myExporter(u.id);
  res.json({Products:await c('SELECT count(*)::int n FROM products WHERE exporter_id=$1',[e.id]),'Incoming RFQs':await c('SELECT count(*)::int n FROM rfqs WHERE exporter_id=$1',[e.id]),'Quotations sent':await c('SELECT count(*)::int n FROM quotations WHERE rfq_id IN(SELECT id FROM rfqs WHERE exporter_id=$1)',[e.id]),Conversations:await c('SELECT count(*)::int n FROM conversations WHERE exporter_id=$1',[e.id])});
}));
export default r;
