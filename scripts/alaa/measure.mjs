/**
 * حلقة القياس 28 يوماً وقاعدة STOP (من حزمة حسن):
 *   • يحفظ لقطة GSC (صفحة × استعلام) في content-plan/gsc-snapshots/<تاريخ>.json.
 *   • يقارنها بأقدم لقطة تفصلها ≥ 28 يوماً (أو أقرب لقطة مع تحذير «مبكر») لصفحات دفعات التحسين
 *     (content-plan/patches/*.json) ويحكم لكل صفحة: تحسّن / تراجع / بلا تغيير.
 *   • STOP: أقل من 100 ظهور للموقع في 28 يوماً ⇒ لا محتوى جديد (new-article.mjs يقرأ هذا الحكم من
 *     content-plan/measure.json). النشر والتحسين لا يتوقفان.
 *   node scripts/measure.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { siteUrl } from './_site-url.mjs';
import { searchAnalytics } from './_gsc.mjs';
import { CONFIG, gscProperty } from './_config.mjs';
const DIR = 'content-plan/gsc-snapshots';
/** حكم صفحة محسَّنة: b وa = { impr, posW } قبل وبعد، days = أيام منذ الدفعة. «مبكر» قبل 28 يوماً. */
/** خط أساس صفحة = أحدث لقطة بتاريخ ≤ تاريخ دفعتها (لا أقدم لقطة). */
export const baselineFor = (snaps, batchDate) => [...snaps].sort().filter((f) => f.slice(0, 10) <= batchDate).pop() ?? null;
/** مسار الصفحة: دليل الإجراء /services/، وإلا /blog/ (كان كل شيء /blog/ فقيست الأدلة على مسار خاطئ). */
export const pathFor = (slug, services) => (services.has(slug) ? `${CONFIG.content.servicePrefix}${slug}` : `${CONFIG.content.articlePrefix}${slug}`);
export function verdictFor(b, a, days) {
  const pb = b.impr ? b.posW / b.impr : 0, pa = a.impr ? a.posW / a.impr : 0;
  const raw = a.impr > b.impr * 1.2 || (pa && pb && pa < pb - 1) ? 'تحسّن' : a.impr < b.impr * 0.8 || (pa && pb && pa > pb + 1) ? 'تراجع' : 'بلا تغيير';
  return days < 28 ? `مبكر (${days} يوماً من 28)` : raw;
}
if (process.argv.includes('--selftest')) {
  const P = (impr, pos) => ({ impr, posW: impr * pos });
  const snaps = ['2026-10-01.json', '2026-11-22.json', '2026-11-29.json', '2026-12-20.json'];
  const T = [['خط الأساس = لقطة يوم الدفعة لا أقدمها', baselineFor(snaps, '2026-11-22'), '2026-11-22.json'], ['خط الأساس = آخر لقطة قبل الدفعة', baselineFor(snaps, '2026-11-25'), '2026-11-22.json'], ['لا لقطة قبل الدفعة', baselineFor(snaps, '2026-09-01'), null],
    ['دليل إجراء على بادئة الخدمات', pathFor('breast-surgery', new Set(['breast-surgery'])), `${CONFIG.content.servicePrefix}breast-surgery`], ['مقال على بادئة المقالات', pathFor('hydrafacial-amman', new Set(['breast-surgery'])), `${CONFIG.content.articlePrefix}hydrafacial-amman`], ['ظهور +50% بعد 30 يوماً', verdictFor(P(100, 10), P(150, 10), 30), 'تحسّن'], ['ترتيب 10 إلى 7', verdictFor(P(100, 10), P(100, 7), 30), 'تحسّن'],
    ['ظهور −30%', verdictFor(P(100, 10), P(70, 10), 30), 'تراجع'], ['ترتيب 10 إلى 13', verdictFor(P(100, 10), P(100, 13), 30), 'تراجع'],
    ['ثابت', verdictFor(P(100, 10), P(105, 10.5), 30), 'بلا تغيير'], ['قبل 28 يوماً', verdictFor(P(100, 10), P(300, 3), 10), 'مبكر (10 يوماً من 28)'], ['صفحة بلا ظهور سابق', verdictFor(P(0, 0), P(40, 15), 30), 'تحسّن']];
  let bad = 0; for (const [n, got, want] of T) { const ok = got === want; bad += !ok; console.log(`${ok ? '✓' : '✗'} ${n}: ${got}`); }
  console.log(bad ? `✗ ${bad} فشلت` : `✓ ${T.length} حالات صحيحة`); process.exit(bad ? 1 : 0);
}
mkdirSync(DIR, { recursive: true }); // بعد الاختبار: --selftest لا ينشئ مجلداً
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(); // محلي لا UTC
const r = await searchAnalytics(gscProperty(new URL(siteUrl()).host), { dimensions: ['page', 'query'] });
const dp = (u) => { try { return decodeURIComponent(new URL(u).pathname); } catch { return new URL(u).pathname; } }; // مسار مفكوك الترميز (روابط عربية)
const agg = (rows) => { const m = new Map(); for (const x of rows) { const p = dp(x.keys[0]); const o = m.get(p) ?? { impr: 0, clicks: 0, posW: 0 }; o.impr += x.impressions; o.clicks += x.clicks; o.posW += x.position * x.impressions; m.set(p, o); } return m; };
const snap = { date: today, period: [r.startDate, r.endDate], rows: r.rows };
writeFileSync(`${DIR}/${today}.json`, JSON.stringify(snap));
const total = r.rows.reduce((s, x) => s + x.impressions, 0), clicks = r.rows.reduce((s, x) => s + x.clicks, 0);
console.log(`لقطة ${today} (${r.startDate} → ${r.endDate}): ${total} ظهور · ${clicks} نقرة · ${agg(r.rows).size} صفحة`);
if (!r.rows.length) { console.error('✗ صفر صف من GSC'); process.exit(1); }
const stop = total < 100;
console.log(stop ? '⛔ STOP: أقل من 100 ظهور في 28 يوماً — لا محتوى جديد؛ المشكلة في الطلب/السلطة لا في عدد الصفحات' : '✓ فوق حد STOP (100 ظهور): التوليد مسموح من حيث القاعدة');
// الصفحات المحسَّنة: كل slug في ملفات الدفعات بتاريخ دفعته من اسم الملف، ومساره الحقيقي (دليل الإجراء /services/، وإلا /blog/)
const { loadContent } = await import('./_ts.mjs'); const { SERVICES } = await loadContent();
const SVC = new Set(SERVICES.map((s) => s.slug)); const pathOf = (slug) => pathFor(slug, SVC);
const improved = new Map();
if (existsSync('content-plan/patches')) for (const f of readdirSync('content-plan/patches').filter((x) => /^\d{4}-\d{2}-\d{2}.*\.json$/.test(x))) {
  const date = f.slice(0, 10); for (const slug of Object.keys(JSON.parse(readFileSync(`content-plan/patches/${f}`, 'utf8'))).filter((k) => !k.startsWith('_'))) improved.set(pathOf(slug), date);
}
// خط أساس كل صفحة = أحدث لقطة بتاريخ ≤ تاريخ دفعتها (لا أقدم لقطة)، والحكم النهائي فقط بعد ≥ 28 يوماً من الدفعة
const snaps = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== `${today}.json`).sort();
const after = agg(r.rows); const cache = new Map(); const snapAgg = (f) => cache.get(f) ?? cache.set(f, agg(JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')).rows)).get(f);
let verdicts = {};
if (improved.size) console.log(`صفحات الدفعات: ${improved.size}`);
for (const [p, date] of improved) {
  const base = baselineFor(snaps, date);
  const days = Math.round((new Date(today) - new Date(date)) / 864e5);
  if (!base) { verdicts[p] = { verdict: 'بلا خط أساس', batch: date }; console.log(`  بلا خط أساس ${p} (دفعة ${date}): لا لقطة بتاريخ ≤ الدفعة`); continue; }
  const b = snapAgg(base).get(p) ?? { impr: 0, clicks: 0, posW: 0 }, a = after.get(p) ?? { impr: 0, clicks: 0, posW: 0 };
  const pb = b.impr ? b.posW / b.impr : 0, pa = a.impr ? a.posW / a.impr : 0;
  const v = verdictFor(b, a, days);
  verdicts[p] = { verdict: v, batch: date, baseline: base.slice(0, 10), impr: [b.impr, a.impr], clicks: [b.clicks, a.clicks], pos: [+pb.toFixed(1), +pa.toFixed(1)] };
  console.log(`  ${v.padEnd(9)} ${p} (دفعة ${date}، أساس ${base.slice(0, 10)}): ظهور ${b.impr}→${a.impr} · نقرات ${b.clicks}→${a.clicks} · ترتيب ${pb.toFixed(1)}→${pa.toFixed(1)}`);
}
writeFileSync('content-plan/measure.json', JSON.stringify({ date: today, impressions: total, clicks, stop, verdicts }, null, 2));
console.log('✓ content-plan/measure.json');
