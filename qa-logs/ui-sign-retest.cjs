const { chromium } = require("/Users/gokul/Documents/personal/InnovaX/qa-logs/pw/node_modules/playwright-core");
const fs=require("fs");
const OUT="/Users/gokul/Documents/personal/InnovaX/qa-screenshots/ui-overhaul/after";
const WEB="https://janus-three-nu.vercel.app", API="https://janus-api-zrlc.onrender.com";
const STUDENT="cmvf8mmpm0004fx0121e39y2z";
const { ndaId } = JSON.parse(fs.readFileSync("/Users/gokul/Documents/personal/InnovaX/qa-logs/ui-audit-nda.json","utf8"));
async function api(path,{method="GET",token,body}={}){ const r=await fetch(API+path,{method,headers:{"content-type":"application/json",...(token?{authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined}); return {status:r.status, body: await r.json().catch(()=>({}))}; }
(async()=>{
 const snd=await api("/v1/auth/otp/send",{method:"POST",body:{email:"qa.recruiter@janus.test"}});
 console.log("otp send", snd.status);
 const v=await api("/v1/auth/otp/verify",{method:"POST",body:{email:"qa.recruiter@janus.test",code:"123456"}});
 if(v.status!==200){ console.log("VERIFY FAILED", v.status, JSON.stringify(v.body).slice(0,120)); process.exit(2); }
 const token=v.body.accessToken;
 const browser=await chromium.launch({channel:"chrome",headless:true});
 const ctx=await browser.newContext({viewport:{width:1280,height:860}}); const page=await ctx.newPage();
 await ctx.addCookies([
  {name:"janus_session",value:token,domain:"janus-three-nu.vercel.app",path:"/",secure:true,httpOnly:true,sameSite:"Lax"},
  {name:"janus_claims",value:encodeURIComponent(JSON.stringify({sub:"qa",email:"qa.recruiter@janus.test",name:"QA"})),domain:"janus-three-nu.vercel.app",path:"/",secure:true,httpOnly:true,sameSite:"Lax"}]);
 await page.goto(WEB+`/nda/${ndaId}`,{waitUntil:"networkidle",timeout:60000}); await page.waitForTimeout(800);
 await page.evaluate(()=>{ document.querySelectorAll("div").forEach(el=>{ if(el.scrollHeight>el.clientHeight+50 && el.className.includes("overflow-y-auto")){ el.scrollTop=el.scrollHeight; el.dispatchEvent(new Event("scroll",{bubbles:true})); } }); });
 await page.waitForTimeout(500);
 await page.fill("#typedName","Priya Sharma");
 const box=await page.getByTestId("signature-pad").boundingBox();
 await page.mouse.move(box.x+30, box.y+box.height*0.62); await page.mouse.down();
 for(let i=0;i<=14;i++){ await page.mouse.move(box.x+30+i*16, box.y+box.height*0.62 - Math.sin(i/2.4)*26, {steps:2}); await page.waitForTimeout(18); }
 await page.mouse.move(box.x+290, box.y+box.height*0.45,{steps:6}); await page.mouse.up(); await page.waitForTimeout(300);
 await page.mouse.move(box.x+40, box.y+box.height*0.78); await page.mouse.down();
 for(let i=0;i<=10;i++){ await page.mouse.move(box.x+40+i*22, box.y+box.height*0.78, {steps:2}); }
 await page.mouse.up(); await page.waitForTimeout(500);
 const btn=page.getByRole("button",{name:/Sign and open vault/});
 console.log("sign enabled:", await btn.isEnabled());
 await page.screenshot({path:`${OUT}/07-nda-sign-drawn.png`,fullPage:true});
 await btn.click();
 await page.waitForURL(/\/vault\//,{timeout:90000});
 console.log("redirected to:", page.url());
 await page.waitForTimeout(1200);
 await page.screenshot({path:`${OUT}/08-vault-unlocked.png`,fullPage:true});
 const out=await api("/v1/nda/outbound",{token});
 const rows=Array.isArray(out.body)?out.body:out.body.items||[];
 const signed=rows.find(r=>r.id===ndaId);
 console.log("agreement:", signed?.agreement? `signedAt=${signed.agreement.signedAt} sigSha=${(signed.agreement.signatureSha256||"").slice(0,16)}…` : "MISSING");
 await page.goto(WEB+"/requests",{waitUntil:"networkidle",timeout:60000}); await page.waitForTimeout(700);
 await page.screenshot({path:`${OUT}/09-requests-signed.png`,fullPage:true});
 await page.goto(WEB+`/nda/${ndaId}`,{waitUntil:"networkidle",timeout:60000}); await page.waitForTimeout(700);
 await page.screenshot({path:`${OUT}/10-nda-signed-state.png`,fullPage:true});
 await browser.close(); console.log("RETEST DONE");
})().catch(e=>{console.error("FATAL",e.message); process.exit(1)});
