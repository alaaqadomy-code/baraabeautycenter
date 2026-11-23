/**
 * فرص Search Console (أداة تشخيص لا خطة نشر): آخر 28 يوماً، استعلام × صفحة.
 *   🎯 قريب من الصفحة الأولى (ترتيب 4–20) والصفحة المالكة معروفة → قوِّ الصفحة بقسم/سؤال يحمل الاستعلام.
 *   ✏️ ترتيب ≤ 5 ونقر ضعيف → أعد كتابة العنوان والوصف.
 *   🆕 بلا صفحة مالكة → مرشّح لصفحة جديدة (معلّق: لا محتوى جديد بقرار علاء).
 * المالك = الصفحة التي ظهر عليها الاستعلام فعلاً في GSC (بُعد page)، وإلا أقرب عنوان/H1/كلمة من الخريطة الحية.
 *   node scripts/gsc-opportunities.mjs                 # يقرأ GSC بحساب الخدمة
 *   node scripts/gsc-opportunities.mjs gsc.json [--min-impr=10]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { siteUrl } from './_site-url.mjs';
import { loadContent } from './_ts.mjs';
import { searchAnalytics } from './_gsc.mjs';
import { CONFIG, gscProperty } from './_config.mjs';

// ── مالك الكلمة (دالة نقية مُختبرة بـ --selftest) ──
const norm = (s) => String(s).toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ً-ْ؟?!.,«»"':]/g, '').replace(/\s+/g, ' ').trim();
const STOP = new Set(['في', 'من', 'على', 'الى', 'إلى', 'مع', 'عن', 'و', 'كم', 'هل', 'ما', 'او', 'ام', 'ولا', 'بعد', 'قبل', 'لل']);
// كلمات لا تحدد الموضوع: المدن، السعر، التفضيل، الجنس العام للخدمة. بدونها كان «سعر شقة للايجار في عمان» يُنسب إلى صفحة
// الهيدرافيشل لأن كلتيهما فيها «سعر» و«عمان» (تدقيق 23 نوفمبر 2026).
const GENERIC = new Set(['سعر', 'اسعار', 'السعر', 'الاسعار', 'تكلفه', 'التكلفه', 'تكاليف', 'كلفه', 'بكم', 'افضل', 'احسن', 'اشهر', 'عمليه', 'عمليات', 'العمليه', 'تجميل', 'التجميل', 'الاردن', 'بالاردن', 'عمان', 'بعمان', 'اربد', 'الزرقاء', 'العقبه', 'السلط', 'مادبا', 'جرش', 'الخليج', 'السعوديه', 'دكتور', 'الدكتور', 'طبيب', 'مركز', 'مراكز', 'عياده', 'عيادات', 'قريب', 'موقعي', '2026', '2025', 'دليل']);
const toks = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w)));
// صيغ السعر والتكلفة كلها عامة: «بكلف»، «تكلفتها»، «سعره»، «بتكلف»
const isGeneric = (w) => GENERIC.has(w) || /^(ب?كم|ب?ت?كلف|تكاليف|(ال)?سعر|ب?(ال)?اسعار|ثمن)/.test(w);
const core = (s) => new Set([...toks(s)].filter((w) => !isGeneric(w)));
/** نسبة الكلمات الجوهرية في الاستعلام التي تغطيها عبارة الصفحة الأقرب. */
const cover = (q, o) => { const qc = core(q); if (!qc.size || !o) return 0; let best = 0; for (const t of o.t) best = Math.max(best, [...qc].filter((w) => t.has(w)).length / qc.size); return best; };
/**
 * المالك بالترتيب: (0) صفحة GSC في أول 10 نتائج مالكة دائماً (جوجل نفسها قررت، ولو اختلفت الكتابة «هيدروفيشن»)؛
 * (1) صفحة GSC في أول 20 نتيجة إن غطّت ⅓ كلمات الاستعلام الجوهرية؛ (2) الصفحة التي تغطي ½ الكلمات الجوهرية فأكثر؛
 * (3) صفحة GSC البعيدة إن غطّت ⅓؛ وإلا لا مالك. استعلام بلا كلمة جوهرية («سعر في عمان») يُنسب لصفحة GSC ولا يصير مرشّحاً لصفحة.
 * owners: [{ path, t: [Set(tokens) لكل عنوان/H1/كلمة] }]
 */
export function ownerOf(q, pos, page, owners) {
  const byPath = (p) => owners.find((o) => o.path === p);
  if (!core(q).size) return page ?? null;
  if (page && pos <= 10) return page;
  if (page && pos <= 20 && cover(q, byPath(page)) >= 1 / 3) return page;
  // عند التعادل يُفضَّل دليل الإجراء (/services/) لأنه المحور، لا مقال فرعي ('زرع الشعر في عمان' للمحور لا لصفحة الحكم الشرعي)
  let best = null, sc = 0; for (const o of owners) { const c = cover(q, o); if (c > sc || (c === sc && c > 0 && o.path.startsWith('/services/') && !best?.startsWith('/services/'))) { sc = c; best = o.path; } }
  if (sc >= 0.5) return best;
  if (page && cover(q, byPath(page)) >= 1 / 3) return page;
  return null;
}
/** الاستعلام من موضوع الموقع: كلمة جوهرية واحدة على الأقل في مفردات صفحاته. «سعر شقة للايجار» و«مركز بريما خلدا» ليست مرشحاً لصفحة. */
export function onTopic(q, owners) { const vocab = new Set(owners.flatMap((o) => o.t.flatMap((t) => [...t]))); return [...core(q)].some((w) => vocab.has(w)); }
if (process.argv.includes('--selftest')) {
  const O = (path, ...ph) => ({ path, t: ph.map(toks) });
  const owners = [O('/blog/hydrafacial-amman', 'هيدرافيشل في عمان', 'ما هو الهيدرافيشل وسعر الجلسة في عمان'), O('/blog/lip-filler-price-jordan', 'سعر فيلر الشفايف في الأردن', 'فيلر الشفايف'),
    O('/services/hair-transplant', 'زراعة الشعر في الأردن'), O('/blog/hollywood-smile-price-jordan', 'سعر ابتسامة هوليود في الأردن'), O('/blog/hair-transplant-islam-halal', 'هل زراعة الشعر حرام', 'حكم زراعة الشعر'), O('/best-laser-centers-amman', 'أفضل مراكز ليزر في عمان', 'مراكز ليزر في عمان')];
  const T = [
    ['سعر شقة للايجار في عمان', 45, '/blog/hydrafacial-amman', null],
    ['سعر تبييض الاسنان بالليزر في اربد', 40, '/blog/hollywood-smile-price-jordan', null],
    ['فيلر الشفايف المنتفخة', 15, '/blog/hydrafacial-amman', '/blog/lip-filler-price-jordan'],
    ['هل زراعة الشعر حرام', 29, '/blog/hair-transplant-islam-halal', '/blog/hair-transplant-islam-halal'],
    ['زرع الشعر حلال ولا حرام', 25, '/blog/hair-transplant-islam-halal', '/blog/hair-transplant-islam-halal'],
    ['أفضل مركز ليزر في عمان', 7, '/best-laser-centers-amman', '/best-laser-centers-amman'],
    ['هيدرافيشل', 4.7, '/blog/hydrafacial-amman', '/blog/hydrafacial-amman'],
    ['هيدروفيشن', 1, '/blog/hydrafacial-amman', '/blog/hydrafacial-amman'],
    ['كم بكلف', 3.3, '/blog/laser-hair-removal-price-jordan', '/blog/laser-hair-removal-price-jordan'],
    ['كم سعره', 25, '/blog/hydrafacial-amman', '/blog/hydrafacial-amman'],
    // «زراعة الشعر في تركيا» لصفحة زراعة الشعر: قسم مقارنة فيها، لا صفحة دولة مستقلة (قاعدة علاء: لا صفحة مدينة/دولة تلقائياً)
    ['زراعة الشعر في تركيا', 50, '/services/hair-transplant', '/services/hair-transplant'],
    ['زرع الشعر في عمان', 30, null, '/services/hair-transplant'],
  ];
  owners.push(O('/services/cosmetic-dentistry', 'تجميل الأسنان في الأردن'));
  const topic = [['سعر شقة للايجار في عمان', false], ['مركز بريما خلدا', false], ['ozel laser clinic', false], ['سعر تبييض الاسنان بالليزر في اربد', true]];
  let bad = 0; for (const [q, want] of topic) { const got = onTopic(q, owners); const ok = got === want; bad += !ok; console.log(`${ok ? '✓' : '✗'} «${q}» ${got ? 'من موضوع الموقع (مرشّح إن لم يكن له مالك)' : 'خارج موضوع الموقع (ليس مرشحاً)'}`); }
  for (const [q, pos, page, want] of T) { const got = ownerOf(q, pos, page, owners); const ok = got === want; bad += !ok; console.log(`${ok ? '✓' : '✗'} «${q}» (ترتيب ${pos}) ← ${got ?? 'لا مالك'}${ok ? '' : ` (المتوقع ${want ?? 'لا مالك'})`}`); }
  console.log(bad ? `✗ ${bad} حالة فشلت` : `✓ ${T.length + topic.length} حالة صحيحة`); process.exit(bad ? 1 : 0);
}

const dp = (u) => { try { return decodeURIComponent(new URL(u).pathname); } catch { return new URL(u).pathname; } }; // مسار مفكوك الترميز (روابط عربية)
const BASE = siteUrl(); const PROPERTY = gscProperty(new URL(BASE).host);
const file = process.argv.find((a) => !a.startsWith('-') && /\.json$/.test(a));
const MIN = Number((process.argv.find((a) => a.startsWith('--min-impr=')) || '=10').split('=')[1]);
let period = '', rows;
if (file) rows = JSON.parse(readFileSync(file, 'utf8')).rows ?? JSON.parse(readFileSync(file, 'utf8'));
else { const r = await searchAnalytics(PROPERTY, { dimensions: ['query', 'page'] }); rows = r.rows; period = `${r.startDate} → ${r.endDate}`; mkdirSync('content-plan', { recursive: true }); writeFileSync('content-plan/gsc-raw.json', JSON.stringify(r)); }
// استعلام واحد قد يظهر على صفحات عدة: نأخذ الصفحة الأعلى ظهوراً ونجمع الأرقام
const byQ = new Map();
for (const r of rows) {
  const q = r.keys[0], page = r.keys[1] ? dp(r.keys[1]) : null;
  const o = byQ.get(q) ?? { q, clicks: 0, impr: 0, posW: 0, pages: new Map() };
  o.clicks += r.clicks; o.impr += r.impressions; o.posW += r.position * r.impressions;
  if (page) o.pages.set(page, (o.pages.get(page) ?? 0) + r.impressions);
  byQ.set(q, o);
}
const queries = [...byQ.values()].map((o) => ({ ...o, pos: o.posW / o.impr, ctr: o.clicks / o.impr * 100, page: [...o.pages].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null }));

// عبارات كل صفحة من الخريطة الحية (عنوان/H1) ومن كلماتها في المصدر، لمنطق ownerOf أعلاه
const { ARTICLES, SERVICES } = await loadContent();
const txt = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
const fetchText = async (u) => (await fetch(u, { signal: AbortSignal.timeout(20000) })).text();
const locs = (x) => [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
let urls = locs(await fetchText(`${BASE}${CONFIG.sitemapLive}`)); if (urls.every((u) => /sitemap/.test(u))) urls = (await Promise.all(urls.map(fetchText))).flatMap(locs);
if (!urls.length) { console.error('✗ خريطة الموقع الحية فارغة'); process.exit(1); }
const kwOf = new Map([...ARTICLES.map((a) => [`${CONFIG.content.articlePrefix}${a.slug}`, [a.keyword, ...a.keywords]]), ...SERVICES.map((s) => [`${CONFIG.content.servicePrefix}${s.slug}`, [s.keyword, ...s.keywords]])]);
const owners = [];
for (let i = 0; i < urls.length; i += 10) owners.push(...await Promise.all(urls.slice(i, i + 10).map(async (u) => {
  const path = dp(u); const html = await fetchText(u);
  const phrases = [html.match(/<title>([^<]*)<\/title>/)?.[1], html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]].filter(Boolean).map(txt).concat(kwOf.get(path) ?? []);
  return { path, t: phrases.map(toks) };
})));
const striking = [], ctrFix = [], weak = [], fresh = []; let offTopic = 0;
for (const r of queries.filter((x) => x.impr >= MIN)) {
  const owner = ownerOf(r.q, r.pos, r.page, owners); const row = { ...r, owner, shownOn: r.page };
  if (r.pos <= 5 && r.ctr < 3 && r.impr >= MIN * 3) ctrFix.push(row);
  else if (r.pos > 3 && r.pos <= 20 && owner) striking.push(row);
  else if (owner && r.pos > 20) weak.push(row);
  else if (!owner && onTopic(r.q, owners)) fresh.push(row);
  else if (!owner) offTopic++;
}
const byImpr = (a, b) => b.impr - a.impr; striking.sort(byImpr); ctrFix.sort(byImpr); weak.sort(byImpr); fresh.sort(byImpr);
const total = queries.reduce((s, q) => s + q.impr, 0), clicks = queries.reduce((s, q) => s + q.clicks, 0);
const line = (r) => `| ${r.q} | ${r.impr} | ${r.clicks} | ${r.ctr.toFixed(1)}% | ${r.pos.toFixed(1)} | ${r.owner ?? (r.shownOn ? 'لا مالك؛ ظهر على ' + r.shownOn : '—')} |`;
const head = '| الاستعلام | الظهور | النقرات | CTR | الترتيب | الصفحة |\n|---|---|---|---|---|---|';
// الصفحات الأكثر ظهوراً (للقياس قبل/بعد)
const byPage = new Map(); for (const r of rows) if (r.keys[1]) { const p = dp(r.keys[1]); const o = byPage.get(p) ?? { p, impr: 0, clicks: 0, posW: 0 }; o.impr += r.impressions; o.clicks += r.clicks; o.posW += r.position * r.impressions; byPage.set(p, o); }
const topPages = [...byPage.values()].sort(byImpr).slice(0, 25);
const md = `# فرص Search Console — ${PROPERTY} — ${period || file}

${queries.length} استعلام · ${total} ظهور · ${clicks} نقرة · حد الظهور الأدنى ${MIN}

## 🎯 قريبة من الصفحة الأولى (ترتيب 4–20) — قوِّ الصفحة المالكة
${head}
${striking.slice(0, 40).map(line).join('\n') || '| — |'}

## ✏️ ظهور عالٍ ونقر ضعيف — أعد كتابة العنوان والوصف
${head}
${ctrFix.slice(0, 20).map(line).join('\n') || '| — |'}

## 🔻 مملوكة وضعيفة (ترتيب بعد 20): للكلمة صفحة، لكنها بعيدة — قوِّ الصفحة نفسها، لا صفحة جديدة
${head}
${weak.slice(0, 20).map(line).join('\n') || '| — |'}

## 🆕 بلا صفحة مالكة: لا صفحة موضوعها الكلمة، وجوجل تُظهر صفحة غير متعلقة بعد المركز 20 (مرشّح لصفحة جديدة بشرط بوابات need)
${head}
${fresh.slice(0, 30).map(line).join('\n') || '| — |'}

## الصفحات الأعلى ظهوراً (خط الأساس للقياس)
| الصفحة | الظهور | النقرات | الترتيب |
|---|---|---|---|
${topPages.map((o) => `| ${o.p} | ${o.impr} | ${o.clicks} | ${(o.posW / o.impr).toFixed(1)} |`).join('\n')}
`;
mkdirSync('content-plan', { recursive: true }); writeFileSync('content-plan/gsc-opportunities.md', md);
console.log(`صفحات الخريطة الحية: ${owners.length} · استعلامات: ${queries.length} · ظهور: ${total} · نقرات: ${clicks}`);
if (!queries.length) { console.error('✗ صفر استعلام من GSC'); process.exit(1); }
console.log(`✓ content-plan/gsc-opportunities.md — قريبة: ${striking.length} · عنوان/وصف: ${ctrFix.length} · مملوكة وضعيفة: ${weak.length} · بلا مالك: ${fresh.length} · خارج موضوع الموقع: ${offTopic}`);
