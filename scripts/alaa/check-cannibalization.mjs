/**
 * تنافس الصفحات على الكلمة نفسها (استشاري): كلمة `keyword` متطابقة بين مقالين/دليلين بعد التطبيع،
 * أو عنوانان متشابهان ≥ 60% مع تقاطع كلمات ≥ 60%. المقالات noindex (المدموجة) مستثناة.
 */
import { loadContent } from './_ts.mjs';
import { CONFIG, isFull } from './_config.mjs';
const { ARTICLES, SERVICES, NOINDEX_SLUGS } = await loadContent();
const STOP = new Set(['في', 'من', 'على', 'عن', 'إلى', 'الى', 'مع', 'كيف', 'ما', 'هو', 'هي', 'كم', 'هل', 'التي', 'الذي', 'دليل', 'شامل', 'كامل', 'الأردن', 'الاردن', 'عمان', 'عمّان', 'و', 'أو', 'لك', 'لا', 'أن', 'قبل', 'بعد', '2026',
  // الكلمات العامة الإنجليزية لموقع ثنائي اللغة
  'the', 'a', 'an', 'to', 'from', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'by', 'with', 'is', 'how', 'what', 'your', 'you', 'guide', 'jordan', 'amman']);
const norm = (s) => s.toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w)));
const jac = (a, b) => { const i = [...a].filter((x) => b.has(x)).length; return i / (a.size + b.size - i || 1); };
const { articlePrefix: AP, servicePrefix: SP } = CONFIG.content;
// وضع الفحص فقط: الكلمة من أول <meta keywords> والعنوان من <title> في البناء
const fromDist = async () => { const { pages, isContent, keywordMap } = await import('./_dist.mjs'); const KM = keywordMap(); return pages().filter((p) => !p.noindex && isContent(p.url)).map((p) => { const kws = (p.html.match(/name="keywords"\s+content="([^"]*)"/)?.[1] ?? '').split(',').map((k) => k.trim()).filter(Boolean); const kw = KM.get(p.url) ?? kws[0] ?? ''; return { url: p.url, kw, title: p.html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '', kws: kws.length ? kws : kw ? [kw] : [] }; }); };
const items = [...(isFull() ? [...ARTICLES.filter((a) => !NOINDEX_SLUGS.includes(a.slug)).map((a) => ({ url: `${AP}${a.slug}`, kw: a.keyword, title: a.title, kws: a.keywords })),
  ...SERVICES.map((s) => ({ url: `${SP}${s.slug}`, kw: s.keyword, title: s.h1, kws: s.keywords }))] : await fromDist())]
  .map((x) => ({ ...x, p: norm(x.kw), tw: words(x.title), ks: new Set(x.kws.map(norm)) }));
const risky = [];
for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
  const a = items[i], b = items[j]; const same = a.p && a.p === b.p; const ts = jac(a.tw, b.tw), ks = jac(a.ks, b.ks);
  if (same || (ts >= 0.6 && ks >= 0.6)) risky.push({ a, b, same, ts, ks });
}
console.log(`صفحات مفحوصة: ${items.length} (مقالات ${ARTICLES.length - NOINDEX_SLUGS.length}، أدلة ${SERVICES.length})`);
if (!items.length) { console.error('✗ صفر صفحة'); process.exit(1); }
risky.sort((x, y) => y.same - x.same || y.ts - x.ts);
for (const r of risky) console.log(`  ${r.same ? '■ الكلمة نفسها' : `□ عنوان ${(r.ts * 100) | 0}%`} · كلمات ${(r.ks * 100) | 0}%\n     ${r.a.url} ← «${r.a.kw}»\n     ${r.b.url} ← «${r.b.kw}»`);
console.log(risky.length ? `⚠ ${risky.length} زوج يحتاج فصل نية (استشاري)` : '✓ لا تنافس على الكلمة الأساسية');
process.exit(risky.length ? 1 : 0);
