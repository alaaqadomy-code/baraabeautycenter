/**
 * check-cross-site-dup — تكرار الجمل بين مواقع علاء.
 *
 * نسخة الحزمة (~/.claude/skills/create-seo-site/scripts/check-cross-site-dup.mjs) تقرأ
 * src/content/*.md فتقيس «صفر جملة» هنا وتخرج 2. هذه تقرأ نص <main> في dist المبني
 * لكل موقع (نفس التطبيع وحدّ 8 كلمات)، فتقارن ما يُنشر فعلاً. موقع بلا dist لا يُقاس ويُذكر.
 * للتقرير عند الطلب لا للبوابة (يعتمد على مجلدات خارج المستودع).
 *
 *   node scripts/check-cross-site-dup.mjs [.] [مسار موقع آخر ...]
 *   (بلا مسارات: كل «موقع» في المركز projects.json)
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// --changed (حارس في check-all): جمل الصفحات المعدّلة أو المنشورة خلال آخر 28 يوماً فقط، ويجب أن تكون صفراً مع كل موقع آخر
const CHANGED = process.argv.includes('--changed');
let [target, ...others] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!target) target = '.';
if (!others.length) {
  const reg = 'C:/Users/JCC/Desktop/تحكم كلود/المركز/projects.json';
  if (!existsSync(reg)) { console.log(`⚠ لا سجل مواقع (${reg}): التكرار بين المواقع غير مفحوص على هذا الجهاز (ليس نجاحاً)`); process.exit(CHANGED ? 0 : 2); }
  const j = JSON.parse(readFileSync(reg, 'utf8'));
  const arr = Array.isArray(j) ? j : j.projects || Object.values(j);
  // يُستثنى الموقع المقيس نفسه بمساره فقط، وإلا قارن الموقع بنفسه
  const self = resolve(target).toLowerCase();
  others = arr.filter((p) => p.type === 'موقع').map((p) => p.path).filter(Boolean).filter((p) => resolve(p).toLowerCase() !== self);
}
if (!others.length) { console.error('لا مواقع للمقارنة'); process.exit(2); }

const walk = (d, o = []) => { for (const e of readdirSync(d)) { if (e === 'node_modules' || e === '.git') continue; const p = join(d, e); statSync(p).isDirectory() ? walk(p, o) : e.endsWith('.html') && o.push(p); } return o; };
const norm = (s) => s.replace(/[\u064B-\u0652\u0640\u0670]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/[ؤئ]/g, 'ء').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\u0621-\u064Aa-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
function sents(site) {
  // مواقع Next بتصدير ثابت تبني في out لا dist
  const dist = ['dist', 'out'].map((d) => join(site, d)).find((d) => existsSync(d)); const out = new Set();
  if (!dist) return null;
  for (const f of walk(dist)) addSents(readFileSync(f, 'utf8'), out);
  return out;
}
function addSents(html, out) {
  let h = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? html.replace(/<head[\s\S]*?<\/head>/, '');
  h = h.replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, ' ').replace(/<\/(p|li|h[1-6]|td|th|div|dd|dt|tr|summary|figcaption|blockquote)>|<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ');
  for (const r of h.split(/[.!?؟\n]+/)) { const t = norm(r); if (t.split(' ').length >= 8) out.add(t); }
}
let mine;
if (CHANGED) {
  const { pages, recentPages, requireChecked } = await import('./_dist.mjs'); const all = pages(); requireChecked(all.length); const rec = recentPages(all); mine = new Set();
  if (!rec.size) { console.log('✓ لا صفحات معدّلة خلال 28 يوماً: لا شيء جديد يُقارن بالمواقع الأخرى'); process.exit(0); }
  for (const p of all) if (rec.has(p.url)) addSents(p.html, mine);
  // الشرط على متن الصفحة لا القالب: جمل ملفات المكوّنات والقوالب في هذا الموقع لا تُحسب
  const { templateCorpus } = await import('./_dist.mjs'); const tpl = templateCorpus(norm); const before = mine.size;
  mine = new Set([...mine].filter((s) => !tpl.includes(s))); if (before > mine.size) console.log(`جمل من ملفات القالب مستبعدة: ${before - mine.size}`);
  console.log(`صفحات معدّلة خلال 28 يوماً: ${rec.size}`);
} else mine = sents(target);
if (!mine?.size) { console.error('⚠️ صفر جملة في الهدف — ابنِ الموقع أولاً'); process.exit(2); }
console.log('جمل الهدف:', mine.size);
let hits = 0, measured = 0;
for (const o of others) {
  const t = sents(o); if (!t) { console.log('— بلا dist (لم يُقس):', o); continue; }
  measured++;
  const sh = [...mine].filter((s) => t.has(s)); hits += sh.length;
  console.log(`${sh.length ? '✗' : '✓'} ${sh.length} مشتركة · ${t.size} جملة · ${o}`);
  sh.slice(0, 5).forEach((s) => console.log('    ' + s.slice(0, 160)));
}
console.log(`مواقع مقيسة: ${measured} من ${others.length} · المجموع المشترك: ${hits}`);
process.exit(hits ? 1 : 0);
