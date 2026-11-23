/**
 * جودة صفحات المحتوى (استشاري، لا يدخل البوابة): كل مقال/دليل > 450 كلمة يحمل رابطاً خارجياً موثوقاً
 * (مصدر) وصورة بسمات كاملة. إصلاحه إضافة محتوى، وهي ممنوعة في هذه الجولة؛ النتيجة تُذكر لعلاء.
 */
import { pages, main, text, isContent, requireChecked } from './_dist.mjs';
import { siteUrl } from './_site-url.mjs';
const HOST = new URL(siteUrl()).host; const MIN_WORDS = 450;
const issues = []; let checked = 0;
for (const { url, html, noindex } of pages()) {
  if (noindex || !isContent(url)) continue;
  const m = main(html); const words = text(m).split(' ').length; if (words < MIN_WORDS) continue;
  checked++;
  const ext = [...m.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]+)"/g)].map((x) => x[1]).filter((h) => { try { return new URL(h).host !== HOST && !/wa\.me/.test(h); } catch { return false; } });
  if (!ext.length) issues.push(`${url} :: بلا رابط خارجي موثوق (${words} كلمة)`);
  const imgs = [...m.matchAll(/<img\b[^>]*>/g)].map((x) => x[0]).filter((t) => !/alt=""|alt\s|alt>/.test(t));
  if (!imgs.length) issues.push(`${url} :: بلا صورة ذات alt وصفي`);
  else if (!imgs.some((t) => /alt="[^"]{8,}"/.test(t) && /width=/.test(t) && /height=/.test(t))) issues.push(`${url} :: لا صورة بسمات كاملة`);
}
console.log(`صفحات محتوى مفحوصة (>${MIN_WORDS} كلمة): ${checked}`); requireChecked(checked);
const g = {}; for (const i of issues) { const k = i.split(' :: ')[1].replace(/\(.*\)/, ''); g[k] = (g[k] || 0) + 1; }
for (const [k, v] of Object.entries(g)) console.log(`  ${v}× ${k}`);
issues.filter((i) => /خارجي/.test(i)).slice(0, 10).forEach((i) => console.log('    ' + i));
console.log(issues.length ? `✗ ${issues.length} ثغرة جودة (استشاري)` : '✓ كل صفحة محتوى بمصدر خارجي وصورة سليمة');
process.exit(issues.length ? 1 : 0);
