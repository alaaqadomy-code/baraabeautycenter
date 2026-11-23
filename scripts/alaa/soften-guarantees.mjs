/**
 * تليين الضمانات (محسّن حسن فوق طبقة الكتابة): كل جملة يرفضها check-claims بقاعدة «ضمان» في المتن
 * الفعّال للمقالات تُقترح لها صيغة احتمال بدل صيغة الوعد. القاعدة نفسها التي تحكم البوابة (sentenceFault)
 * فلا تعريفان لقاعدة واحدة.
 *   node scripts/soften-guarantees.mjs            → تجربة: يطبع الجمل والصيغ المقترحة
 *   node scripts/soften-guarantees.mjs --write    → يكتب ملف دفعة مسودة content-plan/patches-draft/<اليوم>-soften.json
 * لا يكتب في الصفحات أبداً (كان `--apply` يكتب مباشرة متجاوزاً بوابة الدفعة؛ تدقيق 23 نوفمبر 2026). المسودة تُقرأ جملةً جملة،
 * ثم يُضاف إليها "_review" وتُنقل إلى content-plan/patches/ وتُطبَّق بـ apply-patch (5 صفحات، 28 يوماً، الإقرار).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { listPages, readPage } from './_content.mjs';
import { sentenceFault } from './check-claims.mjs';
import { localDay } from './apply-patch.mjs';
import { requireFull } from './_config.mjs';
requireFull('soften-guarantees');
const SOFT = [['يضمن لك', 'يتيح لك'], ['ويضمن ', 'ويحسّن فرص '], ['يضمن ', 'يحسّن فرص '], ['نضمن لك', 'نساعدك على'], ['نضمن ', 'نعمل على '], ['نتائج مضمونة', 'نتائج متوقعة'], ['مضمونة 100%', 'غير مضمونة']];
const write = process.argv.includes('--write') || process.argv.includes('--apply');
let hits = 0; const patch = {};
for (const p of await listPages()) {
  const a = await readPage(p.slug);
  const texts = [a.answer, ...a.sections.flatMap((s) => [...s.paragraphs, ...(s.list ?? [])]), ...a.faqs.map((f) => f.a)].filter(Boolean);
  const replace = [];
  for (const t of texts) for (const s of t.replace(/<[^>]+>/g, ' ').split(/(?<=[.!؟?])\s+/)) {
    if (sentenceFault(s) !== 'ضمان') continue;
    hits++; const to = SOFT.reduce((acc, [f, r]) => acc.split(f).join(r), s);
    if (to === s) { console.log(`  ⚠ ${p.slug}: لا صيغة تليين لـ «${s.slice(0, 80)}»`); continue; }
    replace.push({ from: s, to }); console.log(`  ○ ${p.slug}: «${s.slice(0, 70)}» ← «${to.slice(0, 70)}»`);
  }
  if (replace.length) patch[p.slug] = { replace };
}
const n = Object.keys(patch).length;
if (write && n) {
  mkdirSync('content-plan/patches-draft', { recursive: true }); const f = `content-plan/patches-draft/${localDay()}-soften.json`;
  writeFileSync(f, JSON.stringify(patch, null, 2));
  console.log(`✓ مسودة دفعة: ${f} (${n} صفحة). اقرأ كل جملة، أضف "_review"، انقلها إلى content-plan/patches/ ثم npm run patch -- <الملف>.${n > 5 ? ` ⚠ ${n} صفحة > 5: قسّمها على دفعات.` : ''}`);
}
console.log(`جمل ضمان: ${hits} · صفحات مقترحة: ${n}${write ? '' : ' (تجربة؛ أضف --write لكتابة مسودة الدفعة)'}`);
