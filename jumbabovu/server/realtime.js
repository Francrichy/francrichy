import {Server} from 'socket.io'; import jwt from 'jsonwebtoken'; import {q} from './db.js';
let io;const online=new Map();
export async function notify(userId,type,text,link){
  const[n]=await q('INSERT INTO notifications(user_id,type,text,link) VALUES($1,$2,$3,$4) RETURNING *',[userId,type,text,link]);
  io?.to('u:'+userId).emit('notification',n);
}
const getConv=async(cid,uid)=>(await q('SELECT c.*,e.user_id exporter_user FROM conversations c JOIN exporters e ON e.id=c.exporter_id WHERE c.id=$1 AND (c.buyer_id=$2 OR e.user_id=$2)',[cid,uid]))[0];
export function initRealtime(server){
  io=new Server(server);
  io.use((s,next)=>{try{s.user=jwt.verify(s.handshake.auth.token,process.env.JWT_SECRET||'dev-secret');next()}catch{next(new Error('auth'))}});
  io.on('connection',s=>{
    const id=s.user.id;s.join('u:'+id);
    if(!online.has(id)){online.set(id,0);io.emit('presence',{id,online:true})}online.set(id,online.get(id)+1);
    s.on('online',(_,cb)=>cb?.([...online.keys()]));
    s.on('message',async({conversation_id,body,attachment}={},ack)=>{
      try{body=String(body||'').trim().slice(0,2000);const c=await getConv(conversation_id,id);
        const cn=process.env.CLOUDINARY_CLOUD_NAME;
        const att=attachment&&typeof attachment.url==='string'&&cn&&attachment.url.startsWith(`https://res.cloudinary.com/${cn}/`)&&['image','pdf'].includes(attachment.type)?attachment:null;
        if((!body&&!att)||!c)return ack?.({error:'Message not sent'});
        const[m]=await q('INSERT INTO messages(conversation_id,sender_id,body,attachment_url,attachment_name,attachment_type) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[c.id,id,body,att?.url||null,att?String(att.name||'file').slice(0,120):null,att?.type||null]);
        const to=id===c.buyer_id?c.exporter_user:c.buyer_id;
        io.to('u:'+id).to('u:'+to).emit('message',m);
        await notify(to,'message',`New message from ${s.user.name||'a user'}`,'/messages/'+c.id);
        ack?.({ok:true});
      }catch(e){console.error(e);ack?.({error:'Message not sent'})}});
    s.on('seen',async({conversation_id}={})=>{
      try{const c=await getConv(conversation_id,id);if(!c)return;
        await q('UPDATE messages SET seen=true WHERE conversation_id=$1 AND sender_id<>$2 AND NOT seen',[c.id,id]);
        io.to('u:'+c.buyer_id).to('u:'+c.exporter_user).emit('seen',{conversation_id:c.id,by:id});
      }catch(e){console.error(e)}});
    s.on('disconnect',()=>{const n=(online.get(id)||1)-1;if(n<=0){online.delete(id);io.emit('presence',{id,online:false})}else online.set(id,n)});
  });
}
