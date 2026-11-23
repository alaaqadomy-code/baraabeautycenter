/**
 * H1 كل مقال ودليل إجراء يحمل كلمته الأساسية: حقل `keyword` في Article/Service (مصدر الحقيقة في هذا
 * الموقع، لا <meta keywords> التي تحمل القائمة الكاملة). الصفحات الأخرى: أول عنصر في <meta keywords>.
 * مطابقة بجذر تقريبي (بادئة ≥4 أحرف، تطبيع الهمزات والتاء المربوطة) كما في حزمة حسن.
 */
import { pages, text, requireChecked, keywordMap } from './_dist.mjs';
import { loadContent } from './_ts.mjs';
import { CONFIG } from './_config.mjs';
const { ARTICLES, SERVICES } = await loadContent();
const { articlePrefix: AP, servicePrefix: SP } = CONFIG.content;
const KW = new Map([...keywordMap(), ...ARTICLES.map((a) => [`${AP}${a.slug}`, a.keyword]), ...SERVICES.map((s) => [`${SP}${s.slug}`, s.keyword])]);
const EXEMPT = new RegExp(CONFIG.h1Exempt);
const STOP = new Set(['في', 'من', 'على', 'عن', 'مع', 'الى', 'إلى', 'ما', 'هل', 'و', 'أو', 'بين', 'لا', 'أن', 'هو', 'هي', 'التي', 'الذي', 'كيف', 'بعد', 'قبل', 'كم', 'كل', 'أي',
  'the', 'a', 'an', 'to', 'from', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'by', 'with', 'is', 'how', 'what', 'your', 'you', 'get']);
const norm = (t) => t.replace(/[ً-ْـ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').normalize('NFKC').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
const stem = (w) => w.replace(/^(ال|بال|فال|كال|وال|لل)/, '');
const words = (t) => norm(t).split(' ').filter((w) => w && !STOP.has(w)).map(stem);
function match(a, b) {
  if (a === b) return true; const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length >= 4 && (l.startsWith(s) || (/^[وفبلك]/.test(l) && l.slice(1).startsWith(s)))) return true;
  if (s.length >= 3 && s[0] === l[0] && l.length - s.length <= 3) { let i = 0; for (const ch of l) if (ch === s[i]) i++; if (i === s.length) return true; }
  return false;
}
const cover = (h1, kw) => { const have = words(h1), want = words(kw); return want.length ? want.filter((w) => have.some((h) => match(h, w))).length / want.length : 1; };
const fails = []; let ok = 0, checked = 0;
for (const { url, html, noindex } of pages()) {
  if (noindex || EXEMPT.test(url)) continue;
  const kw = KW.get(url) ?? html.match(/name="keywords" content="([^"،]+)/)?.[1]?.trim();
  const h1 = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '');
  if (!kw || !h1) { fails.push({ url, h1, kw: kw ?? '(بلا كلمة)', r: 0 }); continue; }
  checked++; const r = cover(h1, kw); if (r >= 1) ok++; else fails.push({ url, h1, kw, r });
}
console.log(`صفحات مفحوصة: ${checked} (مقالات ${ARTICLES.length}، أدلة ${SERVICES.length}) · H1 يحمل الكلمة: ${ok}`); requireChecked(checked);
for (const f of fails.sort((a, b) => a.r - b.r)) console.log(`  ✗ ${f.r.toFixed(2)} ${f.url}\n      H1: ${f.h1}\n      الكلمة: ${f.kw}`);
console.log(fails.length ? `✗ ${fails.length} صفحة بفجوة بين H1 والكلمة` : '✓ كل H1 يحمل كلمته الأساسية');
process.exit(fails.length ? 1 : 0);
