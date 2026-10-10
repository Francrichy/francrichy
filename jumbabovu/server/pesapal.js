// Pesapal API 3.0 (cards and mobile money). Money lands in the platform's Pesapal account, which acts as the escrow holding account.
const BASE=()=>process.env.PESAPAL_ENV==='live'?'https://pay.pesapal.com/v3':'https://cybqa.pesapal.com/pesapalv3';
export const enabled=()=>!!(process.env.PESAPAL_CONSUMER_KEY&&process.env.PESAPAL_CONSUMER_SECRET&&process.env.APP_URL);
export const currencies=()=>(process.env.PESAPAL_CURRENCIES||'TZS,USD').split(',').map(s=>s.trim());
let tok={t:null,exp:0},ipnId=null;
async function call(path,{method='GET',body,auth=true}={}){
  const headers={'Content-Type':'application/json',Accept:'application/json'};
  if(auth)headers.Authorization='Bearer '+await token();
  const res=await fetch(BASE()+path,{method,headers,body:body&&JSON.stringify(body)});
  const d=await res.json().catch(()=>({}));
  if(!res.ok||d.error)throw new Error(d.error?.message||d.message||'Pesapal request failed');
  return d;
}
async function token(){
  if(tok.t&&Date.now()<tok.exp)return tok.t;
  const d=await call('/api/Auth/RequestToken',{method:'POST',auth:false,body:{consumer_key:process.env.PESAPAL_CONSUMER_KEY,consumer_secret:process.env.PESAPAL_CONSUMER_SECRET}});
  if(!d.token)throw new Error('Pesapal login failed');
  tok={t:d.token,exp:Date.now()+4*60*1000};return d.token;
}
async function ipn(){
  if(ipnId)return ipnId;
  const d=await call('/api/URLSetup/RegisterIPN',{method:'POST',body:{url:process.env.APP_URL+'/api/pesapal/ipn',ipn_notification_type:'GET'}});
  return ipnId=d.ipn_id;
}
export async function submitOrder({ref,amount,currency,description,email,name}){
  const[first,...rest]=(name||'Buyer').split(' ');
  return call('/api/Transactions/SubmitOrderRequest',{method:'POST',body:{id:ref,currency,amount,description:description.slice(0,100),callback_url:process.env.APP_URL+'/api/pesapal/callback',notification_id:await ipn(),billing_address:{email_address:email,first_name:first,last_name:rest.join(' ')||first}}});
}
export const status=id=>call('/api/Transactions/GetTransactionStatus?orderTrackingId='+encodeURIComponent(id));
