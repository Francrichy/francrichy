import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from './api.js';
const fmt=v=>typeof v==='number'?v.toLocaleString():v;

export function Analytics(){
  const[a,setA]=useState({});useEffect(()=>{api('/analytics').then(setA).catch(()=>{})},[]);
  return <section><h2 className="mb-3 text-xl font-bold">Analytics</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(a).map(([k,v])=><div key={k} className="card"><p className="text-sm text-slate-600">{k}</p><p className="text-2xl font-bold">{fmt(v)}</p></div>)}</div></section>;
}

export function HomeAds({Card}){
  const[ads,setAds]=useState([]);useEffect(()=>{api('/ads/active').then(setAds).catch(()=>{})},[]);
  const ban=ads.find(a=>a.type==='homepage_banner');const fp=ads.filter(a=>a.type==='featured_product'&&a.product_id);const fs=ads.filter(a=>a.type==='featured_supplier');
  if(!ads.length)return null;
  return <section className="mx-auto max-w-6xl space-y-6 px-4 pt-8">
    {ban&&<Link to={`/exporters/${ban.exporter_id}`} className="block rounded-lg bg-nav2 p-6 text-white hover:brightness-110"><span className="text-xs uppercase text-gold">Sponsored</span><p className="text-xl font-bold">{ban.title||ban.company_name}</p><p className="text-sm text-slate-300">{ban.company_name}</p></Link>}
    {fp.length>0&&<div><h2 className="mb-3 text-xl font-bold">Featured products <span className="text-xs font-normal text-slate-500">Sponsored</span></h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{fp.map(a=><Card key={a.id} p={{id:a.product_id,name:a.product_name,category:a.category,moq:a.moq,image_url:a.image_url,company_name:a.company_name,verified:a.verified}}/>)}</div></div>}
    {fs.length>0&&<div><h2 className="mb-3 text-xl font-bold">Featured suppliers <span className="text-xs font-normal text-slate-500">Sponsored</span></h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{fs.map(a=><Link key={a.id} to={`/exporters/${a.exporter_id}`} className="card hover:shadow-md"><h3 className="lnk font-bold">{a.company_name}</h3><p className="text-sm text-slate-600">{a.title}</p></Link>)}</div></div>}</section>;
}

const TYPES={featured_product:'Featured product',featured_supplier:'Featured supplier',homepage_banner:'Homepage banner'};
export function AdsPanel({user}){
  const[ads,setAds]=useState([]);const[mine,setMine]=useState([]);const[f,setF]=useState({type:'featured_product'});const[m,setM]=useState('');const[prices,setPrices]=useState({});
  const load=()=>api('/ads').then(setAds);
  useEffect(()=>{load();if(user.role==='exporter')api('/my/products').then(setMine)},[]);
  const set=k=>e=>setF({...f,[k]:e.target.value});
  const create=async e=>{e.preventDefault();setM('');try{await api('/ads',{method:'POST',body:f});setM('Ad request sent for approval.');load()}catch(x){setM(x.message)}};
  const decide=async(a,status)=>{await api('/ads/'+a.id,{method:'PATCH',body:{status,price:prices[a.id]??a.price}});load()};
  return <section className="card"><h2 className="mb-3 text-xl font-bold">Advertising</h2>
    {user.role==='exporter'&&<form onSubmit={create} className="mb-4 grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-medium">Ad type<select className="input mt-1 font-normal" value={f.type} onChange={set('type')}>{Object.entries(TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      {f.type==='featured_product'&&<label className="block text-sm font-medium">Product<select className="input mt-1 font-normal" value={f.product_id||''} onChange={set('product_id')} required><option value="">Select</option>{mine.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
      <label className="block text-sm font-medium">Headline<input className="input mt-1 font-normal" value={f.title||''} onChange={set('title')}/></label>
      <label className="block text-sm font-medium">Start date<input type="date" className="input mt-1 font-normal" onChange={set('start_date')} required/></label>
      <label className="block text-sm font-medium">End date<input type="date" className="input mt-1 font-normal" onChange={set('end_date')} required/></label>
      <div className="sm:col-span-2"><button className="btn">Request ad</button><span className="ml-3 text-sm">{m}</span></div></form>}
    {ads.length?<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2 pr-4">Type</th><th className="pr-4">Supplier</th><th className="pr-4">Dates</th><th className="pr-4">Price (USD)</th><th className="pr-4">Status</th><th></th></tr></thead>
      <tbody>{ads.map(a=><tr key={a.id} className="border-b align-top"><td className="py-2 pr-4">{TYPES[a.type]}<br/><span className="text-slate-500">{a.title}</span></td><td className="pr-4">{a.company_name}</td><td className="pr-4">{a.start_date?.slice(0,10)} to {a.end_date?.slice(0,10)}</td>
        <td className="pr-4">{user.role==='admin'?<input type="number" min="0" className="input w-24" defaultValue={a.price} onChange={e=>setPrices({...prices,[a.id]:e.target.value})} aria-label="Ad price"/>:Number(a.price)>0?a.price:'Free'}</td><td className="pr-4">{a.status}</td>
        <td>{user.role==='admin'&&a.status==='pending'&&<span className="space-x-2"><button className="lnk" onClick={()=>decide(a,'approved')}>Approve</button><button className="text-red-700 underline" onClick={()=>decide(a,'rejected')}>Reject</button></span>}</td></tr>)}</tbody></table></div>
    :<p className="text-slate-600">No ads yet. Ad pricing is switched off, so approved ads are free until an admin sets a price.</p>}</section>;
}

export function CurrencySelect({value,onChange}){
  const[cs,setCs]=useState([{code:'TZS'}]);useEffect(()=>{api('/currencies').then(setCs).catch(()=>{})},[]);
  return <label className="block text-sm font-medium">Currency<select className="input mt-1 font-normal" value={value} onChange={onChange}>{cs.map(c=><option key={c.code} value={c.code}>{c.code}</option>)}</select></label>;
}

const FIELDS=[['seller_fee_pct','Seller platform fee (%)','Charged to the seller on each sale. Starts at 0.'],['platform_txn_pct','Platform share of the transaction fee (%)','Added to the gateway fee. Buyers see one Transaction and service fee line.'],['gateway_fee_pct','Payment gateway fee (%)','Enter the gateway percentage once you have chosen one.'],['gateway_fee_fixed_tzs','Payment gateway fixed fee (TZS)','Per payment.'],['payout_fee_pct','Seller bank or payout fee (%)','Deducted from the seller payout.'],['payout_fee_fixed_tzs','Seller bank or payout fixed fee (TZS)','Per payout.'],['fx_markup_pct','Exchange rate markup (%)','Added when a buyer pays in a different currency from the quotation.'],['verified_fee_tzs','Verified badge fee per year (TZS)','Charged to sellers after their documents are approved. Starts at 100,000.'],['auto_confirm_days','Auto-confirm delivery after (days)','Automatic release mode only: days after shipping with no dispute.']];
export function SettingsPanel(){
  const[d,setD]=useState(null);const[m,setM]=useState('');
  useEffect(()=>{api('/admin/settings').then(setD)},[]);
  if(!d)return null;
  const set=(k,v)=>setD({...d,settings:{...d.settings,[k]:v}});
  const setCur=(code,k,v)=>setD({...d,currencies:d.currencies.map(c=>c.code===code?{...c,[k]:v}:c)});
  const save=async()=>{setM('');try{await api('/admin/settings',{method:'PUT',body:d.settings});for(const c of d.currencies.filter(c=>c.code!=='TZS'))await api('/admin/currencies/'+c.code,{method:'PUT',body:{rate_to_tzs:c.rate_to_tzs,active:c.active}});setM('Saved. New values apply to new payments.')}catch(x){setM(x.message)}};
  return <section className="card"><h2 className="mb-1 text-xl font-bold">Fees, currencies and release rules</h2><p className="mb-4 text-sm text-slate-600">All amounts are in TZS unless stated. Changes apply to payments reported after you save.</p>
    <div className="grid gap-4 sm:grid-cols-2">{FIELDS.map(([k,l,h])=><label key={k} className="block text-sm font-medium">{l}<input type="number" min="0" step="any" className="input mt-1 font-normal" value={d.settings[k]??''} onChange={e=>set(k,e.target.value)}/><span className="text-xs font-normal text-slate-500">{h}</span></label>)}
      <label className="block text-sm font-medium">Escrow release<select className="input mt-1 font-normal" value={d.settings.release_mode} onChange={e=>set('release_mode',e.target.value)}><option value="manual">Manual: admin approves every release</option><option value="auto">Automatic: release after delivery is confirmed</option></select><span className="text-xs font-normal text-slate-500">Disputed orders are never released automatically.</span></label></div>
    <h3 className="mb-2 mt-6 font-bold">Currencies and our exchange rates</h3><p className="mb-2 text-sm text-slate-600">Enter how many TZS equal 1 unit of the currency (before markup), then tick Active to offer it.</p>
    <div className="space-y-2">{d.currencies.map(c=><div key={c.code} className="flex flex-wrap items-center gap-3 text-sm"><b className="w-12">{c.code}</b><span className="w-40">{c.name}</span>{c.code==='TZS'?<span className="text-slate-500">Base currency</span>:<><input type="number" min="0" step="any" className="input w-32" value={c.rate_to_tzs} onChange={e=>setCur(c.code,'rate_to_tzs',e.target.value)} aria-label={c.code+' rate in TZS'}/><label><input type="checkbox" checked={c.active} onChange={e=>setCur(c.code,'active',e.target.checked)}/> Active</label></>}</div>)}</div>
    <div className="mt-5"><button className="btn" onClick={save}>Save settings</button><span className="ml-3 text-sm" role="status">{m}</span></div></section>;
}
