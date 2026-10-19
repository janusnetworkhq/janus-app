const { chromium } = require("playwright-core");
const OUT = "/Users/gokul/Documents/personal/InnovaX/qa-screenshots/round3";
const B = "http://localhost:3001";
const results = [];
async function shot(page, name) { await page.waitForTimeout(800); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); }
async function visit(page, name, path, check) {
  try {
    const res = await page.goto(B + path, { waitUntil: "networkidle", timeout: 30000 });
    const body = await page.textContent("body");
    const ok = res.status() < 400 && !/Something went wrong|Application error/i.test(body) && (!check || check.test(body));
    results.push(`${ok ? "PASS" : "FAIL"} ${name} ${path} -> ${res.status()}`);
    await shot(page, name);
  } catch (e) { results.push(`FAIL ${name} ${path} ${e.message.split("\n")[0]}`); }
}
async function login(ctx, email, name) {
  const page = await ctx.newPage();
  await page.goto(B + "/login");
  await page.fill("#email", email); await page.fill("#name", name);
  await Promise.all([page.waitForURL(/\/(feed|onboarding)/, { timeout: 20000 }), page.click("button[type=submit]")]);
  return page;
}
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const [stu, nda, asset, video] = process.argv.slice(2);
  // Recruiter
  let ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  let p = await ctx.newPage();
  await p.goto(B + "/login"); await shot(p, "web-01-login");
  await p.close();
  p = await login(ctx, "qa.rec.1792132644@acme.io", "QA Recruiter");
  await visit(p, "web-02-recruiter-feed", "/feed");
  await visit(p, "web-03-requests", "/requests");
  await visit(p, "web-04-talent", `/talent/${stu}`);
  await visit(p, "web-05-vault-list", `/vault/${stu}`);
  await visit(p, "web-06-vault-protected-viewer", `/vault/${stu}/${asset}`, /watermarked/);
  const hasDownload = await p.locator("a[download]").count();
  results.push(`${hasDownload ? "FAIL" : "PASS"} vault viewer has no download link (count=${hasDownload})`);
  const wm = await p.locator("text=qa.rec.1792132644@acme.io").count();
  results.push(`${wm ? "PASS" : "FAIL"} watermark names recruiter (${wm} tiles)`);
  await visit(p, "web-07-nda", `/nda/${nda}`);
  await visit(p, "web-08-admin-as-recruiter-blocked", "/admin/moderation");
  await ctx.close();
  // Admin
  ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  p = await login(ctx, "qa.adm.1792132644@janus.io", "QA Admin");
  await visit(p, "web-09-admin-moderation-queue", "/admin/moderation", /Review queue/);
  const row = p.locator("tr", { hasText: "curl smoke ffmpeg" });
  if (await row.count()) {
    await row.getByRole("button", { name: "Approve" }).click();
    await p.waitForTimeout(2500); await p.reload({ waitUntil: "networkidle" });
    const still = await p.locator("tr", { hasText: "curl smoke ffmpeg" }).count();
    results.push(`${still ? "FAIL" : "PASS"} approve removes video from queue`);
    await shot(p, "web-10-admin-moderation-after-approve");
  } else results.push("FAIL moderation row for curl smoke video not found");
  await visit(p, "web-11-admin-videos", "/admin/videos");
  await visit(p, "web-12-admin-videos-hidden", "/admin/videos?status=HIDDEN");
  await visit(p, "web-13-admin-users", "/admin/users");
  await visit(p, "web-14-admin-audit", "/admin/audit");
  await visit(p, "web-15-admin-feed", "/feed");
  await ctx.close();
  await browser.close();
  console.log(results.join("\n"));
})();
