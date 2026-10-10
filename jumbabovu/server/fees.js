import {q} from './db.js';
export async function settings(){return Object.fromEntries((await q('SELECT key,value FROM settings')).map(r=>[r.key,r.value]))}
const rates=async()=>Object.fromEntries((await q('SELECT code,rate_to_tzs::float rate,active FROM currencies')).map(r=>[r.code,r]));
const rnd=(n,c)=>{const f=c==='TZS'?1:100;return Math.round(n*f)/f};
// amount is in the order (seller) currency qc; the buyer pays in pc. All percentages and fixed fees come from admin settings.
export async function charges(amount,qc,pc){
  const S=await settings(),R=await rates(),n=k=>parseFloat(S[k]||0);
  const rq=R[qc],rp=R[pc];
  if(!rq?.rate||!rp?.rate||!rp.active)throw new Error('This currency is not available yet');
  const m=qc!==pc?n('fx_markup_pct')/100:0;
  const goods=amount*rq.rate/rp.rate*(1+m);
  const platPct=n('platform_txn_pct');
  const fee=goods*(n('gateway_fee_pct')+platPct)/100+n('gateway_fee_fixed_tzs')/rp.rate;
  const sellerFee=amount*n('seller_fee_pct')/100;
  const payoutFee=amount*n('payout_fee_pct')/100+n('payout_fee_fixed_tzs')/rq.rate;
  const earn=(goods*platPct/100+(goods-goods/(1+m)))*rp.rate+sellerFee*rq.rate;
  return{pay_currency:pc,fx_rate:rq.rate/rp.rate*(1+m),goods_pay:rnd(goods,pc),txn_fee_pay:rnd(fee,pc),total_pay:rnd(goods+fee,pc),seller_fee:rnd(sellerFee,qc),payout_fee:rnd(payoutFee,qc),seller_net:rnd(amount-sellerFee-payoutFee,qc),platform_earnings_tzs:Math.round(earn)};
}
