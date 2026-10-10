import express from 'express'; import cors from 'cors'; import path from 'path'; import http from 'http'; import {fileURLToPath} from 'url';
import {migrate} from './db.js'; import routes from './routes.js'; import {initRealtime} from './realtime.js'; import {autoRelease,expireVerifications} from './jobs.js';
const app=express(); app.use(cors()); app.use(express.json());
app.use('/api',routes);
const dist=path.join(path.dirname(fileURLToPath(import.meta.url)),'../client/dist');
app.use(express.static(dist)); app.get('*',(_,res)=>res.sendFile(path.join(dist,'index.html')));
const server=http.createServer(app); initRealtime(server);
migrate().then(()=>server.listen(process.env.PORT||4000,()=>console.log('Server running'))).catch(e=>{console.error(e);process.exit(1)});
setInterval(()=>{autoRelease().catch(console.error);expireVerifications().catch(console.error)},60*60*1000);
