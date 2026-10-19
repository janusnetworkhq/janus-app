const { chromium } = require("/Users/gokul/Documents/personal/InnovaX/qa-logs/pw/node_modules/playwright-core");
const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const OUT = "/Users/gokul/Documents/personal/InnovaX/qa-screenshots/web-e2e";
const WEB = "https://janus-three-nu.vercel.app";
const API = "https://janus-api-wctn.onrender.com";
const SRV = "srv-dbb0m1u7bikc73b9rfv0";
const STUDENT_ID = "cmvf8mmpm0004fx0121e39y2z";
const VIDEO_ID = "cmvf90d350003h901k3wyfnqy";
const ASSET_ID = "cmvf90p2v000ah901o3sbgz1q";
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const log = (ok, name, detail="") => { results.push(`${ok?"PASS":"FAIL"} ${name} ${detail}`); console.log(results[results.length-1]); };
async function shot(page, name){ await page.waitForTimeout(900); await page.screenshot({path:`${OUT}/${name}.png`, fullPage:true}); }
function renderLogs(){ return execFileSync("render",["logs","--resources",SRV,"--limit","200","-o","text"],{cwd:"/Users/gokul/Documents/personal/InnovaX", encoding:"utf8", timeout:90000}); }
async function latestCode(email){
  const re = new RegExp(`Verification Code for ${email.replace(/\./g,"\\.")}: \\[ (\\d{6}) \\]`, "g");
  for(let i=0;i<10;i++){
    const m=[...renderLogs().matchAll(re)];
    if(m.length) return m[m.length-1][1];
    await new Promise(r=>setTimeout(r,5000));
  }
  throw new Error("code not in logs for "+email);
}
async function api(path, {method="GET", token, body}={}){
  const r=await fetch(API+path,{method, headers:{"content-type":"application/json", ...(token?{authorization:`Bearer ${token}`}:{})}, body: body?JSON.stringify(body):undefined});
  const j=await r.json().catch(()=>({})); return {status:r.status, body:j};
}
async function apiToken(email,name){
  const before=[...renderLogs().matchAll(new RegExp(`Verification Code for ${email.replace(/\./g,"\\.")}:`,"g"))].length;
  const s=await api("/v1/auth/otp/send",{method:"POST",body:{email,name}});
  if(s.status!==200) throw new Error("otp send "+email+" "+s.status);
  let code=null;
  for(let i=0;i<12 && !code;i++){ const m=[...renderLogs().matchAll(new RegExp(`Verification Code for ${email.replace(/\./g,"\\.")}: \\[ (\\d{6}) \\]`,"g"))]; if(m.length>before || (m.length&&i>2)) code=m[m.length-1][1]; else await new Promise(r=>setTimeout(r,4000)); }
  const v=await api("/v1/auth/otp/verify",{method:"POST",body:{email,code,name}});
  if(v.status!==200) throw new Error("otp verify "+email+" "+v.status);
  return v.body.accessToken;
}
async function webLogin(page, email, name, wrongFirst=false){
  await page.goto(WEB+"/login",{waitUntil:"networkidle",timeout:60000});
  await page.fill("#otp-email", email);
  if(name) await page.fill("#otp-name", name);
  await page.click('button[type=submit]');
  await page.waitForSelector("#otp-code",{timeout:30000});
  if(wrongFirst){
    await page.fill("#otp-code","111111");
    await page.click('button[name=intent][value=verify]');
    await page.waitForTimeout(2500);
    const body=await page.textContent("body");
    log(/not correct|incorrect/i.test(body||""), "wrong OTP shows friendly error", "");
    await shot(page,"03-wrong-code-error");
    await page.fill("#otp-code","");
  }
  const code=await latestCode(email);
  await page.fill("#otp-code", code);
  await page.click('button[name=intent][value=verify]');
  await page.waitForURL(/\/(feed|onboarding)/,{timeout:40000});
}
function dbRun(js){
  const secrets=fs.readFileSync("/Users/gokul/Documents/personal/InnovaX/deploy-secrets.local.txt","utf8");
  const dburl=secrets.split("\n").find(l=>l.startsWith("DATABASE_URL=")).slice("DATABASE_URL=".length);
  const file="/Users/gokul/Documents/personal/InnovaX/.tmp-db.cjs";
  fs.writeFileSync(file, `const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); (async()=>{ ${js} })().catch(e=>{console.error(e.message.slice(0,300)); process.exit(1)})`);
  try{ return execSync(`node .tmp-db.cjs`,{cwd:"/Users/gokul/Documents/personal/InnovaX", env:{...process.env, DATABASE_URL:dburl}, encoding:"utf8", timeout:60000}); }
  finally{ fs.rmSync(file,{force:true}); }
}
(async()=>{
  const browser=await chromium.launch({channel:"chrome", headless:true});
  // ---- anon + recruiter ----
  let ctx=await browser.newContext({viewport:{width:1280,height:860}});
  let page=await ctx.newPage();
  let res=await page.goto(WEB+"/feed",{waitUntil:"networkidle",timeout:60000});
  log(page.url().includes("/login"), "anon /feed redirects to login", page.url());
  await shot(page,"01-anon-redirect-login");
  await page.goto(WEB+"/login",{waitUntil:"networkidle"});
  await shot(page,"02-login-email-step");
  await webLogin(page,"qa.recruiter@janus.test","Priya Sharma",true);
  log(page.url().includes("/feed"), "recruiter OTP login lands on feed", page.url());
  let body=await page.textContent("body");
  log(/Smart irrigation robot/i.test(body||""), "feed shows QA sample video", "");
  await shot(page,"04-recruiter-feed");
  // like the video
  try{ await page.locator("article button").filter({hasText:/^\d+$/}).first().click(); await page.waitForTimeout(1200); log(true,"feed like click"); }catch(e){ log(false,"feed like click",e.message.split("\n")[0]); }
  // talent profile
  await page.goto(WEB+`/talent/${STUDENT_ID}`,{waitUntil:"networkidle"});
  body=await page.textContent("body");
  log(/qaarjun|Arjun/i.test(body||""), "talent profile loads", "");
  await shot(page,"05-talent-profile");
  // vault locked first
  await page.goto(WEB+`/vault/${STUDENT_ID}`,{waitUntil:"networkidle"});
  body=await page.textContent("body");
  log(/locked|NDA/i.test(body||""), "vault locked before NDA", "");
  await shot(page,"06-vault-locked");
  // request NDA from talent
  await page.goto(WEB+`/talent/${STUDENT_ID}`,{waitUntil:"networkidle"});
  await page.getByRole("button",{name:"Request NDA"}).click();
  await page.waitForURL(/\/nda\//,{timeout:30000});
  const ndaId=page.url().split("/nda/")[1];
  body=await page.textContent("body");
  log(/Waiting on student|NDA requested/i.test(body||""), "NDA request created, waiting student", ndaId);
  await shot(page,"07-nda-waiting");
  await page.goto(WEB+"/requests",{waitUntil:"networkidle"}); await shot(page,"08-requests-list");
  // student accepts via API
  const stuTok=await apiToken("qa.student@janus.test","Arjun Mehta");
  const inbox=await api("/v1/nda/inbox",{token:stuTok});
  const reqRow=(inbox.body||[]).find(r=>r.id===ndaId) || (inbox.body||[])[0];
  log(!!reqRow, "student inbox has NDA request", `status=${inbox.status}`);
  const decide=await api(`/v1/nda/requests/${ndaId}/decide`,{method:"POST",token:stuTok,body:{accept:true}});
  log(decide.status===200||decide.status===201, "student accepts NDA via API", `status=${decide.status}`);
  // recruiter signs on web
  await page.goto(WEB+`/nda/${ndaId}`,{waitUntil:"networkidle"});
  body=await page.textContent("body");
  log(/Sign and open vault|legal name/i.test(body||""), "nda sign form after accept", "");
  await page.evaluate(()=>{ const els=[...document.querySelectorAll("div")]; const sc=els.find(e=>e.scrollHeight>e.clientHeight+50 && e.textContent.includes("Confidential")); if(sc){sc.scrollTop=sc.scrollHeight; sc.dispatchEvent(new Event("scroll",{bubbles:true}));} });
  await page.waitForTimeout(800);
  await page.fill("#typedName","Priya Sharma");
  await shot(page,"09-nda-sign");
  await page.getByRole("button",{name:/Sign and open vault/}).click();
  await page.waitForURL(/\/vault\//,{timeout:40000});
  body=await page.textContent("body");
  log(/qa-prototype\.pdf/i.test(body||""), "signing redirects to unlocked vault list", page.url());
  await shot(page,"10-vault-unlocked");
  // open asset viewer
  await page.goto(WEB+`/vault/${STUDENT_ID}/${ASSET_ID}`,{waitUntil:"networkidle"});
  await page.waitForTimeout(1500);
  body=await page.textContent("body");
  const wmTiles=await page.locator("[data-testid=vault-viewer] span").count();
  const dl=await page.locator("a[download]").count();
  log(wmTiles>=5, "vault viewer watermark tiles present", `tiles=${wmTiles}`);
  log(dl===0, "vault viewer has no download link", `count=${dl}`);
  await shot(page,"11-vault-viewer-watermark");
  // notifications
  await page.goto(WEB+"/notifications",{waitUntil:"networkidle"});
  body=await page.textContent("body");
  log(/Notifications/i.test(body||""), "notifications page loads", /New|unread/i.test(body||"")?"has-unread-marker":"no-unread");
  await shot(page,"12-notifications");
  // mark all read if present
  const mar=page.getByRole("button",{name:"Mark all read"});
  if(await mar.count()){ await mar.click(); await page.waitForTimeout(1800); log(true,"mark all read"); await shot(page,"13-notifications-read"); }
  // logout
  await page.getByRole("button",{name:"Sign out"}).first().click();
  await page.waitForURL(/\/login/,{timeout:30000});
  log(page.url().includes("/login"), "logout returns to login", "");
  await shot(page,"14-logged-out");
  await ctx.close();
  // ---- admin moderation ----
  dbRun(`await p.video.update({where:{id:'${VIDEO_ID}'},data:{moderationStatus:'PENDING'}}); console.log('set pending'); await p.$disconnect()`);
  ctx=await browser.newContext({viewport:{width:1280,height:860}});
  page=await ctx.newPage();
  await webLogin(page,"qa.admin@janus.test","Janus QA Admin",false);
  log(page.url().includes("/feed"), "admin OTP login lands on feed", page.url());
  await page.goto(WEB+"/admin/moderation",{waitUntil:"networkidle"});
  body=await page.textContent("body");
  log(/Smart irrigation/i.test(body||""), "moderation queue shows QA video after PENDING set", "");
  await shot(page,"15-admin-moderation-queue");
  await page.getByRole("button",{name:"Approve"}).first().click();
  await page.waitForTimeout(3000);
  body=await page.textContent("body");
  log(!/Smart irrigation/i.test(body||"") || /Queue is empty/i.test(body||""), "approve clears queue row", "");
  await shot(page,"16-admin-moderation-approved");
  await page.goto(WEB+"/admin/videos",{waitUntil:"networkidle"});
  await shot(page,"17-admin-videos");
  await page.getByRole("button",{name:"Hide"}).first().click();
  await page.waitForTimeout(2500);
  body=await page.textContent("body");
  log(/HIDDEN/i.test(body||""), "admin hide sets HIDDEN", "");
  await shot(page,"18-admin-video-hidden");
  await page.getByRole("button",{name:"Restore"}).first().click();
  await page.waitForTimeout(2500);
  body=await page.textContent("body");
  log(/READY/i.test(body||""), "admin restore sets READY (cleanup)", "");
  await page.goto(WEB+"/admin/users",{waitUntil:"networkidle"}); await shot(page,"19-admin-users");
  await page.goto(WEB+"/admin/audit",{waitUntil:"networkidle"}); await shot(page,"20-admin-audit");
  await page.getByRole("button",{name:"Sign out"}).first().click(); await page.waitForURL(/\/login/,{timeout:30000});
  await ctx.close();
  // ---- expired code API case ----
  const fresh=`qa.expired.${Date.now()}@janus.test`;
  const noCode=await api("/v1/auth/otp/verify",{method:"POST",body:{email:fresh,code:"123456"}});
  log(noCode.status===400 && noCode.body?.error?.code==="OTP_EXPIRED", "verify without prior send -> OTP_EXPIRED (expired/no-code path)", `status=${noCode.status}`);
  fs.writeFileSync(`${OUT}/results.txt`, results.join("\n")+"\n");
  console.log("\n==== RESULTS ====\n"+results.join("\n"));
  await browser.close();
})().catch(e=>{ console.error("E2E FATAL", e.message); fs.writeFileSync(`${OUT}/results.txt`, results.join("\n")+`\nFATAL ${e.message}\n`); process.exit(1); });
