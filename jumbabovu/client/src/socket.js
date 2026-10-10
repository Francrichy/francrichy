import {io} from 'socket.io-client';
let s=null;
export const getSocket=()=>s||(s=io({auth:{token:localStorage.getItem('t')}}));
export const disconnect=()=>{s?.disconnect();s=null};
