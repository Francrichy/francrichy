import {q} from './db.js'; import {notify} from './realtime.js'; import {settings} from './fees.js';
// Automatic release (only when admin sets release_mode to auto). Disputed orders are never touched.
// 1) buyer confirmed delivery  2) buyer silent for auto_confirm_days after shipping and no dispute
export async function autoRelease(){
  const S=await settings();if(S.release_mode!=='auto')return;
  const d=parseInt(S.auto_confirm_days)||7;
  const rows=await q("UPDATE orders SET status='completed',payment_status='released' WHERE payment_status='awaiting_release' OR (status='shipped' AND payment_status='funds_held' AND shipped_at<now()-($1||' days')::interval) RETURNING *",[d]);
  for(const o of rows){
    await q("INSERT INTO escrow_events(order_id,event,note) VALUES($1,'auto_released','release rule')",[o.id]);
    const[e]=await q('SELECT user_id FROM exporters WHERE id=$1',[o.exporter_id]);
    await notify(e.user_id,'order',`Escrow released, your payout is being processed (${o.order_no})`,'/orders');
    await notify(o.buyer_id,'order',`Escrow was released to the exporter (${o.order_no})`,'/orders');
  }
}
export async function expireVerifications(){
  await q("UPDATE exporters SET verified=false WHERE verified AND verified_until IS NOT NULL AND verified_until<now()");
  await q("UPDATE verifications SET status='expired' WHERE status='active' AND valid_until<now()");
}
