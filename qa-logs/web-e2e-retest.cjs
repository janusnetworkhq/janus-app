const { chromium } = require("/Users/gokul/Documents/personal/InnovaX/qa-logs/pw/node_modules/playwright-core");
const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const OUT="/Users/gokul/Documents/personal/InnovaX/qa-screenshots/web-e2e";
const WEB="https://janus-three-nu.vercel.app", SRV="srv-dbb0m1u7bikc73b9rfv0", VIDEO_ID="cmvf90d350003h901k3wyfnqy";
const results=[]; const log=(ok,n,d="")=>{results.push(`${ok?"PASS":"FAIL"} ${n} ${d}`); console.log(results[results.length-1]);};
function renderLogs(){ return execFileSync("render",["logs","--resources",SRV,"--limit","200","-o","text"],{cwd:"/Users/gokul/Documents/personal/InnovaX",encoding:"utf8",timeout:90000}); }
async function latestCode(email, afterCount=0){ const re=new RegExp("Verification Code for "+email.split(".").join("\\.")+": \\[ ([0-9]{6}) \\]","g"); for(let i=0;i<14;i++){ const m=[...renderLogs().matchAll(re)]; if(m.length>afterCount) return m[m.length-1][1]; await new Promise(r=>setTimeout(r,5000)); } throw new Error("no fresh code"); }
function codeCount(email){ return [...renderLogs().matchAll(new RegExp("Verification Code for "+email.split(".").join("\\.")+":","g"))].length; }
async function webLogin(page,email){
  await page.goto(WEB+"/login",{waitUntil:"networkidle",timeout:60000});
  await page.fill("#otp-email",email);
  const before=codeCount(email);
  await page.click('button[type=submit]');
  await page.waitForSelector("#otp-code",{timeout:30000});
  await page.fill("#otp-code", await latestCode(email, before));
  await page.click('button[name=intent][value=verify]');
  await page.waitForURL(/\/(feed|onboarding)/,{timeout:40000});
}
function dbRun(js){ const secrets=fs.readFileSync("/Users/gokul/Documents/personal/InnovaX/deploy-secrets.local.txt","utf8"); const dburl=secrets.split("\n").find(l=>l.startsWith("DATABASE_URL=")).slice(13); const f="/Users/gokul/Documents/personal/InnovaX/.tmp-db.cjs"; fs.writeFileSync(f,`const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); (async()=>{ ${js} })().catch(e=>{console.error(e.message.slice(0,300));process.exit(1)})`); try{ return execSync("node .tmp-db.cjs",{cwd:"/Users/gokul/Documents/personal/InnovaX",env:{...process.env,DATABASE_URL:dburl},encoding:"utf8",timeout:60000}); } finally{ fs.rmSync(f,{force:true}); } }
async function shot(page,n){ await page.waitForTimeout(800); await page.screenshot({path:`${OUT}/${n}.png`,fullPage:true}); }
(async()=>{
 const browser=await chromium.launch({channel:"chrome",headless:true});
 let ctx=await browser.newContext({viewport:{width:1280,height:860}}); let page=await ctx.newPage();
 await webLogin(page,"qa.recruiter@janus.test");
 try{ await page.waitForFunction(()=>document.body.innerText.includes("Smart irrigation"),null,{timeout:45000}); log(true,"feed shows QA sample video (waited)"); }catch{ log(false,"feed shows QA sample video (waited)"); }
 await shot(page,"04-recruiter-feed");
 await page.goto(WEB+"/vault/cmvf8mmpm0004fx0121e39y2z",{waitUntil:"networkidle"});
 try{ await page.waitForFunction(()=>document.body.innerText.includes("qa-prototype.pdf"),null,{timeout:30000}); log(true,"vault list shows qa-prototype.pdf (waited)"); }catch{ log(false,"vault list shows qa-prototype.pdf (waited)"); }
 await shot(page,"10-vault-unlocked");
 await ctx.close();
 dbRun(`await p.video.update({where:{id:'${VIDEO_ID}'},data:{moderationStatus:'PENDING'}}); await p.$disconnect()`);
 ctx=await browser.newContext({viewport:{width:1280,height:860}}); page=await ctx.newPage();
 await webLogin(page,"qa.admin@janus.test");
 await page.goto(WEB+"/admin/moderation",{waitUntil:"networkidle"});
 await page.getByRole("button",{name:"Approve"}).first().click();
 try{ await page.waitForFunction(()=>!document.body.innerText.includes("Smart irrigation"),null,{timeout:45000}); log(true,"approve clears queue row (waited, router.refresh)"); }catch{ log(false,"approve clears queue row (waited)"); }
 await shot(page,"16-admin-moderation-approved");
 await page.goto(WEB+"/admin/videos",{waitUntil:"networkidle"});
 await page.getByRole("button",{name:"Hide"}).first().click();
 try{ await page.waitForFunction(()=>document.body.innerText.includes("HIDDEN"),null,{timeout:45000}); log(true,"hide updates list in place"); }catch{ log(false,"hide updates list in place"); }
 await page.getByRole("button",{name:"Restore"}).first().click();
 try{ await page.waitForFunction(()=>document.body.innerText.includes("READY"),null,{timeout:45000}); log(true,"restore updates list in place (final READY)"); }catch{ log(false,"restore updates list");}
 await shot(page,"18-admin-video-hidden");
 fs.writeFileSync(`${OUT}/retest-results.txt`, results.join("\n")+"\n");
 console.log(results.join("\n"));
 await browser.close();
})().catch(e=>{console.error("FATAL",e.message); process.exit(1)});
