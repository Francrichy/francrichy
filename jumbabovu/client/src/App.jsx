import {useEffect,useState} from 'react';
import {Link,Route,Routes,useNavigate,useParams,useSearchParams,Navigate} from 'react-router-dom';
import {api} from './api.js';
import {Bell,ChatBtn,Messages} from './Chat.jsx';
import {disconnect} from './socket.js';
import Orders from './Orders.jsx';
import {uploadFile} from './upload.js';
import {Register,VerifyBanner,VerifyEmail,Forgot,Reset,Terms} from './AuthPages.jsx';
import {ProfilePanel,VerifyPanel,VerificationAdmin} from './Verify.jsx';
import {Analytics,AdsPanel,HomeAds,SettingsPanel,CurrencySelect} from './Extras.jsx';

const Badge=()=><span className="ml-2 rounded bg-[#FFF3D6] px-2 py-0.5 text-xs font-medium text-[#B12704]">Verified</span>;
const Err=({e})=>e?<p role="alert" className="mt-2 text-sm text-red-700">{e}</p>:null;
const F=({label,...p})=><label className="block text-sm font-medium">{label}<input className="input mt-1 font-normal" {...p}/></label>;

const Ph=({name})=><div className="flex h-full w-full items-center justify-center bg-slate-100 text-5xl font-bold text-slate-300">{(name||'?')[0]}</div>;

function Nav({user,setUser}){
  const nav=useNavigate();const[s,setS]=useState('');const[cats,setCats]=useState([]);
  useEffect(()=>{api('/categories').then(setCats).catch(()=>{})},[]);
  const go=e=>{e.preventDefault();nav('/products?q='+encodeURIComponent(s))};
  const hi='rounded border border-transparent px-2 py-1 text-xs leading-tight hover:border-white';
  return <header className="text-white"><div className="flex flex-wrap items-center gap-3 bg-nav px-4 py-2">
    <Link to="/" className="rounded border border-transparent px-2 py-1 text-2xl font-bold hover:border-white">jumbabovu<span className="text-gold">.</span></Link>
    <form onSubmit={go} className="flex min-w-[220px] flex-1"><input value={s} onChange={e=>setS(e.target.value)} placeholder="Search sesame, coffee, cashew" aria-label="Search products" className="w-full rounded-l-md px-3 py-2 text-ink focus:outline focus:outline-2 focus:outline-gold"/><button className="rounded-r-md bg-gold px-5 font-medium text-ink hover:brightness-95">Search</button></form>
    {user?<><Bell/>{user.role!=='admin'&&<Link to="/messages" className={hi}><b className="text-sm">Messages</b></Link>}<Link to="/orders" className={hi}><b className="text-sm">Orders</b></Link><Link to="/dashboard" className={hi}>Hello, {(user.name||'there').split(' ')[0]}<br/><b className="text-sm">Dashboard</b></Link><button onClick={()=>{localStorage.removeItem('t');disconnect();setUser(null);nav('/')}} className={hi}>Log out</button></>
    :<><Link to="/login" className={hi}>Hello, sign in<br/><b className="text-sm">Account</b></Link><Link to="/register" className={hi}><b className="text-sm">Register</b></Link></>}
  </div><nav className="flex gap-5 overflow-x-auto whitespace-nowrap bg-nav2 px-4 py-2 text-sm"><Link to="/products" className="font-bold hover:underline">All products</Link><Link to="/exporters" className="hover:underline">Exporters</Link>
    {cats.slice(0,6).map(c=><Link key={c.id} to={`/products?category=${c.id}`} className="hover:underline">{c.name}</Link>)}</nav></header>;
}

function ProductCard({p}){return <Link to={`/products/${p.id}`} className="card block hover:shadow-md">
  <div className="mb-3 h-40 overflow-hidden rounded bg-white">{p.image_url?<img src={p.image_url} alt={p.name} className="h-full w-full object-contain"/>:<Ph name={p.name}/>}</div>
  <h3 className="lnk font-medium">{p.name}</h3><p className="text-sm text-slate-600">{p.category} · MOQ {p.moq||'on request'}</p>
  <p className="mt-1 text-sm">{p.company_name}{p.verified&&<Badge/>}</p></Link>}

function Home(){
  const[ps,setPs]=useState([]);const[cats,setCats]=useState([]);
  useEffect(()=>{api('/products').then(d=>setPs(d.slice(0,8)));api('/categories').then(setCats)},[]);
  return <>
    <section className="bg-white px-4 py-12"><div className="mx-auto max-w-6xl">
      <h1 className="max-w-2xl text-3xl font-bold leading-tight md:text-4xl">Buy agricultural products directly from trusted Tanzanian exporters</h1>
      <p className="mt-3 max-w-xl text-slate-600">Compare suppliers of sesame, cashew, coffee, avocados and more. Request a quote and agree terms in one place.</p>
      <div className="mt-6 flex gap-3"><Link to="/products" className="btn">Find products</Link><Link to="/exporters" className="btn-gold">Find suppliers</Link></div></div></section>
    <HomeAds Card={ProductCard}/>
    <section className="mx-auto max-w-6xl px-4 py-8"><h2 className="mb-4 text-xl font-bold">Shop by category</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cats.slice(0,8).map(c=><Link key={c.id} to={`/products?category=${c.id}`} className="card hover:shadow-md"><h3 className="font-bold">{c.name}</h3><p className="lnk mt-6 text-sm">See suppliers</p></Link>)}</div></section>
    <section className="mx-auto max-w-6xl px-4 pb-8"><div className="grid gap-4 md:grid-cols-3">{[['Verified exporters','Suppliers checked by our team carry a Verified badge.'],['Direct quotes','Send a request for quotation and compare replies.'],['Clear terms','Quote on terms like FOB Dar es Salaam.']].map(([t,d])=><div key={t} className="card"><h3 className="font-bold">{t}</h3><p className="text-sm text-slate-600">{d}</p></div>)}</div></section>
    <section className="mx-auto max-w-6xl px-4 pb-10"><h2 className="mb-4 text-xl font-bold">Latest listings</h2>
      {ps.length?<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{ps.map(p=><ProductCard key={p.id} p={p}/>)}</div>:<p className="text-slate-600">No listings yet. Exporters can register and add the first product.</p>}</section>
    <section className="bg-nav2 px-4 py-10 text-center text-white"><h2 className="text-2xl font-bold">Export from Tanzania? Sell to buyers worldwide</h2><p className="mt-2 text-slate-300">Create your company profile, list your products and answer quote requests.</p><Link to="/register" className="btn-gold mt-5">Register as an exporter</Link></section></>;
}

function Products(){
  const[sp,setSp]=useSearchParams();const s=sp.get('q')||'';const c=sp.get('category')||'';
  const[ps,setPs]=useState([]);const[cats,setCats]=useState([]);
  const upd=(k,v)=>{const n=new URLSearchParams(sp);v?n.set(k,v):n.delete(k);setSp(n,{replace:true})};
  useEffect(()=>{api('/categories').then(setCats)},[]);
  useEffect(()=>{const t=setTimeout(()=>api(`/products?q=${encodeURIComponent(s)}&category=${c}`).then(setPs),250);return()=>clearTimeout(t)},[s,c]);
  return <main className="mx-auto max-w-6xl px-4 py-8"><h1 className="mb-4 text-2xl font-bold">Products</h1>
    <div className="mb-6 flex flex-wrap gap-3"><input className="input max-w-sm" placeholder="Search products" value={s} onChange={e=>upd('q',e.target.value)} aria-label="Search products"/>
      <select className="input max-w-xs" value={c} onChange={e=>upd('category',e.target.value)} aria-label="Category"><option value="">All categories</option>{cats.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
    {ps.length?<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{ps.map(p=><ProductCard key={p.id} p={p}/>)}</div>:<p>No products match. Try another search or category.</p>}</main>;
}

function Product({user}){
  const{id}=useParams();const[p,setP]=useState(null);const[f,setF]=useState({quantity:'',destination:'',target_price:'',notes:''});const[msg,setMsg]=useState('');const[e,setE]=useState('');
  useEffect(()=>{api('/products/'+id).then(setP).catch(x=>setE(x.message))},[id]);
  if(!p)return <main className="p-8"><Err e={e}/></main>;
  const set=k=>ev=>setF({...f,[k]:ev.target.value});
  const send=async ev=>{ev.preventDefault();setE('');try{await api('/rfqs',{method:'POST',body:{...f,product_id:p.id}});setMsg('Quote request sent. Track replies in your dashboard.')}catch(x){setE(x.message)}};
  const rows=[['Category',p.category],['Minimum order',p.moq],['Supply capacity',p.capacity],['Origin',p.origin],['Packaging',p.packaging]];
  return <main className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-2">
    <div><div className="mb-4 h-72 overflow-hidden rounded bg-white">{p.image_url?<img src={p.image_url} alt={p.name} className="h-full w-full object-contain"/>:<Ph name={p.name}/>}</div>
      <h1 className="text-3xl font-bold">{p.name}</h1><p className="mt-2 text-slate-700">{p.description}</p>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">{rows.map(([k,v])=><div key={k}><dt className="text-slate-500">{k}</dt><dd>{v||'On request'}</dd></div>)}</dl>
      <Link to={`/exporters/${p.exporter_id}`} className="mt-4 inline-block text-brand underline">{p.company_name}{p.city&&`, ${p.city}`}</Link>{p.verified&&<Badge/>}<ChatBtn user={user} eid={p.exporter_id}/></div>
    <div className="card h-fit"><h2 className="mb-3 text-xl font-bold">Request a quote</h2>
      {!user?<p><Link to="/login" className="text-brand underline">Log in</Link> or <Link to="/register" className="text-brand underline">register as a buyer</Link> to request a quote.</p>
      :user.role!=='buyer'?<p className="text-slate-600">Only buyer accounts can request quotes.</p>
      :msg?<p className="text-green-800">{msg}</p>
      :<form onSubmit={send} className="space-y-3"><F label="Quantity (e.g. 50 MT)" value={f.quantity} onChange={set('quantity')} required/><F label="Destination port or country" value={f.destination} onChange={set('destination')}/><F label="Target price (optional)" value={f.target_price} onChange={set('target_price')}/>
        <label className="block text-sm font-medium">Notes<textarea className="input mt-1 font-normal" rows="3" value={f.notes} onChange={set('notes')}/></label><button className="btn">Send quote request</button><Err e={e}/></form>}</div></main>;
}

function Exporters(){const[xs,setXs]=useState([]);useEffect(()=>{api('/exporters').then(setXs)},[]);
  return <main className="mx-auto max-w-6xl px-4 py-8"><h1 className="mb-4 text-3xl font-bold">Exporters</h1>
    {xs.length?<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{xs.map(x=><Link key={x.id} to={`/exporters/${x.id}`} className="card hover:shadow-lg"><h3 className="font-bold">{x.company_name}{x.verified&&<Badge/>}</h3><p className="text-sm text-slate-600">{x.city||'Tanzania'} · {x.products} products{x.rating&&` · ★ ${x.rating}`}</p></Link>)}</div>:<p>No exporters registered yet.</p>}</main>}

function Exporter({user}){const{id}=useParams();const[x,setX]=useState(null);useEffect(()=>{api('/exporters/'+id).then(setX)},[id]);
  if(!x)return null;
  return <main className="mx-auto max-w-6xl px-4 py-8"><h1 className="text-3xl font-bold">{x.company_name}{x.verified&&<Badge/>}</h1><p className="text-slate-600">{x.city||'Tanzania'}{x.rating?.n>0&&` · ★ ${x.rating.a} (${x.rating.n} reviews)`}</p><p className="mt-3 max-w-2xl">{x.about}</p><ChatBtn user={user} eid={x.id}/>
    <h2 className="mb-4 mt-8 text-2xl font-bold">Products</h2>{x.products.length?<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{x.products.map(p=><ProductCard key={p.id} p={{...p,company_name:x.company_name,verified:x.verified}}/>)}</div>:<p>No active products.</p>}<h2 className="mb-3 mt-8 text-2xl font-bold">Buyer reviews</h2>{x.reviews?.length?x.reviews.map((v,i)=><div key={i} className="card mb-3"><b>{'★'.repeat(v.rating)}{'☆'.repeat(5-v.rating)}</b> <span className="text-sm text-slate-600">{v.buyer_name}</span><p>{v.comment}</p></div>):<p className="text-slate-600">No reviews yet.</p>}</main>}

function Auth({mode,setUser}){
  const nav=useNavigate();const reg=mode==='register';const[f,setF]=useState({role:'buyer'});const[e,setE]=useState('');const set=k=>ev=>setF({...f,[k]:ev.target.value});
  const go=async ev=>{ev.preventDefault();setE('');try{const d=await api(reg?'/auth/register':'/auth/login',{method:'POST',body:f});localStorage.setItem('t',d.token);setUser(d.user);nav('/dashboard')}catch(x){setE(x.message)}};
  return <main className="mx-auto max-w-md px-4 py-10"><form onSubmit={go} className="card space-y-3"><h1 className="text-2xl font-bold">{reg?'Create your account':'Log in'}</h1>
    {reg&&<label className="block text-sm font-medium">I am a<select className="input mt-1 font-normal" value={f.role} onChange={set('role')}><option value="buyer">Buyer</option><option value="exporter">Exporter</option></select></label>}
    {reg&&<F label="Your name" onChange={set('name')}/>}{reg&&f.role==='exporter'&&<><F label="Company name" onChange={set('company')} required/><F label="City" onChange={set('city')}/></>}
    <F label="Email" type="email" onChange={set('email')} required/><F label="Password" type="password" minLength="6" onChange={set('password')} required/>
    <button className="btn w-full">{reg?'Register':'Log in'}</button>{!reg&&<Link to="/forgot-password" className="lnk block text-center text-sm">Forgot your password?</Link>}<Err e={e}/></form></main>;
}

function Table({rows,cols,empty}){return rows.length?<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b">{cols.map(c=><th key={c[0]} className="py-2 pr-4">{c[0]}</th>)}</tr></thead>
  <tbody>{rows.map((r,i)=><tr key={i} className="border-b align-top">{cols.map(c=><td key={c[0]} className="py-2 pr-4">{c[1](r)}</td>)}</tr>)}</tbody></table></div>:<p className="text-slate-600">{empty}</p>}

function QuoteForm({rfq,done}){const[f,setF]=useState({unit_price:'',total_amount:'',currency:'TZS',quantity:rfq.quantity,delivery_terms:'FOB Dar es Salaam',valid_until:'',notes:''});const[e,setE]=useState('');const set=k=>ev=>setF({...f,[k]:ev.target.value});
  const go=async ev=>{ev.preventDefault();try{await api(`/rfqs/${rfq.id}/quotations`,{method:'POST',body:f});done()}catch(x){setE(x.message)}};
  return <form onSubmit={go} className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-2"><F label="Unit price (e.g. USD 1,200/MT)" value={f.unit_price} onChange={set('unit_price')} required/><F label="Quantity" value={f.quantity} onChange={set('quantity')} required/><F label="Total amount" type="number" min="1" step="any" value={f.total_amount} onChange={set('total_amount')} required/><CurrencySelect value={f.currency} onChange={set('currency')}/><F label="Delivery terms" value={f.delivery_terms} onChange={set('delivery_terms')}/><F label="Valid until" type="date" value={f.valid_until} onChange={set('valid_until')}/><div className="sm:col-span-2"><button className="btn">Send quotation</button><Err e={e}/></div></form>}

function Dashboard({user}){
  const[rfqs,setRfqs]=useState([]);const[qts,setQts]=useState([]);const[xs,setXs]=useState([]);const[cats,setCats]=useState([]);const[open,setOpen]=useState(null);const[stats,setStats]=useState({});const nav=useNavigate();const[p,setP]=useState({});const[m,setM]=useState('');
  const load=()=>{if(user.role!=='admin'){api('/rfqs').then(setRfqs);api('/quotations').then(setQts)}else api('/exporters').then(setXs)};
  useEffect(()=>{load();api('/categories').then(setCats);api('/stats').then(setStats)},[]);
  if(!user)return <Navigate to="/login"/>;
  const decide=async(id,status)=>{await api('/quotations/'+id,{method:'PATCH',body:{status}});status==='accepted'?nav('/orders'):load()};
  const verify=async(x)=>{await api(`/exporters/${x.id}/verify`,{method:'PATCH',body:{verified:!x.verified}});load()};
  const add=async ev=>{ev.preventDefault();setM('');try{await api('/products',{method:'POST',body:p});setM('Product listed.');setP({})}catch(x){setM(x.message)}};
  const set=k=>ev=>setP({...p,[k]:ev.target.value});
  return <main className="mx-auto max-w-6xl space-y-8 px-4 py-8"><h1 className="text-3xl font-bold">Welcome, {user.name||user.email}</h1>
    {user.role!=='buyer'&&<Analytics/>}<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(stats).map(([k,v])=><div key={k} className="card"><p className="text-sm text-slate-600">{k}</p><p className="text-3xl font-bold">{v}</p></div>)}</div>
    {user.role==='admin'&&<section className="card"><h2 className="mb-3 font-bold">Exporters</h2><Table rows={xs} empty="No exporters yet." cols={[['Company',x=>x.company_name],['City',x=>x.city],['Status',x=>x.verified?'Verified':'Unverified'],['',x=><button className="text-brand underline" onClick={()=>verify(x)}>{x.verified?'Remove badge':'Verify'}</button>]]}/></section>}
    {user.role==='exporter'&&<section className="card"><h2 className="mb-3 font-bold">Add a product</h2><form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
      <F label="Product name" value={p.name||''} onChange={set('name')} required/><label className="block text-sm font-medium">Category<select className="input mt-1 font-normal" value={p.category_id||''} onChange={set('category_id')}><option value="">Select</option>{cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <F label="Minimum order (MOQ)" value={p.moq||''} onChange={set('moq')}/><F label="Supply capacity" value={p.capacity||''} onChange={set('capacity')}/><F label="Origin region" value={p.origin||''} onChange={set('origin')}/><F label="Packaging" value={p.packaging||''} onChange={set('packaging')}/>
      <div><F label="Image URL" value={p.image_url||''} onChange={set('image_url')}/><label className="mt-1 block text-sm">or upload a photo<input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block" onChange={async e=>{const f=e.target.files[0];if(!f)return;try{const a=await uploadFile(f,'product');setP({...p,image_url:a.url});setM('Photo uploaded.')}catch(x){setM(x.message)}}}/></label></div><label className="block text-sm font-medium sm:col-span-2">Description<textarea className="input mt-1 font-normal" rows="3" value={p.description||''} onChange={set('description')}/></label>
      <div className="sm:col-span-2"><button className="btn">List product</button><span className="ml-3 text-sm">{m}</span></div></form></section>}
    {user.role!=='admin'&&<><section className="card"><h2 className="mb-3 font-bold">{user.role==='buyer'?'My quote requests':'Incoming RFQs'}</h2>
      <Table rows={rfqs} empty={user.role==='buyer'?'No requests yet. Open a product and select Request a quote.':'No RFQs yet.'} cols={[['Product',r=>r.product],[user.role==='buyer'?'Supplier':'Buyer',r=>user.role==='buyer'?r.company_name:r.buyer_name],['Quantity',r=>r.quantity],['Destination',r=>r.destination],['Target',r=>r.target_price],['Notes',r=>r.notes],
        ['',r=>user.role==='exporter'&&<div><button className="text-brand underline" onClick={()=>setOpen(open===r.id?null:r.id)}>Quote</button>{open===r.id&&<QuoteForm rfq={r} done={()=>{setOpen(null);load()}}/>}</div>]]}/></section>
      <section className="card"><h2 className="mb-3 font-bold">Quotations</h2><Table rows={qts} empty="No quotations yet." cols={[['Product',x=>x.product],['Supplier',x=>x.company_name],['Price',x=>x.unit_price],['Qty',x=>x.quantity],['Terms',x=>x.delivery_terms],['Valid until',x=>x.valid_until?.slice(0,10)],['Status',x=>x.status],
        ['',x=>user.role==='buyer'&&x.status==='sent'&&<span className="space-x-2"><button className="text-brand underline" onClick={()=>decide(x.id,'accepted')}>Accept</button><button className="text-red-700 underline" onClick={()=>decide(x.id,'rejected')}>Reject</button></span>]]}/></section></>}{user.role==='exporter'&&<><ProfilePanel/><VerifyPanel/></>}{user.role==='admin'&&<><VerificationAdmin/><SettingsPanel/></>}{user.role!=='buyer'&&<AdsPanel user={user}/>}</main>;
}

export default function App(){
  const[user,setUser]=useState(null);const[ready,setReady]=useState(false);
  useEffect(()=>{localStorage.getItem('t')?api('/auth/me').then(setUser).catch(()=>localStorage.removeItem('t')).finally(()=>setReady(true)):setReady(true)},[]);
  if(!ready)return null;
  return <><Nav user={user} setUser={setUser}/>{user&&!user.email_verified&&<VerifyBanner/>}<Routes>
    <Route path="/" element={<Home/>}/><Route path="/products" element={<Products/>}/><Route path="/products/:id" element={<Product user={user}/>}/>
    <Route path="/exporters" element={<Exporters/>}/><Route path="/exporters/:id" element={<Exporter user={user}/>}/><Route path="/orders" element={user?<Orders user={user}/>:<Navigate to="/login"/>}/><Route path="/messages" element={user?<Messages user={user}/>:<Navigate to="/login"/>}/><Route path="/messages/:id" element={user?<Messages user={user}/>:<Navigate to="/login"/>}/>
    <Route path="/login" element={<Auth mode="login" setUser={setUser}/>}/><Route path="/register" element={<Register setUser={setUser}/>}/><Route path="/forgot-password" element={<Forgot/>}/><Route path="/reset-password" element={<Reset/>}/><Route path="/verify-email" element={<VerifyEmail setUser={setUser}/>}/><Route path="/terms" element={<Terms/>}/>
    <Route path="/dashboard" element={user?<Dashboard user={user}/>:<Navigate to="/login"/>}/></Routes>
    <footer className="bg-nav px-4 py-8 text-center text-sm text-slate-300">jumbabovu · Tanzanian agricultural exporters · <Link to="/terms" className="underline">Terms</Link></footer></>;
}
