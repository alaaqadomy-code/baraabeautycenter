/**
 * الفهرسة داخل الحزمة (قرار علاء 22 نوفمبر 2026): حين تُستعمل الحزمة تُعفى من قاعدة «خبير الفهرسة فقط» وتتولى
 * الفهرسة بنفسها، لكن بالشرط الصارم «100%» في اللحظة نفسها:
 *   1) `npm run check:all` خضراء الآن (يشغّلها بنفسه)،
 *   2) شهادة `content-plan/verify-live.json` أحدث من ساعة وبلا أخطاء وعدد روابطها = خريطة dist،
 *   3) الخريطة الحية تردّ 200 وعدد روابطها = المحلية (لا نسخة ناقصة).
 * ثم ثلاث خطوات: (أ) إرسال sitemap-index.xml إلى Search Console؛ (ب) IndexNow لروابط آخر commit المتغيّرة بمفتاح
 * الموقع (افتراضي؛ `--no-indexnow` لإيقافه)؛ (ج) `--inspect`: فحص حالة فهرسة روابط الدفعة بـURL Inspection API
 * (قراءة فقط، حصة منفصلة 2,000/يوم) وكتابة غير المفهرس إلى content-plan/index-request.json ليُطلب عبر Chrome
 * ببروتوكول خبير الفهرسة (tools.mjs: begin/preflight/log/end) من الجلسة نفسها، بحصة Google المشتركة (6 إلى 10 يومياً).
 *   node scripts/index-sitemap.mjs [--no-indexnow] [--inspect] [--urls=/blog/a,/blog/b] [--dry]
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { siteUrl } from './_site-url.mjs';
import { submitSitemap } from './_gsc.mjs';
import { CONFIG, localSitemap, gscProperty } from './_config.mjs';
// مصادر المحتوى في git (typosPaths، الافتراضي src): منها تُعرف روابط آخر commit
const SRC = CONFIG.typosPaths ?? ['src'];
import { dirname as __dn, join as __jn } from 'node:path';
import { fileURLToPath as __fu } from 'node:url';
const HERE = __dn(__fu(import.meta.url));

const BASE = siteUrl(); const HOST = new URL(BASE).host; const dry = process.argv.includes('--dry');
// --urls=/a,/b يحدد روابط الدفعة صراحةً (وإلا تُشتق من آخر commit غيّر المصدر)
// Git Bash على ويندوز يحوّل «/blog/x» إلى «C:/Program Files/Git/blog/x» (MSYS)؛ يُقبل الرابط بمسار أو بـslug أو برابط كامل
const URLS_ARG = (process.argv.find((a) => a.startsWith('--urls=')) ?? '').slice(7).split(',').filter(Boolean).map((u) => u.replace(/^[A-Za-z]:\/Program Files\/Git/, '')).map((u) => /^https?:/.test(u) ? u : BASE + (u.startsWith('/') ? '' : '/') + u);
const fail = (m) => { console.error('⛔ لا إرسال: ' + m); process.exit(1); };

// 1) البوابة خضراء الآن
const gate = spawnSync(process.execPath, [__jn(HERE, 'check-all.mjs')], { encoding: 'utf8' });
if (gate.status !== 0) fail('check:all حمراء\n' + gate.stdout.split('\n').filter((l) => /✗/.test(l)).join('\n'));
console.log('✓ check:all خضراء');

// 2) شهادة التحقق الحي حديثة وبلا أخطاء
if (!existsSync('content-plan/verify-live.json')) fail('لا شهادة verify-live؛ شغّل npm run verify:live بعد النشر');
const v = JSON.parse(readFileSync('content-plan/verify-live.json', 'utf8'));
const ageMin = (Date.now() - new Date(v.at)) / 60000;
if (v.errors) fail(`verify-live فيه ${v.errors} خطأ`);
if (ageMin > 60) fail(`شهادة verify-live عمرها ${ageMin.toFixed(0)} دقيقة (> 60)؛ أعد التحقق بعد النشر`);
if (v.base !== BASE) fail(`الشهادة لدومين آخر: ${v.base}`);
const local = [...readFileSync(localSitemap(), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!local.length) fail('خريطة dist فارغة');
if (v.urls !== local.length) fail(`الشهادة ${v.urls} رابطاً ≠ dist ${local.length}`);
if (v.checked !== v.urls) fail(`شهادة verify-live جزئية: فحصت ${v.checked ?? '?'} من ${v.urls} رابطاً (--max)؛ أعد التحقق كاملاً`);
console.log(`✓ verify-live قبل ${ageMin.toFixed(0)} دقيقة: 0 أخطاء، ${v.urls} رابطاً`);

// 3) الخريطة الحية = المحلية
const SITEMAP = `${BASE}${CONFIG.sitemapLive}`;
const idx = await fetch(SITEMAP); if (idx.status !== 200) fail(`${CONFIG.sitemapLive} الحية ${idx.status}`);
const idxText = await idx.text(); const locs = (x) => [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
// فهرس خرائط (Astro) أو خريطة واحدة (Next وغيره)
const live = /<sitemapindex/.test(idxText) ? (await Promise.all(locs(idxText).map(async (u) => locs(await (await fetch(u)).text())))).flat() : locs(idxText);
if (live.length !== local.length) fail(`الخريطة الحية ${live.length} ≠ المحلية ${local.length}: نُشرت نسخة ناقصة؟`);
// المقارنة بالروابط نفسها لا بعددها: خريطتان بالعدد نفسه وروابط مختلفة تعني نشر نسخة غير هذه
const L = new Set(local), onlyLive = live.filter((u) => !L.has(u)), LV = new Set(live), onlyLocal = local.filter((u) => !LV.has(u));
if (onlyLive.length || onlyLocal.length) fail(`الخريطة الحية تختلف عن المحلية بالروابط: ${onlyLocal.length} محلية فقط (مثل ${onlyLocal[0] ?? '-'})، ${onlyLive.length} حية فقط (مثل ${onlyLive[0] ?? '-'})`);
console.log(`✓ الخريطة الحية ${live.length} = المحلية`);

// آخر commit غيّر المصدر (لا HEAD: قد يكون HEAD تغييراً في السكربتات فقط)
const LAST_SRC = spawnSync('git', ['log', '-1', '--format=%H', '--', ...SRC], { encoding: 'utf8' }).stdout.trim();
// 4) الإرسال
if (dry) { console.log(`○ تجربة: كان سيُرسَل ${SITEMAP} إلى ${gscProperty(HOST)}`); process.exit(0); }
const info = await submitSitemap(gscProperty(HOST), SITEMAP);
console.log(`✓ أُرسلت الخريطة إلى Search Console${info ? ` · آخر إرسال ${info.lastSubmitted ?? '-'} · آخر تنزيل ${info.lastDownloaded ?? '-'} · ${info.contents?.[0]?.submitted ?? '?'} رابطاً مُقدَّماً، ${info.contents?.[0]?.indexed ?? '?'} مفهرساً` : ''}`);

if (!process.argv.includes('--no-indexnow')) {
  const keyFile = readdirSync('public').find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  if (!keyFile) fail('لا مفتاح IndexNow في public/');
  const KEY = keyFile.replace('.txt', '');
  const changed = spawnSync('git', ['diff', '--name-only', `${LAST_SRC}~1`, LAST_SRC, '--', ...SRC], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  // كل صفحة تغيّر مصدرها أو قالبها: المقالات بـslug، والقوالب تعني كل صفحات النوع
  const slugs = new Set(); for (const f of changed) { const src = readFileSync(f, 'utf8'); for (const m of src.matchAll(/"?slug"?\s*:\s*"([a-z0-9-]+)"/g)) slugs.add(m[1]); }
  const urls = URLS_ARG.length ? URLS_ARG : local.filter((u) => [...slugs].some((s) => u.endsWith(`/${s}`)) || changed.some((f) => /pages\/|components\/|layouts\//.test(f) && !/\[slug\]/.test(f) && u === BASE + '/'));
  if (!urls.length) console.log('IndexNow: لا روابط متغيّرة في آخر commit');
  else {
    const r = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${BASE}/${KEY}.txt`, urlList: urls }) });
    console.log(`IndexNow: ${r.status} · ${urls.length} رابطاً متغيّراً`); if (!r.ok && r.status !== 202) process.exit(1);
  }
}

if (process.argv.includes('--inspect')) {
  const { inspectUrl } = await import('./_gsc.mjs');
  const changed = spawnSync('git', ['diff', '--name-only', `${LAST_SRC}~1`, LAST_SRC, '--', ...SRC], { encoding: 'utf8' }).stdout.split(/\r?\n/).filter(Boolean);
  const slugs = new Set(); for (const f of changed) { const src = readFileSync(f, 'utf8'); for (const m of src.matchAll(/"?slug"?\s*:\s*"([a-z0-9-]+)"/g)) slugs.add(m[1]); }
  const urls = URLS_ARG.length ? URLS_ARG : local.filter((u) => [...slugs].some((s) => u.endsWith(`/${s}`)));
  const out = []; let indexed = 0;
  for (const u of urls) { const r = await inspectUrl(gscProperty(HOST), u); const st = r?.indexStatusResult; const ok = st?.verdict === 'PASS' && /INDEXING_ALLOWED/.test(st?.indexingState ?? ''); if (ok && st?.coverageState && !/not indexed|غير مفهرس|لم تتم فهرست/i.test(st.coverageState)) indexed++; else out.push({ url: u, coverage: st?.coverageState ?? '?', lastCrawl: st?.lastCrawlTime ?? null }); console.log(`  ${ok && !out.some((x) => x.url === u) ? '✓' : '○'} ${u} · ${st?.coverageState ?? '?'}`); }
  const { writeFileSync } = await import('node:fs');
  writeFileSync('content-plan/index-request.json', JSON.stringify({ site: BASE, at: new Date().toISOString(), urls: out }, null, 2));
  console.log(`فحص الفهرسة: ${urls.length} رابطاً متغيّراً · مفهرس ${indexed} · يحتاج طلباً ${out.length} → content-plan/index-request.json (يُطلب عبر Chrome ببروتوكول خبير الفهرسة)`);
}
