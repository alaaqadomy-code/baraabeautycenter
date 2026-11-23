/**
 * الأسئلة الظاهرة وFAQPage متطابقتان، في كل صفحات dist:
 *   • كل سؤال في السكيما ظاهر نصاً في <main> (داخل <summary> أو أي عنصر آخر: موقع يعرض بعض الأسئلة مفتوحة في <h3>).
 *   • كل سؤال ظاهر في <summary> (نصه سؤال بـ«؟») موجود في السكيما.
 *   • موقع بلا أسئلة شائعة إطلاقاً: «غير منطبق» صريح، والصفحات نفسها مفحوصة (لا أخضر على صفر صفحة).
 */
import { pages, main, text, requireChecked } from './_dist.mjs';
const errors = []; let withFaq = 0, questions = 0; const all = pages();
for (const { url, html } of all) {
  const body = text(main(html));
  const summaries = [...main(html).matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)].map((m) => text(m[1]));
  const shown = summaries, asked = summaries.filter((s) => /[؟?]/.test(s));
  const schema = [];
  for (const b of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let j; try { j = JSON.parse(b[1]); } catch { continue; }
    for (const n of j['@graph'] ?? [j]) if (n['@type'] === 'FAQPage') for (const q of n.mainEntity ?? []) schema.push(text(q.name ?? ''));
  }
  if (!shown.length && !schema.length) continue;
  withFaq++; questions += schema.length;
  if (!schema.length) errors.push(`${url} :: ${shown.length} سؤال ظاهر بلا FAQPage`);
  else {
    for (const q of schema) if (!shown.some((s) => s.includes(q)) && !body.includes(q)) errors.push(`${url} :: سؤال في السكيما غير ظاهر «${q.slice(0, 50)}»`);
    for (const s of asked) if (!schema.some((q) => s.includes(q) || q.includes(s))) errors.push(`${url} :: سؤال ظاهر خارج السكيما «${s.slice(0, 50)}»`);
    if (asked.length > schema.length) errors.push(`${url} :: ظاهر ${asked.length} ≠ سكيما ${schema.length}`);
  }
}
console.log(`صفحات مفحوصة: ${all.length} · بأسئلة: ${withFaq} · أسئلة في السكيما: ${questions}`); requireChecked(all.length);
if (!withFaq) console.log('○ لا أسئلة شائعة في هذا الموقع: غير منطبق (ليس نجاحاً ولا فشلاً)');
errors.forEach((e) => console.log('  ✗ ' + e));
console.log(errors.length ? `✗ ${errors.length} مخالفة` : '✓ كل سؤال في FAQPage ظاهر والعدد متطابق');
process.exit(errors.length ? 1 : 0);
