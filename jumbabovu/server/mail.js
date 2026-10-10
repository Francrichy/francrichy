import nodemailer from 'nodemailer';
let tr;
export async function sendMail(to,subject,text){
  const{SMTP_HOST:h,SMTP_USER:u,SMTP_PASS:p}=process.env;
  if(!h||!u||!p){console.log(`[email not configured] To: ${to}\nSubject: ${subject}\n${text}`);return false}
  tr=tr||nodemailer.createTransport({host:h,port:+process.env.SMTP_PORT||587,secure:+process.env.SMTP_PORT===465,auth:{user:u,pass:p}});
  await tr.sendMail({from:process.env.MAIL_FROM||u,to,subject,text});return true;
}
