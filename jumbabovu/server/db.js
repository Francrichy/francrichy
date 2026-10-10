import pg from 'pg'; import fs from 'fs'; import bcrypt from 'bcryptjs';
const url=process.env.DATABASE_URL;
export const pool=new pg.Pool({connectionString:url,ssl:url&&!url.includes('localhost')?{rejectUnauthorized:false}:false});
export const q=(t,p)=>pool.query(t,p).then(r=>r.rows);
export async function migrate(){
  await pool.query(fs.readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
  const{ADMIN_EMAIL:e,ADMIN_PASSWORD:p}=process.env;
  if(e&&p)await pool.query("INSERT INTO users(email,password_hash,role,name,email_verified) VALUES(lower($1),$2,'admin','Admin',true) ON CONFLICT DO NOTHING",[e,await bcrypt.hash(p,10)]);
  await pool.query("UPDATE users SET email_verified=true WHERE role='admin'");
}
