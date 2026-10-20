const { chromium } = require("/Users/gokul/Documents/personal/InnovaX/qa-logs/pw/node_modules/playwright-core");
const fs=require("fs");
const OUT="/Users/gokul/Documents/personal/InnovaX/qa-screenshots/ui-overhaul/after";
const WEB="https://janus-three-nu.vercel.app", API="https://janus-api-zrlc.onrender.com";
const STUDENT="cmvf8mmpm0004fx0121e39y2z", ASSET="cmvf90p2v000ah901o3sbgz1q";
const { ndaId } = JSON.parse(fs.readFileSync("/Users/gokul/Documents/personal/InnovaX/qa-logs/ui-audit-nda.json","utf8"));
fs.mkdirSync(OUT,{recursive:true});
async function api(path,{method="GET",token,body}={}){ const r=await fetch(API+path,{method,headers:{"content-type":"application/json",...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined}); return {status:r.status, body: await r.json().catch(()=>({}))}; }
async function tok(email){ await api("/v1/auth/otp/send",{method:"POST",body:{email}}); const v=await api("/v1/auth/otp/verify",{method:"POST",body:{email,code:"123456"}}); if(v.status!==200) throw new Error("otp "+email+" "+v.status); return v.body.accessToken; }
async function auth(ctx,email,token){ await ctx.addCookies([
 {name:"janus_session",value:token,domain:"janus-three-nu.vercel.app",path:"/",secure:true,httpOnly:true,sameSite:"Lax"},
 {name:"janus_claims",value:encodeURIComponent(JSON.stringify({sub:"qa",email,name:"QA"})),domain:"janus-three-nu.vercel.app",path:"/",secure:true,httpOnly:true,sameSite:"Lax"}]); }
async function visit(page,name,path){ try{ const res=await page.goto(WEB+path,{waitUntil:"networkidle",timeout:60000}); await page.waitForTimeout(800); const txt=(await page.textContent("body"))||""; const bad=/Application error|Unhandled Runtime/i.test(txt); console.log(`${bad?"ERRORPAGE":"OK"} ${name} -> ${res.status()} ${page.url()} len=${txt.length}`); await page.screenshot({path:`${OUT}/${name}.png`,fullPage:true}); return txt; }catch(e){ console.log(`FAIL ${name} ${e.message.split("\n")[0]}`); return ""; } }
(async()=>{
 const recTok=await tok("qa.recruiter@janus.test");
 const browser=await chromium.launch({channel:"chrome",headless:true});
 let ctx=await browser.newContext({viewport:{width:1280,height:860}}); let page=await ctx.newPage();
 await visit(page,"01-home","/");
 await visit(page,"02-login","/login");
 await auth(ctx,"qa.recruiter@janus.test",recTok);
 await visit(page,"03-feed","/feed");
 const reqTxt=await visit(page,"04-requests-action","/requests");
 console.log("requests shows ACTION card:", /Accepted — sign now|Needs your signature/.test(reqTxt));
 await visit(page,"05-talent",`/talent/${STUDENT}`);
 // NDA sign with drawn signature
 await page.goto(WEB+`/nda/${ndaId}`,{waitUntil:"networkidle",timeout:60000}); await page.waitForTimeout(800);
 await page.screenshot({path:`${OUT}/06-nda-sign-empty.png`,fullPage:true});
 // scroll agreement to end (inner scroller)
 await page.evaluate(()=>{ document.querySelectorAll("div").forEach(el=>{ if(el.scrollHeight>el.clientHeight+50 && el.className.includes("overflow-y-auto")){ el.scrollTop=el.scrollHeight; el.dispatchEvent(new Event("scroll",{bubbles:true})); } }); });
 await page.waitForTimeout(600);
 await page.fill("#typedName","Priya Sharma");
 // draw signature: sweeping strokes on the canvas
 const canvas=page.getByTestId("signature-pad");
 const box=await canvas.boundingBox();
 console.log("canvas box", JSON.stringify(box));
 await page.mouse.move(box.x+30, box.y+box.height*0.62);
 await page.mouse.down();
 for(let i=0;i<=14;i++){ await page.mouse.move(box.x+30+i*16, box.y+box.height*0.62 - Math.sin(i/2.4)*26, {steps:2}); await page.waitForTimeout(18); }
 await page.mouse.move(box.x+290, box.y+box.height*0.45,{steps:6});
 await page.mouse.up();
 await page.waitForTimeout(300);
 await page.mouse.move(box.x+40, box.y+box.height*0.78); await page.mouse.down();
 for(let i=0;i<=10;i++){ await page.mouse.move(box.x+40+i*22, box.y+box.height*0.78, {steps:2}); }
 await page.mouse.up();
 await page.waitForTimeout(500);
 const signBtn=page.getByRole("button",{name:/Sign and open vault/});
 console.log("sign enabled:", await signBtn.isEnabled());
 await page.screenshot({path:`${OUT}/07-nda-sign-drawn.png`,fullPage:true});
 await signBtn.click();
 await page.waitForURL(/\/vault\//,{timeout:60000}).catch(()=>console.log("no vault redirect, url:",page.url()));
 await page.waitForTimeout(1000);
 console.log("after sign url:", page.url());
 await page.screenshot({path:`${OUT}/08-vault-unlocked.png`,fullPage:true});
 // verify signature stored via API
 const out=await api("/v1/nda/outbound",{token:recTok});
 const signed=(out.body||[]).find(r=>r.id===ndaId);
 console.log("API agreement signatureSha256:", signed?.agreement?.signatureSha256 ? signed.agreement.signatureSha256.slice(0,16)+"…" : "MISSING");
 await visit(page,"09-requests-signed","/requests");
 await visit(page,"10-nda-signed-state",`/nda/${ndaId}`);
 await visit(page,"11-vault-list",`/vault/${STUDENT}`);
 await visit(page,"12-vault-viewer",`/vault/${STUDENT}/${ASSET}`);
 await visit(page,"13-notifications","/notifications");
 await visit(page,"14-docs","/docs");
 await visit(page,"15-settings","/settings");
 await visit(page,"16-404","/this-page-does-not-exist");
 await ctx.close();
 ctx=await browser.newContext({viewport:{width:1280,height:860}}); page=await ctx.newPage();
 const admTok=await tok("qa.admin@janus.test"); await auth(ctx,"qa.admin@janus.test",admTok);
 await visit(page,"17-admin-moderation","/admin/moderation");
 await visit(page,"18-admin-videos","/admin/videos");
 await visit(page,"19-admin-users","/admin/users");
 await visit(page,"20-admin-audit","/admin/audit");
 await browser.close();
 console.log("DONE");
})().catch(e=>{console.error("FATAL",e); process.exit(1)});
