/**
 * أهداف اللمس والجوال بقياس فعلي (قاعدة حسن: ≥ 40×40px، لا تمرير أفقي، الجدول ≤ حاويته، الهيرو < 0.85 من الشاشة):
 * يشغّل Chrome/Edge المثبت بلا رأس عبر CDP (بلا Playwright) على خادم محلي يخدم dist بعرض 375×812، ويقيس
 * عيّنة صفحات (الرئيسية + مقال + دليل + صفحة قائمة + فهرس) أو --pages=/a,/b. الروابط داخل الفقرات والقوائم
 * مستثناة عرفاً (كما عند حسن). يفشل على تمرير أفقي أو جدول أعرض من حاويته أو أهداف صغيرة خارج المتن > 0.
 *   node scripts/check-touch-targets.mjs [--all | --pages=/,/blog/x] [--width=375]
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { DIST, pages as distPages } from './_dist.mjs';
import { CONFIG } from './_config.mjs';
const arg = (n, d) => process.argv.find((x) => x.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const W = Number(arg('width', 375)), H = 812;
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if (!CHROME) { console.error('✗ لا Chrome ولا Edge مثبت'); process.exit(2); }
const all = distPages();
if (!all.length) { console.error('✗ صفر صفحة في dist'); process.exit(1); }
// العيّنة الافتراضية: صفحة واحدة لكل قالب (كل الصفحات من قالب واحد تتشارك قياسها)، و--all لكل صفحات dist
// قالب الصفحة من الإعداد (touchGroups: [[نمط، اسم]])، وإلا الجزء الأول من المسار (كل /x/* قالب واحد)
const TG = (CONFIG.touchGroups ?? []).map(([re, name]) => [new RegExp(re), name]);
const GROUP = (u) => TG.find(([re]) => re.test(u))?.[1] ?? (u === '/' ? 'home' : u.split('/').filter(Boolean).length > 1 ? '/' + u.split('/')[1] + '/*' : u);
const PAGES = arg('pages', '') ? arg('pages').split(',') : process.argv.includes('--all') ? all.map((p) => p.url) : [...new Map(all.map((p) => [GROUP(p.url), p.url])).values()];
const mime = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2', woff: 'font/woff', ico: 'image/x-icon', json: 'application/json', xml: 'application/xml', txt: 'text/plain' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  for (const c of [p, p + '.html', p.replace(/\/$/, '') + '/index.html']) if (existsSync(DIST + c) && !c.endsWith('/')) { try { const b = readFileSync(DIST + c); res.writeHead(200, { 'content-type': mime[c.split('.').pop()] ?? 'application/octet-stream' }); return res.end(b); } catch {} }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const cdpPort = 9222 + Math.floor(Math.random() * 1000);
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${process.env.TEMP || '.'}/cdp-${cdpPort}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws; for (let i = 0; i < 40 && !ws; i++) { await sleep(250); try { const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json(); const t = list.find((x) => x.type === 'page'); if (t) ws = t.webSocketDebuggerUrl; } catch {} }
if (!ws) { chrome.kill(); server.close(); console.error('✗ تعذّر الاتصال بالمتصفح'); process.exit(2); }
const sock = new WebSocket(ws); await new Promise((r) => sock.addEventListener('open', r));
let id = 0; const pending = new Map(); const events = [];
sock.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method) events.push(m.method); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); sock.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
const MEASURE = `(() => { const r = (e) => e.getBoundingClientRect(); const inProse = (e) => !!e.closest('p, li, td, th, dd, figcaption, blockquote, aside[role=note]');
  const small = [...document.querySelectorAll('a, button, [role=button], input, select')].filter((e) => { const b = r(e); return b.width > 2 && b.height > 2 && (b.height < 40 || b.width < 40) && !inProse(e) /* ≤2px = مخفي بصرياً مثل رابط التخطي */ && getComputedStyle(e).visibility !== 'hidden'; }).map((e) => (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30) + ' ' + Math.round(r(e).width) + 'x' + Math.round(r(e).height));
  const tables = [...document.querySelectorAll('table')].filter((t) => Math.round(r(t).width) > Math.round(r(t.parentElement).width) + 1 && getComputedStyle(t.parentElement).overflowX !== 'auto' && getComputedStyle(t.parentElement).overflowX !== 'scroll').length;
  const h1 = document.querySelector('h1'); const hero = h1 ? h1.closest('section, header, div') : null;
  return { overflowX: document.documentElement.scrollWidth > innerWidth + 1, scrollW: document.documentElement.scrollWidth, small, tables, h1Lines: h1 ? Math.round(r(h1).height / parseFloat(getComputedStyle(h1).lineHeight)) : null, heroRatio: hero ? +(r(hero).height / innerHeight).toFixed(2) : null }; })()`;
const issues = []; let checked = 0;
for (const u of PAGES) {
  if ((await fetch(`http://127.0.0.1:${port}${u}`)).status !== 200) { issues.push(`${u} :: الصفحة غير موجودة في dist`); continue; }
  await send('Page.navigate', { url: `http://127.0.0.1:${port}${u}` }); await sleep(1200);
  const res = await send('Runtime.evaluate', { expression: MEASURE, returnByValue: true }); const m = res.result?.result?.value; if (!m) { issues.push(`${u} :: تعذّر القياس`); continue; }
  checked++;
  console.log(`  ${u}: تمرير أفقي ${m.overflowX ? '✗ ' + m.scrollW + 'px' : '✓'} · جداول فائضة ${m.tables} · أهداف صغيرة ${m.small.length} · أسطر H1 ${m.h1Lines ?? '-'} · الهيرو ${m.heroRatio ?? '-'} من الشاشة`);
  if (m.overflowX) issues.push(`${u} :: تمرير أفقي (${m.scrollW}px > ${W})`);
  if (m.tables) issues.push(`${u} :: ${m.tables} جدول أعرض من حاويته بلا تمرير`);
  if (m.small.length) issues.push(`${u} :: ${m.small.length} هدف لمس < 40px: ${m.small.slice(0, 4).join(' | ')}`);
  if (m.h1Lines > 5) issues.push(`${u} :: H1 في ${m.h1Lines} أسطر`);
  if (m.heroRatio > 1.1) issues.push(`${u} :: الهيرو ${m.heroRatio} من ارتفاع الشاشة`);
}
sock.close(); chrome.kill(); server.close();
console.log(`صفحات مقيسة بعرض ${W}: ${checked} من ${all.length}${process.argv.includes('--all') ? '' : ' (قالب واحد لكل نوع؛ --all للكل)'}`);
if (!checked) { console.error('✗ صفر صفحة مقيسة'); process.exit(1); }
issues.forEach((i) => console.log('  ✗ ' + i));
console.log(issues.length ? `✗ ${issues.length} مشكلة جوال` : '✓ لا تمرير أفقي، الجداول داخل حاوياتها، أهداف اللمس ≥ 40px');
process.exit(issues.length ? 1 : 0);
