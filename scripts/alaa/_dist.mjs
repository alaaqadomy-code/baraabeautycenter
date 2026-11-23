/**
 * أدوات مشتركة لفواحص dist: المشي على كل HTML (الجذر وblog/ وservices/)، وتحويل الملف إلى مسار
 * (build.format "file": /x.html → /x)، واستخراج <main>. كل فاحص يطبع عدّاده ويفشل إن فحص صفراً.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CONFIG } from './_config.mjs';

export const DIST = process.env.DIST || CONFIG.dist;
/** ملفات تحقّق الملكية ليست صفحات. */
const VERIFY_FILE = /^(google[0-9a-f]{10,}|BingSiteAuth)\.(html|xml)$/i;

export function pages() {
  if (!existsSync(DIST)) { console.error(`✗ لا مجلد ${DIST} — شغّل npm run build أولاً`); process.exit(1); }
  const out = [];
  (function walk(d) {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith('.html') && !VERIFY_FILE.test(e)) out.push(p);
    }
  })(DIST);
  return out.map((file) => {
    const rel = file.replace(/\\/g, '/').slice(DIST.length);
    // build.format "file" (/x.html → /x) أو مجلدات (/x/index.html → /x، أو /x/ مع trailingSlash)
    const url = rel === '/index.html' ? '/' : /\/index\.html$/.test(rel) ? rel.replace(/\/index\.html$/, CONFIG.trailingSlash ? '/' : '') : rel.replace(/\.html$/, '');
    const html = readFileSync(file, 'utf8');
    return { file, url, html, noindex: /name="robots"[^>]*content="[^"]*noindex/.test(html) };
  });
}
/** كلمة كل مقال من مصدره (content.keywordSources: بادئة رابط ← ملفات TS فيها slug ثم حقل الكلمة content.keywordField، افتراضياً primaryKeyword أو keyword). */
const KW_RE = () => new RegExp(String.raw`slug:\s*"([^"]+)"[\s\S]{0,1500}?(?:` + (CONFIG.content?.keywordField ?? 'primaryKeyword|keyword') + String.raw`):\s*"([^"]+)"`, 'g');
export function keywordMap() {
  const map = new Map();
  for (const [prefix, files] of Object.entries(CONFIG.content?.keywordSources ?? {})) for (const f of files) {
    if (!existsSync(f)) { console.error(`✗ keywordSources: لا ملف ${f}`); process.exit(1); }
    for (const m of readFileSync(f, 'utf8').matchAll(KW_RE())) map.set(`${prefix}${m[1]}`, m[2]);
  }
  return map;
}
export const main = (html) => html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? '';
export const text = (h) => h.replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(d)).replace(/\s+/g, ' ').trim();
/** صفحة محتوى = مقال أو دليل إجراء (لا فهارس ولا صفحات ثقة). */
const CONTENT = new RegExp(CONFIG.contentPattern), EXCL = CONFIG.contentExclude ? new RegExp(CONFIG.contentExclude) : null;
export const isContent = (url) => CONTENT.test(url) && !(EXCL && EXCL.test(url));
/** لا فاحص يمرّ أخضر على صفر صفحة. */
export function requireChecked(n, what = 'صفحة') {
  if (!n) { console.error(`✗ فُحص صفر ${what} — الفاحص لم يرَ شيئاً، وهذه ليست نتيجة`); process.exit(1); }
}

/**
 * الصفحات «المعدّلة حديثاً» (آخر `days` يوماً)، ويُطبَّق عليها التشابه بحزم:
 *   • صفحات ملفات الدفعات في content-plan/patches (مفاتيح الدفعة و_pages) بتاريخ ملف حديث، مطابقةً بآخر جزء من الرابط؛
 *   • وكل صفحة في البناء تاريخ نشرها أو تعديلها (JSON-LD datePublished/dateModified أو meta article:*_time) حديث.
 * يُرجع Set من روابط البناء (url).
 */
export function recentPages(all = pages(), days = 28, now = Date.now()) {
  const fresh = (d) => { const t = Date.parse(String(d).slice(0, 10)); return t && (now - t) / 864e5 < days && t <= now + 864e5; };
  const keys = new Set(); const dir = 'content-plan/patches';
  if (existsSync(dir)) for (const f of readdirSync(dir)) {
    if (!/^\d{4}-\d{2}-\d{2}.*\.json$/.test(f) || !fresh(f)) continue;
    let j; try { j = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    for (const k of [...(j._pages ?? []), ...Object.keys(j).filter((k) => !k.startsWith('_'))]) keys.add(String(k).replace(/\/$/, '').split('/').pop());
  }
  const out = new Set();
  for (const p of all) {
    const last = p.url.replace(/\/$/, '').split('/').pop();
    const dates = [...p.html.matchAll(/"date(?:Published|Modified)"\s*:\s*"([^"]+)"/g), ...p.html.matchAll(/property="article:(?:published|modified)_time"\s+content="([^"]+)"/g)].map((m) => m[1]);
    if ((last && keys.has(last)) || dates.some(fresh)) out.add(p.url);
  }
  return out;
}

/**
 * نص القالب: كل ما هو مكتوب في ملفات المكوّنات والقوالب (componentDirs في الإعداد)، مطبَّعاً بدالة الفاحص نفسه.
 * شروط التشابه على متن الصفحة (المحتوى) لا القالب (قرار علاء 23 نوفمبر 2026): جملة موجودة هنا لا تُحسب تكراراً.
 */
export function templateCorpus(norm) {
  const dirs = CONFIG.componentDirs ?? ['components', 'layouts', 'src/components', 'src/layouts', 'app/components'];
  const out = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) { if (!/^(node_modules|\.git)$/.test(e.name)) walk(p); } else if (/\.(astro|tsx|jsx|vue|svelte|html|njk|liquid|hbs)$/.test(e.name)) out.push(norm(readFileSync(p, 'utf8').replace(/<[^>]+>/g, ' '))); } };
  for (const d of dirs) if (existsSync(d)) walk(d);
  return out.join(' \n ');
}
