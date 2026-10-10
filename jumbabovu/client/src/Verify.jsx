import {useEffect,useState} from 'react';
import {api} from './api.js';
import {uploadFile} from './upload.js';
const F=({label,...p})=><label className="block text-sm font-medium">{label}<input className="input mt-1 font-normal" {...p}/></label>;
const DOCS=[['brela','BRELA certificate of incorporation'],['tin','TIN certificate'],['export_license','Export licence or permit for your product'],['director_id','Director ID (NIDA, passport or licence)']];
const date=d=>d?String(d).slice(0,10):'';

export function ProfilePanel(){
  const[p,setP]=useState(null);const[m,setM]=useState('');
  useEffect(()=>{api('/exporter/me').then(setP)},[]);
  if(!p)return null;
  const set=k=>e=>setP({...p,[k]:e.target.value});
  const save=async e=>{e.preventDefault();setM('');try{await api('/exporter/me',{method:'PUT',body:p});setM('Saved.')}catch(x){setM(x.message)}};
  return <section className="card"><h2 className="mb-1 text-xl font-bold">Company profile and payout account</h2>
    {!p.payout_account_no&&<p className="mb-3 rounded bg-[#FFF3D6] p-2 text-sm"><b>Add your payout account.</b> You need it before you can send quotations, so we know where to send your money. The account must be in your company name.</p>}
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <F label="City" value={p.city||''} onChange={set('city')}/><F label="Phone" value={p.phone||''} onChange={set('phone')}/><F label="Address" value={p.address||''} onChange={set('address')}/>
      <F label="BRELA registration number (optional)" value={p.brela_no||''} onChange={set('brela_no')}/><F label="TIN (optional)" value={p.tin_no||''} onChange={set('tin_no')}/>
      <label className="block text-sm font-medium sm:col-span-2">About your company<textarea className="input mt-1 font-normal" rows="2" value={p.about||''} onChange={set('about')}/></label>
      <label className="block text-sm font-medium">Payout method<select className="input mt-1 font-normal" value={p.payout_method||''} onChange={set('payout_method')}><option value="">Select</option><option value="bank">Bank account</option><option value="mobile">Mobile money</option></select></label>
      <F label="Bank or network name" value={p.payout_bank_name||''} onChange={set('payout_bank_name')}/><F label="Account name (your company name)" value={p.payout_account_name||''} onChange={set('payout_account_name')}/><F label="Account or phone number" value={p.payout_account_no||''} onChange={set('payout_account_no')}/>
      <div className="sm:col-span-2"><button className="btn">Save</button><span className="ml-3 text-sm" role="status">{m}</span></div></form></section>;
}

export function VerifyPanel(){
  const[d,setD]=useState(null);const[docs,setDocs]=useState({});const[msg,setMsg]=useState('');const[ref,setRef]=useState('');
  const load=()=>api('/verification').then(setD);useEffect(()=>{load()},[]);
  if(!d)return null;
  const v=d.verification,st=v?.status,fee=Number(v?.fee_tzs||d.fee).toLocaleString();
  const soon=d.exporter.verified_until&&new Date(d.exporter.verified_until)<new Date(Date.now()+30*864e5);
  const up=t=>async e=>{const f=e.target.files[0];if(!f)return;setMsg('Uploading...');try{setDocs({...docs,[t]:await uploadFile(f,'doc')});setMsg('')}catch(x){setMsg(x.message)}};
  const post=(path,body)=>api(path,{method:'POST',body}).then(()=>{setMsg('');load()}).catch(x=>setMsg(x.message));
  const online=async()=>{try{window.location.href=(await api('/verification/pay-online',{method:'POST'})).redirect_url}catch(x){setMsg(x.message)}};
  const ready=DOCS.every(([t])=>docs[t]);
  return <section className="card"><h2 className="mb-1 text-xl font-bold">Verified badge</h2>
    <p className="mb-3 text-sm text-slate-600">Optional. The badge builds buyer trust and ranks you higher. Fee: TZS {Number(d.fee).toLocaleString()} per year, paid only after we approve your documents.</p>
    {d.exporter.verified&&<p className="mb-3 rounded bg-green-50 p-2 text-sm">You are Verified{d.exporter.verified_until?` until ${date(d.exporter.verified_until)}`:''}.</p>}
    {d.exporter.verified&&soon&&st!=='awaiting_payment'&&<button className="btn" onClick={()=>post('/verification/renew')}>Renew for one more year</button>}
    {(!st||['rejected'].includes(st)||(st==='expired'&&!d.exporter.verified))&&!d.exporter.verified&&<div className="space-y-3">
      {st==='rejected'&&<p className="rounded bg-red-50 p-2 text-sm text-red-800">Not approved: {v.reject_reason}. You can fix this and apply again.</p>}
      {DOCS.map(([t,l])=><label key={t} className="block text-sm font-medium">{l}{docs[t]&&<span className="ml-2 font-normal text-green-700">Uploaded: {docs[t].name}</span>}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-1 block text-sm font-normal" onChange={up(t)}/></label>)}
      <p className="text-xs text-slate-500">Documents are stored privately and only our review team can open them.</p>
      <button className="btn" disabled={!ready} onClick={()=>post('/verification/submit',{docs:Object.entries(docs).map(([doc_type,x])=>({doc_type,...x}))})}>Submit for review</button></div>}
    {st==='submitted'&&<p>Your documents are under review. We will notify you.</p>}
    {st==='awaiting_payment'&&<div className="space-y-2 text-sm"><p className="font-bold">Approved. Pay TZS {fee} to activate your badge for one year.</p>
      {d.online&&<button className="btn" onClick={online}>Pay online (card or mobile money)</button>}
      {d.bank.account_no&&<div className="rounded bg-slate-50 p-3"><p className="font-bold">Or pay by bank transfer</p><p>{d.bank.bank} · {d.bank.account_name} · {d.bank.account_no}</p><p>Reference: VERIFY-{v.id}</p>
        <input className="input my-2" placeholder="Bank transfer reference" value={ref} onChange={e=>setRef(e.target.value)} aria-label="Bank transfer reference"/><button className="btn" onClick={()=>post('/verification/paid',{reference:ref})}>I have paid</button></div>}</div>}
    {st==='payment_reported'&&<p>We are confirming your payment. Your badge turns on as soon as we do.</p>}
    {msg&&<p role="alert" className="mt-2 text-sm text-red-700">{msg}</p>}</section>;
}

export function VerificationAdmin(){
  const[rows,setRows]=useState([]);const[why,setWhy]=useState({});const[m,setM]=useState('');
  const load=()=>api('/admin/verifications').then(setRows);useEffect(()=>{load()},[]);
  const act=(path,body)=>api(path,{method:'POST',body}).then(()=>{setM('');load()}).catch(x=>setM(x.message));
  const view=async id=>{try{window.open((await api('/admin/docs/'+id+'/link')).url,'_blank','noopener')}catch(x){setM(x.message)}};
  return <section className="card"><h2 className="mb-3 text-xl font-bold">Verified badge applications</h2>
    {rows.length?<div className="space-y-4">{rows.map(r=><div key={r.id} className="rounded border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><b>{r.company_name}</b><span>{r.status.replace('_',' ')}</span></div>
      <p className="text-slate-600">BRELA {r.brela_no||'n/a'} · TIN {r.tin_no||'n/a'}</p>
      <div className="my-2 flex flex-wrap gap-3">{(r.docs||[]).map(d=><button key={d.id} className="lnk underline" onClick={()=>view(d.id)}>{d.doc_type.replace('_',' ')}</button>)}</div>
      {r.status==='submitted'&&<div className="flex flex-wrap items-center gap-2"><button className="btn" onClick={()=>act(`/admin/verifications/${r.id}/review`,{decision:'approve'})}>Approve documents</button>
        <input className="input max-w-xs" placeholder="Reason, if rejecting" value={why[r.id]||''} onChange={e=>setWhy({...why,[r.id]:e.target.value})} aria-label="Reject reason"/><button className="text-red-700 underline" onClick={()=>act(`/admin/verifications/${r.id}/review`,{decision:'reject',reason:why[r.id]})}>Reject</button></div>}
      {r.status==='awaiting_payment'&&<p className="text-slate-600">Waiting for the seller to pay TZS {Number(r.fee_tzs).toLocaleString()}.</p>}
      {r.status==='payment_reported'&&<button className="btn" onClick={()=>act(`/admin/verifications/${r.id}/confirm-payment`)}>Confirm payment received ({r.payment_ref||'no reference'})</button>}</div>)}</div>
    :<p className="text-slate-600">No applications waiting.</p>}{m&&<p role="alert" className="mt-2 text-sm text-red-700">{m}</p>}</section>;
}
