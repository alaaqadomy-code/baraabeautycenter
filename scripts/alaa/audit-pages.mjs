/** بنية كل صفحة: H1 واحد، canonical، وصف، lang/dir، og:image، JSON-LD صالح، صور بسمات، لا عنوان/وصف مكرر. */
import { pages, requireChecked } from './_dist.mjs';
import { CONFIG } from './_config.mjs';
const LOCALES = CONFIG.locales ? Object.entries(CONFIG.locales) : null;
const all = pages(); const issues = []; const titles = new Map(); const descs = new Map();
const push = (map, k, v) => { if (!map.has(k)) map.set(k, []); map.get(k).push(v); };
for (const { url, html, noindex } of all) {
  const add = (m) => issues.push(`${url} :: ${m}`);
  const h1 = (html.match(/<h1[\s>]/g) || []).length; if (h1 !== 1) add(`عدد H1 = ${h1}`);
  if (!noindex && !/rel="canonical"/.test(html)) add('لا canonical');
  const desc = html.match(/name="description"\s+content="([^"]*)"/)?.[1];
  if (!noindex && !desc) add('لا وصف ميتا');
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
  if (!title) add('لا <title>');
  // اللغة: بلا locales = موقع عربي (ar/rtl) كما كان. موقع متعدد اللغات (locales: {"/en": ["en","ltr"], "/ar": ["ar","rtl"]}):
  // اللغة المتوقعة من بادئة الرابط، وصفحات الجذر (404…) تقبل أي لغة معرّفة (تركيب jordanairporttransfer، 23 نوفمبر 2026)
  if (!LOCALES) {
    if (!/<html[^>]+lang="ar(-JO)?"/.test(html)) add('lang ليس ar');
    if (!/<html[^>]+dir="rtl"/.test(html)) add('dir ليس rtl');
  } else {
    const is = ([lang, dir]) => new RegExp(`<html[^>]+lang="${lang}(-[A-Za-z]{2})?"`).test(html) && new RegExp(`<html[^>]+dir="${dir}"`).test(html);
    const want = LOCALES.find(([p]) => url === p || url.startsWith(p + '/'));
    if (want ? !is(want[1]) : !LOCALES.some(([, l]) => is(l))) add(`lang/dir لا يطابق لغة الرابط${want ? ` (${want[1].join('/')})` : ''}`);
  }
  if (!noindex && !/property="og:image"/.test(html)) add('لا og:image');
  for (const b of html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []) {
    try { JSON.parse(b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')); } catch { add('JSON-LD غير صالح'); }
  }
  if (!noindex && url !== '/404' && !/application\/ld\+json/.test(html)) add('لا JSON-LD');
  for (const img of html.match(/<img[^>]*>/g) || []) {
    if (!/\salt[=\s>]/.test(img)) add('صورة بلا alt');
    // صور next/image بوضع fill تأخذ حجمها من إطار بأبعاد ثابتة (aspect-ratio)، فلا تحتاج width/height
    if (!/data-nimg="fill"/.test(img) && (!/\swidth=/.test(img) || !/\sheight=/.test(img))) add('صورة بلا width/height');
  }
  if ((html.match(/<a[^>]*>\s*<\/a>/g) || []).length) add('رابط بلا نص');
  if (!noindex) { push(titles, title, url); if (desc) push(descs, desc, url); }
}
for (const [t, u] of titles) if (u.length > 1) issues.push(`${u.join(' ، ')} :: عنوان مكرر «${t.slice(0, 40)}»`);
for (const [, u] of descs) if (u.length > 1) issues.push(`${u.join(' ، ')} :: وصف مكرر`);
console.log(`صفحات مفحوصة: ${all.length}`); requireChecked(all.length);
const g = {}; for (const i of issues) { const k = i.split(' :: ')[1].replace(/= \d+/, '= n').replace(/«.*»/, ''); g[k] = (g[k] || 0) + 1; }
for (const [k, v] of Object.entries(g)) console.log(`  ${v}× ${k}`);
issues.slice(0, 15).forEach((i) => console.log('    ' + i));
console.log(issues.length ? `✗ ${issues.length} مشكلة بنيوية` : '✓ لا مشاكل بنيوية');
process.exit(issues.length ? 1 : 0);
