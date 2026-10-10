import {api} from './api.js';
// Signed direct upload to Cloudinary. Images up to 5 MB, PDFs up to 10 MB. kind 'doc' uploads privately (authenticated).
export async function uploadFile(file,kind='chat'){
  const pdf=file.type==='application/pdf';
  if(!pdf&&!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Please choose a JPG, PNG, WEBP or PDF file');
  if(file.size>(pdf?10:5)*1024*1024)throw new Error(`The file is too large (maximum ${pdf?10:5} MB)`);
  const s=await api('/uploads/sign',{method:'POST',body:{kind}});
  const fd=new FormData();fd.append('file',file);fd.append('api_key',s.api_key);fd.append('timestamp',s.timestamp);fd.append('signature',s.signature);fd.append('folder',s.folder);if(s.type)fd.append('type',s.type);
  const res=await fetch(`https://api.cloudinary.com/v1_1/${s.cloud_name}/${pdf?'raw':'image'}/upload`,{method:'POST',body:fd});
  const d=await res.json();if(!res.ok)throw new Error(d.error?.message||'Upload failed');
  return{url:d.secure_url,name:file.name,type:pdf?'pdf':'image',public_id:d.public_id,resource_type:pdf?'raw':'image',format:d.format};
}
