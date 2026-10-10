import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useParams} from 'react-router-dom';
import {api} from './api.js';
import {getSocket} from './socket.js';
import {uploadFile} from './upload.js';

export function Bell(){
  const nav=useNavigate();const[d,setD]=useState({items:[],unread:0});const[open,setOpen]=useState(false);
  const load=()=>api('/notifications').then(setD).catch(()=>{});
  useEffect(()=>{load();const s=getSocket();s.on('notification',load);return()=>s.off('notification',load)},[]);
  const toggle=async()=>{setOpen(!open);if(!open&&d.unread){await api('/notifications/read',{method:'POST'});setD({...d,unread:0})}};
  return <div className="relative"><button onClick={toggle} aria-label={`Notifications, ${d.unread} unread`} className="flex items-center gap-1 rounded border border-transparent px-2 py-1 hover:border-white">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg>
    {d.unread>0&&<span className="rounded-full bg-gold px-1.5 text-xs font-bold text-ink">{d.unread}</span>}</button>
    {open&&<div className="absolute right-0 z-20 mt-1 w-72 rounded bg-white p-2 text-sm text-ink shadow-lg">{d.items.length?d.items.map(n=><button key={n.id} onClick={()=>{setOpen(false);nav(n.link||'/dashboard')}} className="block w-full rounded p-2 text-left hover:bg-slate-100">{n.text}<span className="block text-xs text-slate-500">{new Date(n.created_at).toLocaleString()}</span></button>):<p className="p-2">No notifications yet.</p>}</div>}</div>;
}

export const ChatBtn=({user,eid})=>{
  const nav=useNavigate();if(user?.role!=='buyer')return null;
  return <button className="btn-gold mt-3 block" onClick={async()=>nav('/messages/'+(await api('/conversations',{method:'POST',body:{exporter_id:eid}})).id)}>Chat with supplier</button>;
};

export function Messages({user}){
  const{id}=useParams();const[convs,setConvs]=useState([]);const[msgs,setMsgs]=useState([]);const[text,setText]=useState('');const[online,setOnline]=useState(new Set());const[busy,setBusy]=useState('');const end=useRef();
  const cur=convs.find(c=>String(c.id)===id);const loadConvs=()=>api('/conversations').then(setConvs);
  useEffect(()=>{loadConvs();const s=getSocket();s.emit('online',null,l=>setOnline(new Set(l)));
    const pres=p=>setOnline(o=>{const n=new Set(o);p.online?n.add(p.id):n.delete(p.id);return n});s.on('presence',pres);return()=>s.off('presence',pres)},[]);
  useEffect(()=>{setMsgs([]);if(!id)return;const s=getSocket();
    api(`/conversations/${id}/messages`).then(m=>{setMsgs(m);s.emit('seen',{conversation_id:+id});loadConvs()});
    const onMsg=m=>{if(String(m.conversation_id)===id){setMsgs(x=>[...x,m]);if(m.sender_id!==user.id)s.emit('seen',{conversation_id:+id})}loadConvs()};
    const onSeen=e=>{if(String(e.conversation_id)===id&&e.by!==user.id)setMsgs(x=>x.map(m=>m.sender_id===user.id?{...m,seen:true}:m))};
    s.on('message',onMsg);s.on('seen',onSeen);return()=>{s.off('message',onMsg);s.off('seen',onSeen)}},[id]);
  useEffect(()=>{end.current?.scrollIntoView({block:'end'})},[msgs]);
  const send=e=>{e.preventDefault();if(!text.trim())return;getSocket().emit('message',{conversation_id:+id,body:text},r=>r?.error&&alert(r.error));setText('')};
  const attach=async ev=>{const f=ev.target.files[0];ev.target.value='';if(!f)return;setBusy('Uploading...');try{const a=await uploadFile(f);getSocket().emit('message',{conversation_id:+id,body:text,attachment:a},r=>r?.error&&alert(r.error));setText('')}catch(x){alert(x.message)}setBusy('')};
  const lastMine=[...msgs].reverse().find(m=>m.sender_id===user.id);
  return <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6 md:grid-cols-3"><aside className="card p-0 md:col-span-1"><h1 className="border-b p-4 text-lg font-bold">Messages</h1>
    {convs.length?convs.map(c=><Link key={c.id} to={'/messages/'+c.id} className={'flex items-center gap-2 border-b p-3 hover:bg-slate-50 '+(String(c.id)===id?'bg-slate-100':'')}>
      <span aria-label={online.has(c.other_id)?'Online':'Offline'} className={'h-2.5 w-2.5 rounded-full '+(online.has(c.other_id)?'bg-green-600':'bg-slate-300')}/>
      <span className="min-w-0 flex-1"><b className="block truncate text-sm">{c.other_name}</b><span className="block truncate text-xs text-slate-500">{c.last||'No messages yet'}</span></span>
      {c.unread>0&&<span className="rounded-full bg-gold px-2 text-xs font-bold">{c.unread}</span>}</Link>)
    :<p className="p-4 text-sm text-slate-600">{user.role==='buyer'?'No conversations yet. Open a supplier and choose Chat with supplier.':'No conversations yet. Buyers will appear here when they message you.'}</p>}</aside>
    <section className="card flex h-[70vh] flex-col p-0 md:col-span-2">{!id?<p className="m-auto text-slate-500">Select a conversation</p>:<>
      <div className="border-b p-4"><b>{cur?.other_name}</b><span className="ml-2 text-xs text-slate-500">{online.has(cur?.other_id)?'Online':'Offline'}</span></div>
      <div className="flex-1 space-y-2 overflow-y-auto bg-paper p-4">{msgs.map(m=><div key={m.id} className={'flex '+(m.sender_id===user.id?'justify-end':'')}>
        <div className={'max-w-[75%] rounded-lg px-3 py-2 text-sm '+(m.sender_id===user.id?'bg-[#FFF3D6]':'bg-white')}>{m.attachment_type==='image'&&<a href={m.attachment_url} target="_blank" rel="noreferrer"><img src={m.attachment_url} alt={m.attachment_name||'Image'} className="mb-1 max-h-48 rounded"/></a>}{m.attachment_type==='pdf'&&<a href={m.attachment_url} target="_blank" rel="noreferrer" className="lnk mb-1 block">PDF: {m.attachment_name}</a>}{m.body}<span className="mt-1 block text-[10px] text-slate-500">{new Date(m.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}{m===lastMine&&m.seen&&' · Seen'}</span></div></div>)}<div ref={end}/></div>
      <form onSubmit={send} className="flex gap-2 border-t p-3"><label className="btn-gold cursor-pointer">Attach<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={attach}/></label><input className="input" value={text} onChange={e=>setText(e.target.value)} placeholder="Type a message" aria-label="Message"/><button className="btn">Send</button>{busy&&<span className="self-center text-xs" role="status">{busy}</span>}</form></>}</section></main>;
}
