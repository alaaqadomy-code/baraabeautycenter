/**
 * التحقق من الموقع الحي بعد النشر: الرئيسية 200، HTTP→HTTPS، www، canonical على الدومين، 404 حقيقية،
 * robots + sitemap، كل روابط الخريطة 200 (أو عيّنة --max=N)، CSS وOG والأصول، JSON-LD، ترويسات الأمان،
 * وعدد صفحات الخريطة ≥ عدد الصفحات المفهرسة في dist (حارس «النشر من نسخة ناقصة» في CLAUDE.md).
 *   node scripts/verify-live.mjs [--url=https://…] [--max=0]
 */
import { existsSync } from 'node:fs';
import { siteUrl } from './_site-url.mjs';
import { CONFIG, localSitemap } from './_config.mjs';
const arg = (n, d) => process.argv.find((x) => x.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const BASE = arg('url', siteUrl()).replace(/\/+$/, ''); const HOST = new URL(BASE).host; const APEX = HOST.replace(/^www\./, '');
const MAX = Number(arg('max', '0'));
const ok = [], warns = [], errors = []; const pass = (m) => ok.push(m), warn = (m) => warns.push(m), fail = (m) => errors.push(m);
async function fetchRetry(url, redirect = 'follow', tries = 3) {
  let last; for (let i = 1; i <= tries; i++) { try { return await fetch(url, { redirect, headers: { 'User-Agent': 'verify-live/1.0' }, signal: AbortSignal.timeout(25000) }); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500 * i)); } } throw last;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
console.log(`فحص الموقع الحي: ${BASE}`);
let home = '';
try { const r = await fetchRetry(BASE + '/'); if (r.status !== 200) fail(`الرئيسية ${r.status}`); else { home = await r.text(); pass(`الرئيسية 200 (${Math.round(home.length / 1024)}KB)`); } } catch (e) { fail(`تعذّر الوصول للرئيسية: ${e.message.slice(0, 80)}`); }
if (!home) { console.log('✗ الموقع غير متاح'); errors.forEach((e) => console.log('  • ' + e)); process.exit(1); }
try { const r = await fetchRetry(`http://${APEX}/`, 'manual'); const loc = r.headers.get('location') ?? ''; r.status >= 300 && r.status < 400 && loc.startsWith('https://') ? pass('HTTP يحوّل إلى HTTPS') : warn(`HTTP لا يحوّل إلى HTTPS (${r.status})`); } catch { warn('تعذّر فحص HTTP→HTTPS'); }
try { const r = await fetchRetry(`https://www.${APEX}/`); r.status === 200 ? pass('www يعمل') : warn(`www يرجع ${r.status}`); } catch { warn('www غير متاح'); }
const canon = home.match(/rel="canonical"\s+href="([^"]+)"/)?.[1];
if (!canon) fail('الرئيسية بلا canonical'); else if (new URL(canon).host !== HOST) fail(`canonical على ${new URL(canon).host} لا ${HOST}`); else pass(`canonical صحيح`);
try { const r = await fetchRetry(`${BASE}/__no-such-page__`, 'manual'); r.status === 404 ? pass('صفحة غير موجودة ترجع 404') : fail(`صفحة غير موجودة ترجع ${r.status} (soft 404)`); } catch { warn('تعذّر فحص 404'); }
try { const r = await fetchRetry(`${BASE}/robots.txt`); const t = await r.text(); const sm = t.match(/Sitemap:\s*(\S+)/i)?.[1]; if (r.status !== 200) fail(`robots.txt ${r.status}`); else if (!sm || !sm.includes(APEX)) fail('robots.txt بلا Sitemap على الدومين'); else pass('robots.txt سليم'); if (/Disallow:\s*\/\s*$/m.test(t)) fail('robots.txt يمنع الزحف كله'); } catch { fail('تعذّر جلب robots.txt'); }
let urls = [], checked = 0;
try { const r = await fetchRetry(`${BASE}${CONFIG.sitemapLive}`); if (r.status !== 200) fail(`${CONFIG.sitemapLive} ${r.status}`); else { const maps = [...(await r.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]); if (maps.length && !maps.every((u) => /\.xml$/.test(u))) { urls.push(...maps); maps.length = 0; } for (const m of maps) { const rr = await fetchRetry(m); if (rr.status !== 200) { fail(`خريطة فرعية ${m} ${rr.status}`); continue; } urls.push(...[...(await rr.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1])); } pass(`خريطة الموقع: ${urls.length} رابطاً`); } } catch { fail('تعذّر جلب خريطة الموقع'); }
// حارس النسخة الناقصة: الخريطة الحية لا تقلّ عن dist المحلي
if (existsSync(localSitemap())) { const local = ((await import('node:fs')).readFileSync(localSitemap(), 'utf8').match(/<loc>/g) || []).length; if (urls.length && urls.length < local) fail(`الخريطة الحية ${urls.length} < المحلية ${local}: نُشرت نسخة ناقصة؟`); else if (urls.length) pass(`الخريطة الحية ${urls.length} = المحلية ${local}`); }
if (urls.length) {
  const list = MAX > 0 ? urls.slice(0, MAX) : urls; let bad = 0; checked = list.length;
  for (const u of list) { await sleep(120); try { const r = await fetchRetry(u, 'manual'); if (r.status !== 200) { fail(`${r.status} → ${u}`); bad++; } } catch (e) { fail(`تعذّر ${u}`); bad++; } }
  if (!bad) pass(`كل صفحات الخريطة المفحوصة (${list.length}) ترجع 200`);
}
const css = home.match(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+\.css[^"]*)"/)?.[1];
if (!css) fail('لا stylesheet في الرئيسية'); else { try { const r = await fetchRetry(new URL(css, BASE).href); r.status === 200 ? pass('CSS 200') : fail(`CSS ${r.status}`); } catch { fail('تعذّر جلب CSS'); } }
const og = home.match(/property="og:image"\s+content="([^"]+)"/)?.[1];
if (!og) fail('الرئيسية بلا og:image'); else { try { const r = await fetchRetry(new URL(og, BASE).href); r.status === 200 ? pass('صورة OG 200') : fail(`صورة OG ${r.status}`); } catch { fail('تعذّر جلب OG'); } }
for (const a of [...CONFIG.liveAssets, '/_redirects']) { await sleep(200); try { const r = await fetchRetry(BASE + a); if (a === '/_redirects') { r.status === 404 ? pass('_redirects غير معروض (سليم)') : warn('_redirects معروض للعلن'); } else if (r.status !== 200) warn(`${a} يرجع ${r.status}`); } catch { warn(`تعذّر جلب ${a}`); } }
try { const r = await fetchRetry(BASE + '/'); const miss = ['x-frame-options', 'x-content-type-options', 'referrer-policy', 'strict-transport-security'].filter((h) => !r.headers.get(h)); miss.length ? warn(`ترويسات أمان غائبة: ${miss.join(', ')}`) : pass('ترويسات الأمان مطبّقة'); } catch { warn('تعذّر فحص الترويسات'); }
for (const s of CONFIG.bannedLive) if (home.includes(s)) fail(`نص ممنوع على الرئيسية الحية: ${s}`);
const blocks = home.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) ?? []; let badLd = 0;
for (const b of blocks) { try { JSON.parse(b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')); } catch { badLd++; } }
blocks.length && !badLd ? pass(`${blocks.length} كتل JSON-LD صالحة`) : fail('JSON-LD غائب أو معطوب على الرئيسية');
console.log(`\n✓ ناجح (${ok.length}):`); ok.forEach((m) => console.log('  • ' + m));
if (warns.length) { console.log(`\n⚠ تنبيهات (${warns.length}):`); warns.forEach((m) => console.log('  • ' + m)); }
console.log(`\n${errors.length ? '✗' : '✓'} أخطاء (${errors.length}):`); errors.forEach((m) => console.log('  • ' + m));
// شهادة التحقق الحي: يقرأها index-sitemap.mjs ولا يرسل الخريطة إلا بشهادة حديثة بلا أخطاء
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('content-plan', { recursive: true });
// checked = ما فُحص فعلاً (--max يفحص عيّنة)؛ بوابة الفهرسة لا تقبل شهادة جزئية
writeFileSync('content-plan/verify-live.json', JSON.stringify({ at: new Date().toISOString(), base: BASE, urls: urls.length, checked, errors: errors.length, warns: warns.length }, null, 2));
process.exitCode = errors.length ? 1 : 0;
