/**
 * تحديث المقالات القديمة (محسّن حسن بلا نموذج توليد): يرشّح أقدم K مقال لم يُحدَّث منذ أشهر وله ظهور في
 * Search Console، ويكتب لكل واحد موجزاً في content-plan/refresh-brief.md: الاستعلامات الفعلية التي ظهر عليها
 * (من content-plan/gsc-raw.json الذي ينتجه `npm run gsc`) وأسئلته الحالية، ليُكتب له قسم أو سؤال حقيقي يحمل
 * الاستعلام ثم يُطبَّق بـ apply-patch (الذي يرفع `updated` بصدق لأن المحتوى تغيّر). لا يرفع تاريخاً بلا تغيير.
 *   node scripts/refresh-old-articles.mjs [count=5] [--min-impr=5]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { listPages, readPage } from './_content.mjs';
import { requireFull } from './_config.mjs';
requireFull('refresh-old-articles');
const K = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 5);
const MIN = Number((process.argv.find((a) => a.startsWith('--min-impr=')) || '=5').split('=')[1]);
if (!existsSync('content-plan/gsc-raw.json')) { console.error('✗ لا content-plan/gsc-raw.json — شغّل npm run gsc أولاً'); process.exit(1); }
const raw = JSON.parse(readFileSync('content-plan/gsc-raw.json', 'utf8'));
const byPage = new Map();
const dp = (u) => { try { return decodeURIComponent(new URL(u).pathname); } catch { return new URL(u).pathname; } }; // مسار مفكوك الترميز (روابط عربية)
for (const r of raw.rows) { const p = dp(r.keys[1]); const o = byPage.get(p) ?? { impr: 0, clicks: 0, qs: [] }; o.impr += r.impressions; o.clicks += r.clicks; o.qs.push({ q: r.keys[0], impr: r.impressions, pos: r.position }); byPage.set(p, o); }
const pages = (await listPages()).filter((p) => p.kind === 'article' && p.updated);
const cands = pages.map((p) => ({ ...p, gsc: byPage.get(p.url) })).filter((p) => p.gsc && p.gsc.impr >= MIN)
  .sort((a, b) => a.updated.localeCompare(b.updated) || b.gsc.impr - a.gsc.impr).slice(0, K);
console.log(`مقالات بظهور ≥ ${MIN}: ${pages.filter((p) => byPage.get(p.url)?.impr >= MIN).length} من ${pages.length} · مرشّحة للتحديث: ${cands.length}`);
if (!cands.length) process.exit(1);
let md = `# موجز تحديث المقالات القديمة — ${new Date().toISOString().slice(0, 10)} (${raw.startDate} → ${raw.endDate})\n\nلكل مقال: اكتب سؤالاً أو قسماً يجيب الاستعلام الأعلى ظهوراً من محتوى المقال ومصادره (لا رقم جديد بلا مصدر)، ثم ضعه في ملف patch وطبّقه بـ apply-patch.\n\n**تذكير الكتابة:** كل نص متوافق مع SEO وAEO وGEO وإجابات الذكاء الاصطناعي معاً: جواب مباشر في أول فقرة، عناوين بصيغة سؤال الباحث، فقرات قصيرة قابلة للاقتباس، جدول أو قائمة حين تفيد، حقائق بمصادر، أسئلة شائعة حقيقية، روابط داخلية طبيعية. ثم humanizer.\n`;
for (const c of cands) {
  const a = await readPage(c.slug); const qs = c.gsc.qs.sort((x, y) => y.impr - x.impr).slice(0, 8);
  md += `\n## ${c.url} — آخر تحديث ${c.updated} · ${c.gsc.impr} ظهور · ${c.gsc.clicks} نقرة\n`;
  md += `الاستعلامات: ${qs.map((q) => `«${q.q}» (${q.impr}، ترتيب ${q.pos.toFixed(0)})`).join('، ')}\n`;
  md += `الأسئلة الحالية: ${a.faqs.map((f) => f.q).join(' | ')}\n`;
  console.log(`  ${c.updated}  ${c.url}  ${c.gsc.impr} ظهور · أعلى استعلام «${qs[0].q}»`);
}
mkdirSync('content-plan', { recursive: true }); writeFileSync('content-plan/refresh-brief.md', md);
console.log('✓ content-plan/refresh-brief.md');
