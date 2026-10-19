const { chromium } = require("/Users/gokul/Documents/personal/InnovaX/qa-logs/pw/node_modules/playwright-core");
const fs=require("fs");
const OUT="/Users/gokul/Documents/personal/InnovaX/qa-screenshots/ui-overhaul/before";
const WEB="https://janus-three-nu.vercel.app", API="https://janus-api-zrlc.onrender.com";
const STUDENT="cmvf8mmpm0004fx0121e39y2z", ASSET="cmvf90p2v000ah901o3sbgz1q";
fs.mkdirSync(OUT,{recursive:true});
async function api(path,{method="GET",token,body}={}){ const r=await fetch(API+path,{method,headers:{"content-type":"application/json",...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined}); return {status:r.status, body: await r.json().catch(()=>({}))}; }
async function tok(email){ const s=await api("/v1/auth/otp/send",{method:"POST",body:{email}}); const v=await api("/v1/auth/otp/verify",{method:"POST",body:{email,code:"123456"}}); if(v.status!==200) throw new Error("otp "+email+" "+v.status); return v.body.accessToken; }
async function login(ctx,email,token){
 await ctx.addCookies([
  {name:"janus_session",value:token,domain:"janus-three-nu.vercel.app",path:"/",secure:true,httpOnly:true,sameSite:"Lax"},
  {name:"janus_claims",value:encodeURIComponent(JSON.stringify({sub:"qa",email,name:"QA"})),domain:"janus-three-nu.vercel.app",path:"/",secure:true,httpOnly:true,sameSite:"Lax"}
 ]);
}
async function visit(page, ctx, name, path){
 try{ const res=await page.goto(WEB+path,{waitUntil:"networkidle",timeout:60000}); await page.waitForTimeout(900); const txt=(await page.textContent("body"))||""; const bad=/Application error|Unhandled Runtime|Something went wrong/i.test(txt); console.log(`${bad?"ERRORPAGE":"OK"} ${name} ${path} -> ${res.status()} final=${page.url()} len=${txt.length}`); await page.screenshot({path:`${OUT}/${name}.png`,fullPage:true}); }
 catch(e){ console.log(`FAIL ${name} ${path} ${e.message.split("\n")[0]}`); }
}
(async()=>{
 // fresh NDA: recruiter requests, capture waiting, student accepts
 const recTok=await tok("qa.recruiter@janus.test");
 const created=await api("/v1/nda/requests",{method:"POST",token:recTok,body:{studentId:STUDENT}});
 const ndaId=created.body.id; console.log("NDA",created.status,ndaId);
 const browser=await chromium.launch({channel:"chrome",headless:true});
 let ctx=await browser.newContext({viewport:{width:1280,height:860}}); let page=await ctx.newPage();
 await visit(page,ctx,"01-home","/");
 await visit(page,ctx,"02-login","/login");
 await login(ctx,"qa.recruiter@janus.test",recTok);
 await visit(page,ctx,"03-feed","/feed");
 await visit(page,ctx,"04-requests","/requests");
 await visit(page,ctx,"05-talent",`/talent/${STUDENT}`);
 await visit(page,ctx,"06-vault-list",`/vault/${STUDENT}`);
 await visit(page,ctx,"07-vault-viewer",`/vault/${STUDENT}/${ASSET}`);
 await visit(page,ctx,"08-nda-waiting",`/nda/${ndaId}`);
 const stuTok=await tok("qa.student@janus.test");
 const dec=await api(`/v1/nda/requests/${ndaId}/decide`,{method:"POST",token:stuTok,body:{accept:true}}); console.log("decide",dec.status);
 await visit(page,ctx,"09-nda-sign",`/nda/${ndaId}`);
 await visit(page,ctx,"10-notifications","/notifications");
 await visit(page,ctx,"11-onboarding","/onboarding");
 await visit(page,ctx,"12-settings-profile","/settings/profile");
 await visit(page,ctx,"13-docs","/docs");
 await visit(page,ctx,"14-404","/this-page-does-not-exist");
 await visit(page,ctx,"15-restricted","/restricted");
 // sign out via button
 try{ await page.getByRole("button",{name:"Sign out"}).first().click(); await page.waitForURL(/\/login/,{timeout:20000}); }catch{}
 await ctx.close();
 ctx=await browser.newContext({viewport:{width:1280,height:860}}); page=await ctx.newPage();
 const admTok=await tok("qa.admin@janus.test"); await login(ctx,"qa.admin@janus.test",admTok);
 await visit(page,ctx,"16-admin-moderation","/admin/moderation");
 await visit(page,ctx,"17-admin-videos","/admin/videos");
 await visit(page,ctx,"18-admin-users","/admin/users");
 await visit(page,ctx,"19-admin-audit","/admin/audit");
 await browser.close();
 fs.writeFileSync("/Users/gokul/Documents/personal/InnovaX/qa-logs/ui-audit-nda.json", JSON.stringify({ndaId},null,2));
 console.log("DONE", ndaId);
})().catch(e=>{console.error("FATAL",e.message); process.exit(1)});
