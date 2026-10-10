export const api=async(path,{method='GET',body}={})=>{
  const t=localStorage.getItem('t');
  const res=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json',...(t&&{Authorization:'Bearer '+t})},body:body&&JSON.stringify(body)});
  const d=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(d.error||'Something went wrong');
  return d;
};
