import {useEffect,useState} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import {api} from './api.js';
const F=({label,...p})=><label className="block text-sm font-medium">{label}<input className="input mt-1 font-normal" {...p}/></label>;
const Err=({e})=>e?<p role="alert" className="mt-2 text-sm text-red-700">{e}</p>:null;

export function Register({setUser}){
  const nav=useNavigate();const[f,setF]=useState({role:'buyer',accept_terms:false});const[e,setE]=useState('');const[busy,setBusy]=useState(false);
  const set=k=>ev=>setF({...f,[k]:ev.target.value});const seller=f.role==='exporter';
  const go=async ev=>{ev.preventDefault();setE('');setBusy(true);
    try{const d=await api('/auth/register',{method:'POST',body:{...f,country:seller?'Tanzania':f.country}});localStorage.setItem('t',d.token);setUser(d.user);nav('/dashboard')}catch(x){setE(x.message)}setBusy(false)};
  return <main className="mx-auto max-w-md px-4 py-10"><form onSubmit={go} className="card space-y-3"><h1 className="text-2xl font-bold">Create your account</h1>
    <label className="block text-sm font-medium">I want to<select className="input mt-1 font-normal" value={f.role} onChange={set('role')}><option value="buyer">Buy products (Buyer)</option><option value="exporter">Sell products (Seller / Exporter)</option></select></label>
    <F label="Your name" onChange={set('name')} required/><F label="Company name" onChange={set('company')} required/>
    {seller?<F label="City" onChange={set('city')}/>:<F label="Country" onChange={set('country')} required/>}
    <F label="Phone (with country code)" type="tel" placeholder="+255..." onChange={set('phone')} required/>
    <F label="Email" type="email" onChange={set('email')} required/><F label="Password (8 or more characters)" type="password" minLength="8" onChange={set('password')} required/>
    {seller&&<p className="rounded bg-[#FFF3D6] p-2 text-sm">You can start selling right away. Company documents are only needed later if you want the Verified badge.</p>}
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={f.accept_terms} onChange={ev=>setF({...f,accept_terms:ev.target.checked})}/><span>I agree to the <Link to="/terms" target="_blank" className="lnk underline">Terms</Link>, including escrow, fees and disputes.</span></label>
    <button className="btn w-full" disabled={busy}>Create account</button><Err e={e}/></form></main>;
}
export function VerifyBanner(){
  const[m,setM]=useState('');
  return <div className="bg-[#FFF3D6] px-4 py-2 text-center text-sm" role="status">Please verify your email to request quotes, send quotations, chat or pay. <button className="lnk underline" onClick={()=>api('/auth/resend-verification',{method:'POST'}).then(()=>setM('Link sent. Check your inbox.')).catch(x=>setM(x.message))}>Send the link again</button> {m}</div>;
}
export function VerifyEmail({setUser}){
  const[sp]=useSearchParams();const[m,setM]=useState('Checking your link...');
  useEffect(()=>{api('/auth/verify-email',{method:'POST',body:{token:sp.get('token')}}).then(()=>{setM('Your email is verified. Thank you.');setUser(u=>u&&{...u,email_verified:true})}).catch(x=>setM(x.message))},[]);
  return <main className="mx-auto max-w-md px-4 py-10"><div className="card"><h1 className="mb-2 text-xl font-bold">Email verification</h1><p>{m}</p><Link to="/dashboard" className="btn mt-4">Go to dashboard</Link></div></main>;
}
export function Forgot(){
  const[em,setEm]=useState('');const[done,setDone]=useState(false);
  return <main className="mx-auto max-w-md px-4 py-10"><form className="card space-y-3" onSubmit={ev=>{ev.preventDefault();api('/auth/forgot',{method:'POST',body:{email:em}}).then(()=>setDone(true))}}><h1 className="text-2xl font-bold">Forgot your password?</h1>
    {done?<p>If this email is registered, we sent a reset link. It works for 1 hour.</p>:<><F label="Email" type="email" value={em} onChange={e=>setEm(e.target.value)} required/><button className="btn w-full">Send reset link</button></>}</form></main>;
}
export function Reset(){
  const[sp]=useSearchParams();const[pw,setPw]=useState('');const[m,setM]=useState('');const[ok,setOk]=useState(false);
  return <main className="mx-auto max-w-md px-4 py-10"><form className="card space-y-3" onSubmit={ev=>{ev.preventDefault();api('/auth/reset',{method:'POST',body:{token:sp.get('token'),password:pw}}).then(()=>setOk(true)).catch(x=>setM(x.message))}}><h1 className="text-2xl font-bold">Choose a new password</h1>
    {ok?<p>Your password was changed. <Link to="/login" className="lnk underline">Log in</Link></p>:<><F label="New password (8 or more characters)" type="password" minLength="8" value={pw} onChange={e=>setPw(e.target.value)} required/><button className="btn w-full">Change password</button><Err e={m}/></>}</form></main>;
}
export function Terms(){
  const H=({t})=><h2 className="mb-1 mt-5 text-lg font-bold">{t}</h2>;
  return <main className="mx-auto max-w-3xl px-4 py-8"><h1 className="text-2xl font-bold">Terms of use</h1>
    <p className="mt-2 rounded bg-[#FFF3D6] p-3 text-sm">Draft for your lawyer to review and complete before launch. Replace the details in brackets.</p>
    <H t="1. What jumbabovu does"/><p>jumbabovu connects buyers with Tanzanian agricultural exporters. Buyers and sellers make their own sales contracts. jumbabovu provides the marketplace, the escrow payment process and dispute review.</p>
    <H t="2. Escrow"/><p>For orders paid through the platform, the buyer pays into the jumbabovu escrow account or through the online payment option, and never directly to the seller. The seller ships once payment is confirmed. Funds are released to the seller after the buyer confirms delivery, or automatically if the platform's release rule applies, or after a dispute decision.</p>
    <H t="3. Fees"/><p>Buyers pay a transaction and service fee at payment, shown before they pay. Sellers may pay a platform fee and payout fees, shown in their order details. If a buyer pays in a different currency from the quotation, the jumbabovu exchange rate applies, which includes a currency margin. The Verified badge costs TZS 100,000 per year [or the current fee shown in your dashboard].</p>
    <H t="4. Disputes"/><p>A buyer can report a problem while funds are held. The funds stay frozen while jumbabovu reviews the evidence and decides to release, refund or settle partially. Both sides must give honest information.</p>
    <H t="5. Verified badge"/><p>The badge shows that a seller submitted documents that jumbabovu reviewed. It is not a guarantee of quality or performance.</p>
    <H t="6. Your account"/><p>Keep your password private and give accurate company details. We may suspend accounts that break these terms or the law.</p>
    <H t="7. Contact"/><p>[Company name, address, email and phone]</p></main>;
}
