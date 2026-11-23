/** قاعدة الموقع (CLAUDE.md): العنوان ≤ 60 حرفاً والوصف 120–160 لكل صفحة مفهرسة. الكيانات تُفكّ قبل القياس. */
import { pages, requireChecked } from './_dist.mjs';
import { CONFIG } from './_config.mjs';
const MAX_T = Number(process.env.MAX_TITLE || CONFIG.titleMax), MIN_D = CONFIG.descMin, MAX_D = CONFIG.descMax;
const de = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(d));
const all = pages().filter((p) => !p.noindex && p.url !== '/404'); const bad = [];
for (const { url, html } of all) {
  const t = de(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''), d = de(html.match(/name="description"\s+content="([^"]*)"/)?.[1] ?? '');
  if ([...t].length > MAX_T) bad.push(`${url} :: عنوان ${[...t].length} حرفاً`);
  if ([...d].length < MIN_D || [...d].length > MAX_D) bad.push(`${url} :: وصف ${[...d].length} حرفاً`);
}
console.log(`صفحات مفهرسة مفحوصة: ${all.length}`); requireChecked(all.length);
bad.forEach((b) => console.log('  ✗ ' + b));
console.log(bad.length ? `✗ ${bad.length} عنوان/وصف خارج الحدود (≤${MAX_T} / ${MIN_D}–${MAX_D})` : '✓ كل العناوين والأوصاف ضمن الحدود');
process.exit(bad.length ? 1 : 0);
