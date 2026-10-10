import {useEffect,useState} from 'react';
import {api} from './api.js';
const ST={payment_pending:'Awaiting escrow payment',production:'In production',ready:'Ready to ship',shipped:'Shipped',delivered:'Delivered',completed:'Completed',cancelled:'Cancelled'};
const PAY={awaiting_deposit:'Awaiting payment into escrow',deposit_reported:'Payment reported, being verified',funds_held:'Funds held in escrow',awaiting_release:'Delivery confirmed, payout pending',released:'Released, payout being sent',refunded:'Refunded to buyer',partially_settled:'Partially settled',disputed:'Disputed, funds frozen'};
const REASONS=['Wrong Product','Quantity Issue','Quality Issue','Shipment Issue','Other'];
const Err=({e})=>e?<p role="alert" className="mt-2 text-sm text-red-700">{e}</p>:null;
const Box=({onSubmit,children})=><form onSubmit={onSubmit} className="mt-2 space-y-2 rounded bg-slate-50 p-3 text-sm">{children}</form>;

function Pay({o,info,done}){
  const[r,setR]=useState('');const[e,setE]=useState('');const[cur,setCur]=useState(o.currency);const[mth,setMth]=useState(info.online?.enabled?'online':'bank');const[cs,setCs]=useState([]);const[c,setC]=useState(null);
  useEffect(()=>{api('/currencies').then(setCs)},[]);
  useEffect(()=>{setC(null);setE('');api(`/orders/${o.id}/charges?currency=${cur}`).then(setC).catch(x=>setE(x.message))},[cur]);
  const n=v=>Number(v).toLocaleString();
  const onl=info.online?.enabled&&info.online.currencies.includes(cur);const m=onl?mth:'bank';
  const goOnline=async()=>{setE('');try{const d=await api(`/orders/${o.id}/pay-online`,{method:'POST',body:{currency:cur}});window.location.href=d.redirect_url}catch(x){setE(x.message)}};
  const go=ev=>{ev.preventDefault();api(`/orders/${o.id}/paid`,{method:'POST',body:{reference:r,pay_currency:cur}}).then(done).catch(x=>setE(x.message))};
  return <Box onSubmit={go}><p className="font-bold">Pay into the jumbabovu escrow account. Never pay the exporter directly.</p>
    <label className="block font-medium">Pay in<select className="input mt-1 font-normal" value={cur} onChange={ev=>setCur(ev.target.value)}>{cs.map(x=><option key={x.code} value={x.code}>{x.code}</option>)}</select></label>
    {c&&<dl className="grid grid-cols-2 gap-1"><dt>Goods</dt><dd>{n(c.goods_pay)} {cur}</dd><dt>Transaction and service fee</dt><dd>{n(c.txn_fee_pay)} {cur}</dd><dt className="font-bold">Total to pay</dt><dd className="font-bold">{n(c.total_pay)} {cur}</dd></dl>}
    {c&&cur!==o.currency&&<p className="text-xs text-slate-600">Exchange rate used: 1 {o.currency} = {c.fx_rate.toPrecision(4)} {cur}. This is the jumbabovu rate and includes our currency margin.</p>}
    {onl&&<fieldset className="space-y-1"><label className="block"><input type="radio" checked={m==='online'} onChange={()=>setMth('online')}/> Pay online with card or mobile money (Pesapal)</label><label className="block"><input type="radio" checked={m==='bank'} onChange={()=>setMth('bank')}/> Bank transfer to the escrow account</label></fieldset>}
    {m==='online'&&<button type="button" className="btn" disabled={!c} onClick={goOnline}>{c?`Pay ${n(c.total_pay)} ${cur} online`:'Calculating'}</button>}
    {m==='bank'&&<>{info.account_no?<dl className="grid grid-cols-2 gap-1"><dt>Bank</dt><dd>{info.bank}</dd><dt>Account name</dt><dd>{info.account_name}</dd><dt>Account number</dt><dd>{info.account_no}</dd><dt>Payment reference</dt><dd><b>{o.order_no}</b></dd></dl>
    :<p className="text-red-700">The escrow account details are not set up yet. Please contact support before paying.</p>}
    {info.note&&<p>{info.note}</p>}
    <input className="input" placeholder="Bank transfer reference (optional)" value={r} onChange={ev=>setR(ev.target.value)} aria-label="Bank transfer reference"/>
    <button className="btn" disabled={!c}>I have paid into escrow</button></>}<Err e={e}/></Box>;
}
function Dispute({o,done}){
  const[f,setF]=useState({reason:REASONS[0],details:''});const[e,setE]=useState('');
  const go=ev=>{ev.preventDefault();api(`/orders/${o.id}/dispute`,{method:'POST',body:f}).then(done).catch(x=>setE(x.message))};
  return <Box onSubmit={go}><select className="input" value={f.reason} onChange={ev=>setF({...f,reason:ev.target.value})} aria-label="Reason">{REASONS.map(r=><option key={r}>{r}</option>)}</select>
    <textarea className="input" rows="2" placeholder="Describe the problem" value={f.details} onChange={ev=>setF({...f,details:ev.target.value})} aria-label="Details"/><button className="btn">Open dispute and freeze the funds</button><Err e={e}/></Box>;
}
function Resolve({o,done}){
  const[f,setF]=useState({decision:'release',note:''});const[e,setE]=useState('');
  const go=ev=>{ev.preventDefault();api(`/disputes/${o.dispute_id}/resolve`,{method:'POST',body:f}).then(done).catch(x=>setE(x.message))};
  return <Box onSubmit={go}><p><b>Dispute:</b> {o.dispute_text}</p><select className="input" value={f.decision} onChange={ev=>setF({...f,decision:ev.target.value})} aria-label="Decision"><option value="release">Release payment to exporter</option><option value="refund">Refund buyer</option><option value="partial">Partial settlement</option></select>
    <input className="input" placeholder="Decision note (state the amounts for a partial settlement)" value={f.note} onChange={ev=>setF({...f,note:ev.target.value})} aria-label="Decision note"/><button className="btn">Record decision</button><Err e={e}/></Box>;
}
function Release({o,done}){
  const[r,setR]=useState('');const[e,setE]=useState('');
  const go=ev=>{ev.preventDefault();api(`/orders/${o.id}/payout`,{method:'POST',body:{reference:r}}).then(done).catch(x=>setE(x.message))};
  return <Box onSubmit={go}>{o.payout_account_no&&<p><b>Send to:</b> {o.payout_bank_name} · {o.payout_account_name} · {o.payout_account_no}</p>}<p>Send the money from the escrow account first, then record the bank or mobile money reference here.</p><input className="input" placeholder="Payout bank reference" value={r} onChange={ev=>setR(ev.target.value)} aria-label="Payout reference"/><button className="btn">Save reference</button><Err e={e}/></Box>;
}
function Review({o,done}){
  const[rt,setRt]=useState(5);const[c,setC]=useState('');const[e,setE]=useState('');
  const go=ev=>{ev.preventDefault();api('/reviews',{method:'POST',body:{order_id:o.id,rating:+rt,comment:c}}).then(done).catch(x=>setE(x.message))};
  return <Box onSubmit={go}><label className="block font-medium">Rating (5 is best)<select className="input mt-1 font-normal" value={rt} onChange={ev=>setRt(ev.target.value)}>{[5,4,3,2,1].map(n=><option key={n}>{n}</option>)}</select></label>
    <textarea className="input" rows="2" placeholder="Share your experience with this supplier" value={c} onChange={ev=>setC(ev.target.value)} aria-label="Review"/><button className="btn">Submit review</button><Err e={e}/></Box>;
}

export default function Orders({user}){
  const[os,setOs]=useState([]);const[info,setInfo]=useState({});const[open,setOpen]=useState(null);const[err,setErr]=useState('');
  const load=()=>api('/orders').then(setOs);useEffect(()=>{load();api('/escrow/info').then(setInfo)},[]);
  const act=async(id,a)=>{setErr('');try{await api(`/orders/${id}/${a}`,{method:'POST'});load()}catch(x){setErr(x.message)}};
  const btn=(o,a,t)=><button key={a} className="btn" onClick={()=>act(o.id,a)}>{t}</button>;
  const tog=k=>setOpen(open===k?null:k);const after=()=>{setOpen(null);load()};
  const sub=(o,k,label,node,cls='btn')=><div key={k}><button className={cls} onClick={()=>tog(o.id+k)}>{label}</button>{open===o.id+k&&node}</div>;
  const actions=o=>{const r=user.role,A=[],ps=o.payment_status;
    if(r==='buyer'){
      if(ps==='awaiting_deposit')A.push(sub(o,'p','How to pay into escrow',<Pay o={o} info={info} done={after}/>));
      if(ps==='deposit_reported'&&o.payment_method==='pesapal'){A.push(btn(o,'check-payment','Check payment status'));A.push(sub(o,'p','Try online payment again',<Pay o={o} info={info} done={after}/>,'lnk'))}
      else if(ps==='deposit_reported')A.push(<p key="v" className="text-sm text-slate-600">We are verifying your payment in the escrow account.</p>);
      if(o.status==='shipped'&&ps==='funds_held')A.push(btn(o,'received','Confirm goods received'));
      if(['funds_held','awaiting_release'].includes(ps))A.push(sub(o,'d','Report a problem',<Dispute o={o} done={after}/>,'lnk'));
      if(['delivered','completed'].includes(o.status)&&!o.review_id)A.push(sub(o,'r','Leave a review',<Review o={o} done={after}/>,'lnk'));
    }
    if(r==='exporter'){
      if(['awaiting_deposit','deposit_reported'].includes(ps))A.push(<p key="w" className="text-sm text-slate-600">Waiting for the buyer's escrow payment. Do not ship until the funds are held.</p>);
      if(ps==='disputed')A.push(<p key="x" className="text-sm text-slate-600">A dispute is open and the funds are frozen while we review it.</p>);
      if(o.status==='production'&&ps==='funds_held')A.push(btn(o,'advance','Mark ready to ship'));
      if(o.status==='ready'&&ps==='funds_held')A.push(btn(o,'advance','Mark shipped'));
    }
    if(r==='admin'){
      if(o.payment_method==='pesapal'&&ps==='deposit_reported')A.push(btn(o,'check-payment','Check online payment status'));
      else if(['awaiting_deposit','deposit_reported'].includes(ps))A.push(btn(o,'confirm-funds','Confirm funds received in escrow account'));
      if(ps==='awaiting_release')A.push(btn(o,'release','Approve release to exporter'));
      if(['released','partially_settled','refunded'].includes(ps)&&!o.payout_ref)A.push(sub(o,'x','Record money sent',<Release o={o} done={after}/>));
      if(ps==='disputed'&&o.dispute_id)A.push(sub(o,'z','Resolve dispute',<Resolve o={o} done={after}/>));
    }
    return <div className="flex flex-wrap items-start gap-3">{A}</div>};
  const feeLine=o=>{if(o.total_pay==null)return null;const n=v=>Number(v).toLocaleString();const t=user.role==='buyer'?`You pay ${n(o.total_pay)} ${o.pay_currency} (goods ${n(o.goods_pay)} + transaction and service fee ${n(o.txn_fee_pay)})`:user.role==='exporter'?`You receive ${n(o.seller_net)} ${o.currency} after fees`:`Buyer pays ${n(o.total_pay)} ${o.pay_currency} · seller net ${n(o.seller_net)} ${o.currency} · platform earnings ${n(o.platform_earnings_tzs)} TZS`;return <p className="text-sm text-slate-600">{t}</p>};
  const who=o=>user.role==='buyer'?o.company_name:user.role==='exporter'?o.buyer_name:`${o.buyer_name} to ${o.company_name}`;
  return <main className="mx-auto max-w-6xl px-4 py-8"><h1 className="mb-2 text-2xl font-bold">Orders</h1>
    <p className="mb-4 rounded bg-[#FFF3D6] p-3 text-sm"><b>Escrow protection.</b> Buyers pay into the jumbabovu escrow account, never to the exporter. The exporter ships once the funds are confirmed, and the money is released only after the buyer confirms delivery or a dispute is decided.</p>
    {err&&<p role="alert" className="mb-3 text-red-700">{err}</p>}
    {os.length?<div className="space-y-4">{os.map(o=><div key={o.id} className="card"><div className="flex flex-wrap justify-between gap-2">
      <div><b>{o.order_no}</b> · {o.product}<p className="text-sm text-slate-600">{o.quantity} at {o.unit_price} · Order value {o.amount?Number(o.amount).toLocaleString()+' '+o.currency:'n/a'} · {who(o)}</p>{feeLine(o)}</div>
      <div className="text-right text-sm"><p><b>{ST[o.status]}</b></p><p className="text-slate-600">Escrow: {PAY[o.payment_status]}{o.payout_ref&&` · sent, ref ${o.payout_ref}`}</p></div></div>
      <div className="mt-3">{actions(o)}</div></div>)}</div>
    :<p className="text-slate-600">No orders yet. An order is created when a buyer accepts a quotation.</p>}</main>;
}
