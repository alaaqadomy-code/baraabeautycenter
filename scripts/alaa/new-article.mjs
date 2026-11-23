/**
 * الطبقة ج (التوليد) كأداة محكومة: لا تكتب نصاً بنفسها (لا مفتاح Gemini هنا؛ الكاتب هو الجلسة أو إنسان)،
 * بل تحكم ما يُكتب وتُدرجه في مكانه الصحيح:
 *   node scripts/new-article.mjs brief <query>            → موجز في content-plan/briefs/<slug>.md: السبب البحثي من GSC
 *                                                            (قسم «بلا مالك»)، فحص التنافس مع الصفحات القائمة، والحقول المطلوبة.
 *   node scripts/new-article.mjs add <draft.json> [--apply] → يتحقق من مسودة Article كاملة ثم يدرجها في
 *                                                            src/lib/articles-wave10/ ويسجّلها في articles.ts وclusters.ts.
 * بوابات الإدراج (ترفض وتشرح): STOP من measure.json (< 100 ظهور)، slug جديد، كل الحقول، ≥ 4 أقسام و≥ 4 أسئلة،
 * sources ≥ 2 بروابط https، لا جملة ترفضها قواعد الادعاءات، كلمة أساسية لا تطابق كلمة صفحة قائمة، كل رابط داخلي
 * إلى صفحة موجودة، ولا رقم في المتن بلا مصدر (كل فقرة فيها رقم تحمل اسم مصدر أو رابطه). ثم humanizer يدوياً قبل النشر.
 * بوابتا الحاجة (قرار علاء 23 نوفمبر 2026، «صفحة حسب الاحتياج لا حصة»):
 *   • الفهرسة: لا صفحة جديدة إن كانت المفهرسة < MIN_INDEX_RATIO (افتراضي 0.8) من روابط الخريطة، بشهادة
 *     content-plan/index-coverage.json عمرها ≤ 7 أيام. تُنتَج بـ `new-article.mjs coverage` (URL Inspection، قراءة فقط).
 *   • الوتيرة: لا أكثر من MAX_NEW_PER_WEEK صفحة جديدة (افتراضي 2، قرار علاء 23 نوفمبر 2026) في 7 أيام: مقال published خلال 7 أيام، أو ملف أُضيف إلى articles-wave10 في git
 *     خلالها، أو ملف فيه لم يُحفظ بعد.
 *   node scripts/new-article.mjs coverage                → يكتب content-plan/index-coverage.json
 *   node scripts/new-article.mjs need                    → حكم الحاجة هذا الأسبوع (للمهمة الأسبوعية؛ قراءة فقط)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadContent } from './_ts.mjs';
import { sentenceFault } from './check-claims.mjs';
import { CONFIG, requireFull, localSitemap, gscProperty } from './_config.mjs';
const { articlePrefix: AP, servicePrefix: SP } = CONFIG.content;
const [cmd, arg] = process.argv.slice(2); const apply = process.argv.includes('--apply');

const MIN_INDEX_RATIO = Number(process.env.MIN_INDEX_RATIO || 0.8), DAY = 864e5;
// قرار علاء 23 نوفمبر 2026: صفحتان جديدتان على الأكثر في كل 7 أيام
export const MAX_NEW_PER_WEEK = Number(process.env.MAX_NEW_PER_WEEK || 2);
// «اليوم» بالتوقيت المحلي (عمّان)، لا UTC: بين منتصف الليل والثالثة فجراً كان UTC يرفض مقالاً بتاريخ اليوم المحلي
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const COVERAGE = 'content-plan/index-coverage.json', WAVE10 = CONFIG.content.newDir;
if (cmd === 'coverage') {
  const { siteUrl } = await import('./_site-url.mjs'); const { inspectUrl } = await import('./_gsc.mjs');
  const host = new URL(siteUrl()).host;
  const urls = [...readFileSync(localSitemap(), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!urls.length) { console.error('خريطة dist فارغة: شغّل npm run build'); process.exit(1); }
  // URL Inspection بطيء (~7 ثوانٍ للرابط): 5 طلبات متوازية تحت حد 600/دقيقة. الخطأ يُحسب «غير مفهرس» فلا يرفع النسبة زوراً.
  const notIndexed = []; let i = 0, next = 0;
  const inspect = (u) => inspectUrl(gscProperty(host), u).catch(() => inspectUrl(gscProperty(host), u)); // محاولة ثانية عند المهلة
  const one = async (u) => { try { const st = (await inspect(u))?.indexStatusResult; if (st?.verdict !== 'PASS') notIndexed.push({ url: u, coverage: st?.coverageState ?? '?' }); } catch (e) { notIndexed.push({ url: u, coverage: 'خطأ: ' + e.message.slice(0, 60) }); } if (++i % 20 === 0 || i === urls.length) console.log(`  ${i}/${urls.length}`); };
  await Promise.all(Array.from({ length: 5 }, async () => { while (next < urls.length) await one(urls[next++]); }));
  const out = { at: new Date().toISOString(), total: urls.length, indexed: urls.length - notIndexed.length, ratio: +((urls.length - notIndexed.length) / urls.length).toFixed(3), notIndexed };
  mkdirSync('content-plan', { recursive: true }); writeFileSync(COVERAGE, JSON.stringify(out, null, 2));
  console.log(`الفهرسة: ${out.indexed} من ${out.total} (${(out.ratio * 100).toFixed(0)}%) → ${COVERAGE}`); process.exit(0);
}
/** الصفحات الجديدة خلال آخر 7 أيام: مقال published خلالها، أو ملف wave10 أُضيف في git أو لم يُحفظ (بلا تكرار). */
export function recentNewPages({ articles, now = Date.now(), recentFiles = recentWave10Files() }) {
  const fresh = articles.filter((a) => a.published && now - new Date(a.published) < 7 * DAY && now >= new Date(a.published)).map((a) => a.slug);
  return [...new Set([...fresh, ...recentFiles])];
}
// قاعدة الكتابة (قرار علاء 23 نوفمبر 2026): تُطبع مع كل موجز حتى لا تُنسى عند كتابة أي تحسين أو صفحة
export const WRITING_NOTE = 'تذكير الكتابة: كل نص متوافق مع SEO وAEO وGEO وإجابات الذكاء الاصطناعي معاً: جواب مباشر في أول فقرة، عناوين بصيغة سؤال الباحث، فقرات قصيرة قابلة للاقتباس، جدول أو قائمة حين تفيد، حقائق بمصادر، أسئلة شائعة حقيقية، روابط داخلية طبيعية. ثم humanizer.';
/** بوابتا الحاجة: تُرجع قائمة أسباب الرفض (فارغة = مسموح). `now` و`git` قابلان للحقن للاختبار. */
export function needGates({ articles, coverage, now = Date.now(), recentFiles = recentWave10Files() }) {
  const errs = [];
  if (!coverage) errs.push(`الفهرسة: لا ${COVERAGE}؛ شغّل new-article.mjs coverage`);
  else if (now - new Date(coverage.at) > 7 * DAY) errs.push(`الفهرسة: شهادة التغطية عمرها ${((now - new Date(coverage.at)) / DAY).toFixed(0)} يوماً (> 7)؛ أعد coverage`);
  else if (coverage.ratio < MIN_INDEX_RATIO) errs.push(`الفهرسة: ${coverage.indexed} من ${coverage.total} مفهرسة (${(coverage.ratio * 100).toFixed(0)}% < ${MIN_INDEX_RATIO * 100}%)؛ فهرس الموجود قبل أي صفحة جديدة`);
  const recent = recentNewPages({ articles, now, recentFiles });
  if (recent.length >= MAX_NEW_PER_WEEK) errs.push(`الوتيرة: ${recent.length} صفحة جديدة خلال آخر 7 أيام (${recent.join('، ')})؛ لا أكثر من ${MAX_NEW_PER_WEEK} أسبوعياً`);
  return errs;
}
function recentWave10Files() {
  const git = (a) => spawnSync('git', a, { encoding: 'utf8' }).stdout ?? '';
  const added = git(['log', '--since=7.days', '--diff-filter=A', '--name-only', '--format=', '--', WAVE10]).split(/\r?\n/);
  const pending = git(['status', '--porcelain', '--untracked-files=all', '--', WAVE10]).split(/\r?\n/).map((l) => l.slice(3));
  return [...added, ...pending].map((f) => f.trim()).filter((f) => /\.ts$/.test(f) && !/index\.ts$/.test(f)).map((f) => f.split('/').pop().replace(/\.ts$/, ''));
}
const coverageFile = () => (existsSync(COVERAGE) ? JSON.parse(readFileSync(COVERAGE, 'utf8')) : null);
if (cmd === '--selftest-gates') {
  const now = Date.parse('2026-12-01'); const cov = (ratio, at = '2026-11-30') => ({ at, total: 100, indexed: ratio * 100, ratio });
  const T = [
    ['مسموح', needGates({ articles: [{ slug: 'a', published: '2026-11-01' }], coverage: cov(0.9), now, recentFiles: [] }), 0],
    ['فهرسة منخفضة', needGates({ articles: [], coverage: cov(0.05), now, recentFiles: [] }), 1],
    ['بلا شهادة', needGates({ articles: [], coverage: null, now, recentFiles: [] }), 1],
    ['شهادة قديمة', needGates({ articles: [], coverage: cov(0.9, '2026-11-20'), now, recentFiles: [] }), 1],
    ['مقال واحد قبل 3 أيام: الثاني مسموح', needGates({ articles: [{ slug: 'b', published: '2026-11-28' }], coverage: cov(0.9), now, recentFiles: [] }), 0],
    ['مقالان خلال الأسبوع: الثالث ممنوع', needGates({ articles: [{ slug: 'b', published: '2026-11-28' }, { slug: 'e', published: '2026-11-26' }], coverage: cov(0.9), now, recentFiles: [] }), 1],
    ['مقال منشور + ملف wave10 غير محفوظ: ممنوع', needGates({ articles: [{ slug: 'b', published: '2026-11-28' }], coverage: cov(0.9), now, recentFiles: ['c'] }), 1],
    ['المقال نفسه منشوراً وفي git لا يُعدّ مرتين', needGates({ articles: [{ slug: 'c', published: '2026-11-28' }], coverage: cov(0.9), now, recentFiles: ['c'] }), 0],
    ['البوابتان معاً', needGates({ articles: [{ slug: 'b', published: '2026-11-28' }, { slug: 'e', published: '2026-11-27' }], coverage: cov(0.5), now, recentFiles: [] }), 2],
  ];
  let bad = 0; for (const [n, e, want] of T) { const ok = e.length === want; bad += !ok; console.log(`${ok ? '✓' : '✗'} ${n}: ${e.length} رفض${e.length ? ' · ' + e.join(' | ') : ''}`); }
  console.log(bad ? `✗ ${bad} حالة فشلت` : `✓ ${T.length} حالات صحيحة`); process.exit(bad ? 1 : 0);
}

const { ARTICLES, SERVICES, NOINDEX_SLUGS } = await loadContent();
const norm = (s) => String(s).replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim().toLowerCase();
const KW = new Map([...ARTICLES.map((a) => [norm(a.keyword), `${AP}${a.slug}`]), ...SERVICES.map((s) => [norm(s.keyword), `${SP}${s.slug}`])]);
const STOP_WORDS = new Set(['في', 'من', 'على', 'الى', 'إلى', 'مع', 'عن', 'و', 'كم', 'هل', 'ما', 'الاردن', 'الأردن', 'عمان']);
const toks = (s) => new Set(norm(s).split(' ').filter((w) => w.length > 1 && !STOP_WORDS.has(w)));
const sim = (a, b) => { const A = toks(a), B = toks(b); const i = [...A].filter((x) => B.has(x)).length; return i / (new Set([...A, ...B]).size || 1); };
const measure = existsSync('content-plan/measure.json') ? JSON.parse(readFileSync('content-plan/measure.json', 'utf8')) : null;

if (cmd === '--selftest-add') {
  // مسودة سليمة تُقبل، ومسودة المدقق المخالفة (23 نوفمبر 2026) تُرفض بكل أسبابها
  const today = '2026-12-20'; const ctx = { articles: [{ slug: 'face-thread-lift', keyword: 'شد الوجه بالخيوط' }], services: [], clustersSrc: 'slug: "face",', fresh: ['سعر خيوط الشد في عمان'], today, exists: () => false };
  const sec = (h, p) => ({ h2: h, paragraphs: [p] }); const faq = (q) => ({ q, a: 'الجواب يختلف حسب الحالة، ويحدده الطبيب بعد الكشف.' });
  const good = { slug: 'thread-lift-price-amman', title: 'سعر خيوط الشد في عمان', short: 'سعر خيوط الشد', metaTitle: 'سعر خيوط الشد في عمان: ما الذي يحدد التكلفة؟', metaDescription: 'سعر خيوط الشد في عمان يختلف بنوع الخيط وعدده والمنطقة. نشرح ما يحدد التكلفة، وما يُسأل عنه الطبيب قبل الجلسة، ومتى لا تناسبك الخيوط.', keyword: 'سعر خيوط الشد في عمان', keywords: ['سعر خيوط الشد'], excerpt: 'ما الذي يحدد سعر خيوط الشد في عمان.', answer: 'السعر يحدده نوع الخيط وعدده، ويُعرف بعد الكشف.', published: today, updated: today, readMins: 5, services: [], cluster: 'face',
    sections: [sec('ما الذي يحدد السعر؟', 'نوع الخيط وعدده.'), sec('هل الخيوط تناسبني؟', 'يقرر الطبيب بعد الكشف.'), sec('ما المخاطر؟', 'تذكر NHS أن الكدمات شائعة في أول 14 يوماً.'), sec('كيف أختار الطبيب؟', 'تحقق من الترخيص.')],
    faqs: [faq('هل الخيوط دائمة؟'), faq('هل تؤلم؟'), faq('متى تظهر النتيجة؟'), faq('هل يناسب كل الأعمار؟')],
    sources: [{ name: 'NHS', url: 'https://www.nhs.uk/conditions/cosmetic-procedures/' }, { name: 'FDA', url: 'https://www.fda.gov/medical-devices' }] };
  const bad = { ...good, keyword: 'كلمة مخترعة لا يبحث عنها أحد', published: '2020-01-01', updated: '2020-01-01',
    sections: [sec('لماذا نحن؟', 'نضمن لك نتيجة مثالية ولا ألم.'), sec('احجز', 'احجز استشارتك الآن ولن تندم.'), sec('الأفضل', 'نحن الأفضل في الأردن ولا منافس لنا.'), sec('النجاح', 'العملية مضمونة 100% و95% نجاح بحسب الطبي.')],
    sources: [{ name: 'مصدر', url: 'https://example.com/a' }, { name: 'مصدر 2', url: 'https://example.org/b' }] };
  // مسودة التحايل الثانية للمدقق: دليل KP هو المسودة نفسها، مصدر اسمه «ال»، نطاق يبدو حقيقياً ولا يرد، وادعاءات بنفي سابق/لاحق
  const sneaky = { ...good, keyword: 'كلمة مخترعة ثانية', research: { source: 'keyword-planner', evidence: 'draft2.json' },
    sections: [sec('أ', 'العملية مضمونة 100% ولا ألم فيها.'), sec('ب', 'لا تتردد، احجز الآن.'), sec('ج', 'الأفضل في الأردن دون منازع.'), sec('د', 'نسبة النجاح 95% في الحالات.')],
    sources: [{ name: 'ال', url: 'https://a-real-looking-site.com/x' }, { name: 'NHS', url: 'https://www.nhs.uk/' }] };
  const sctx = { ...ctx, exists: () => true, read: () => 'كلمة مخترعة ثانية', urlOk: (u) => !u.includes('a-real-looking'), draftPath: 'draft2.json' };
  const s2 = draftFaults(sneaky, sctx);
  const wantS = [/ليست في قسم/, /اسم مصدر غامض/, /لا يرد/, /ضمان/, /لغة عيادة/, /تفضيل/, /رقم بلا مصدر/];
  const missS = wantS.filter((re) => !s2.some((e) => re.test(e)));
  console.log(`${missS.length ? '✗' : '✓'} مسودة التحايل: ${s2.length} سبب رفض${missS.length ? ' · لم يُلتقط: ' + missS.join(' ') : ''}`); s2.forEach((e) => console.log('    · ' + e));
  if (missS.length) process.exit(1);
  // التحايل الثالث: ملف KP في المجلد الصحيح لكن بلا رأس تصدير، ومصدر اسمه «النجاح» مع «نسبة النجاح 95%»، وادعاءات بنفي غير ملاصق
  const kpPath = 'content-plan/keyword-planner/fake.csv';
  const third = { ...good, keyword: 'كلمة مخترعة ثالثة', research: { source: 'keyword-planner', evidence: kpPath },
    sections: [sec('أ', 'لا تقلق نضمن لك النتيجة.'), sec('ب', 'احجز الآن مع فريقنا الطبي، ماذا تنتظر؟'), sec('ج', 'انتبه: نحن الأفضل في الأردن.'), sec('د', 'نسبة النجاح 95% في الحالات.')],
    sources: [{ name: 'النجاح', url: 'https://www.nhs.uk/' }, { name: 'FDA', url: 'https://www.fda.gov/' }] };
  const t3 = draftFaults(third, { ...ctx, exists: () => true, read: () => 'كلمة مخترعة ثالثة' });
  const want3 = [/ليست في قسم/, /ضمان/, /لغة عيادة/, /تفضيل/, /رقم بلا مصدر/];
  const miss3 = want3.filter((re) => !t3.some((e) => re.test(e)));
  console.log(`${miss3.length ? '✗' : '✓'} مسودة التحايل الثالثة: ${t3.length} سبب رفض${miss3.length ? ' · لم يُلتقط: ' + miss3.join(' ') : ''}`); t3.forEach((e) => console.log('    · ' + e));
  // والعكس: تصدير KP بالصيغة الصحيحة يُقبل دليلاً
  const realKp = 'Keyword,Currency,Avg. monthly searches\nكلمة مخترعة ثالثة,JOD,"1,300"\n';
  const t4 = draftFaults({ ...good, keyword: 'كلمة مخترعة ثالثة', research: { source: 'keyword-planner', evidence: kpPath } }, { ...ctx, exists: () => true, read: () => realKp });
  const kpAccepted = !t4.some((e) => /ليست في قسم/.test(e));
  console.log(`${kpAccepted ? '✓' : '✗'} تصدير Keyword Planner بصيغته الحقيقية يُقبل دليلاً`);
  // Ubersuggest: نتيجة الأداة كما رجعت تُقبل؛ وكلمة أخرى، أو ملف قديم، أو رقم مكتوب باليد بلا أشهر، تُرفض
  const usPath = 'content-plan/keyword-planner/ubersuggest-2026-12-15.json';
  const usRes = (o = {}) => JSON.stringify({ _tool: 'ubersuggest keyword_overview', _at: '2026-12-15', results: [{ keyword: 'كلمة مخترعة ثالثة', search_volume: 210, location: 'Jordan', language: 'Arabic', monthly_searches: [{ period: '202610', search_volume: 210 }, { period: '202611', search_volume: 170 }, { period: '202612', search_volume: 260 }], ...o }] });
  const us = (txt, path = usPath) => !draftFaults({ ...good, keyword: 'كلمة مخترعة ثالثة', research: { source: 'ubersuggest', evidence: path } }, { ...ctx, exists: () => true, read: () => txt }).some((e) => /ليست في قسم/.test(e));
  const usCases = [['نتيجة الأداة كما رجعت', us(usRes()), true], ['كلمة أخرى', us(usRes({ keyword: 'شيء آخر' })), false], ['رقم باليد بلا أشهر', us(usRes({ monthly_searches: undefined })), false],
    ['حجم صفر', us(usRes({ search_volume: 0 })), false], ['ملف أقدم من 90 يوماً', us(usRes().replace('"_at":"2026-12-15"', '"_at":"2026-08-01"')), false], ['خارج مجلد الأدلة', us(usRes(), 'content-plan/x.json'), false]];
  const usBad = usCases.filter(([, g, w]) => g !== w); usCases.forEach(([n, g, w]) => console.log(`${g === w ? '✓' : '✗'} Ubersuggest: ${n} → ${g ? 'يُقبل' : 'يُرفض'}`));
  if (miss3.length || !kpAccepted || usBad.length) process.exit(1);
  const g = draftFaults(good, ctx), b = draftFaults(bad, ctx);
  const want = [/ليس اليوم/, /example\.com/, /example\.org/, /ليست في قسم/, /ضمان/, /لغة عيادة/, /تفضيل/, /رقم بلا مصدر/];
  const miss = want.filter((re) => !b.some((e) => re.test(e)));
  console.log(`${g.length ? '✗' : '✓'} مسودة سليمة: ${g.length} رفض${g.length ? ' · ' + g.join(' | ') : ''}`);
  console.log(`${miss.length ? '✗' : '✓'} مسودة مخالفة: ${b.length} سبب رفض${miss.length ? ' · لم يُلتقط: ' + miss.join(' ') : ''}`); b.forEach((e) => console.log('    · ' + e));
  process.exit(g.length || miss.length ? 1 : 0);
}

if (cmd === 'brief') {
  if (!arg) { console.error('الاستخدام: new-article.mjs brief <استعلام>'); process.exit(1); }
  const slug = (process.argv.find((a) => a.startsWith('--slug=')) || '=').split('=')[1] || 'new-article';
  const raw = existsSync('content-plan/gsc-raw.json') ? JSON.parse(readFileSync('content-plan/gsc-raw.json', 'utf8')) : null;
  const gsc = raw ? raw.rows.filter((r) => sim(r.keys[0], arg) >= 0.5).reduce((o, r) => ({ impr: o.impr + r.impressions, clicks: o.clicks + r.clicks, pages: o.pages.add(new URL(r.keys[1]).pathname) }), { impr: 0, clicks: 0, pages: new Set() }) : null;
  const near = [...ARTICLES.map((a) => ({ url: `${AP}${a.slug}`, kw: a.keyword, t: a.title })), ...SERVICES.map((s) => ({ url: `${SP}${s.slug}`, kw: s.keyword, t: s.h1 }))].map((p) => ({ ...p, s: Math.max(sim(p.kw, arg), sim(p.t, arg)) })).filter((p) => p.s >= 0.34).sort((a, b) => b.s - a.s).slice(0, 5);
  const md = `# موجز مقال جديد — «${arg}» — ${localDay()}

## السبب البحثي
${gsc ? `GSC (${raw.startDate} → ${raw.endDate}): ${gsc.impr} ظهور، ${gsc.clicks} نقرة لاستعلامات قريبة، على الصفحات: ${[...gsc.pages].join('، ') || 'لا صفحة'}` : 'لا بيانات GSC (شغّل npm run gsc)'}
${measure ? `قاعدة STOP: الموقع عند ${measure.impressions} ظهور في 28 يوماً ⇒ ${measure.stop ? '⛔ لا محتوى جديد' : '✓ مسموح'}` : 'شغّل node scripts/measure.mjs أولاً'}
بوابتا الحاجة: ${needGates({ articles: ARTICLES, coverage: coverageFile() }).join(' · ') || '✓ الفهرسة ≥ ' + MIN_INDEX_RATIO * 100 + '% ولا صفحة جديدة خلال 7 أيام'}

## التنافس مع الصفحات القائمة (يجب أن تكون النية مختلفة فعلاً، وإلا وسّع الأقرب بدل مقال جديد)
${near.map((p) => `- ${p.url} «${p.kw}» (تشابه ${(p.s * 100) | 0}%)`).join('\n') || '- لا صفحة قريبة'}

## المطلوب في المسودة (JSON بصيغة Article في src/lib/articles.ts)
slug: ${slug} · keyword بصيغة الباحث · keywords 5–12 صيغة حقيقية · metaTitle ≤ 60 · metaDescription 120–160 · answer جواب مباشر 40–80 كلمة ·
sections ≥ 4 (h2 بصيغة سؤال الباحث، فقرات قصيرة، list/table عند الفائدة) · faqs ≥ 4 · sources ≥ 2 روابط رسمية (NHS/ASPS/FDA/وزارة الصحة/الإفتاء) ·
services: من ${SERVICES.map((s) => s.slug).join(' ')} · cluster: من clusters.ts · لا رقم بلا مصدر في الفقرة نفسها · لا لغة عيادة ولا ضمان · ثم humanizer قبل النشر.

## ${WRITING_NOTE}
`;
  mkdirSync('content-plan/briefs', { recursive: true }); writeFileSync(`content-plan/briefs/${slug}.md`, md); console.log(md); process.exit(0);
}

/** كلمات قسم «🆕 بلا صفحة مالكة» من تقرير GSC، إن كان عمره ≤ 7 أيام. */
function freshQueries() {
  const f = 'content-plan/gsc-opportunities.md'; if (!existsSync(f)) return { list: [], why: 'لا content-plan/gsc-opportunities.md؛ شغّل npm run gsc' };
  const { mtimeMs } = statSync(f); if (Date.now() - mtimeMs > 7 * DAY) return { list: [], why: 'تقرير GSC أقدم من 7 أيام؛ أعد npm run gsc' };
  const sec = (readFileSync(f, 'utf8').split(/^## 🆕.*$/m)[1] ?? '').split(/^## /m)[0];
  return { list: sec.split('\n').map((l) => l.split('|').map((c) => c.trim())).filter((c) => c.length >= 7 && /^\d+$/.test(c[2])).map((c) => c[1]) };
}
/** فحوص محتوى المسودة (بلا حالة الموقع): تُرجع أسباب الرفض. ctx قابل للحقن للاختبار. */
export function draftFaults(d, { articles, services, clustersSrc, fresh, today, exists = existsSync, read = (p) => readFileSync(p, 'utf8'), urlOk = () => true, draftPath = '' }) {
  const FAKE_HOST = /(^|\.)(example\.(com|org|net)|localhost|test|invalid|local)$/i;
  // أسماء مصادر لا تعني مصدراً بعينه: «ال» كانت تطابق كل فقرة عربية فيمرّ أي رقم (تدقيق 23 نوفمبر 2026)
  const VAGUE_NAME = /^(ال|مصدر\s*\d*|المصدر|دراسة|الدراسة|الطبي|طبي|بحسب|موقع|الموقع|مرجع|المرجع|تقرير)$/;
  const errs = [];
  const kwMap = new Map([...articles.map((a) => [norm(a.keyword), `${AP}${a.slug}`]), ...services.map((s) => [norm(s.keyword), `${SP}${s.slug}`])]);
  for (const k of ['slug', 'title', 'short', 'metaTitle', 'metaDescription', 'keyword', 'keywords', 'excerpt', 'answer', 'published', 'updated', 'readMins', 'services', 'sections', 'faqs', 'sources', 'cluster']) if (d[k] === undefined || d[k] === '') errs.push(`حقل ناقص: ${k}`);
  if (!/^[a-z0-9-]+$/.test(d.slug ?? '')) errs.push('slug ليس لاتينياً بشرطات');
  if (articles.some((a) => a.slug === d.slug)) errs.push('slug موجود أصلاً');
  if ([...(d.metaTitle ?? '')].length > 60) errs.push('metaTitle > 60'); const dl = [...(d.metaDescription ?? '')].length; if (dl < 120 || dl > 160) errs.push(`metaDescription ${dl} خارج 120–160`);
  if ((d.sections?.length ?? 0) < 4) errs.push('أقل من 4 أقسام'); if ((d.faqs?.length ?? 0) < 4) errs.push('أقل من 4 أسئلة');
  // تاريخ النشر اليوم: مقال جديد لا يُؤرَّخ في الماضي (كان يتجاوز بوابة الوتيرة)
  if (d.published && d.published !== today) errs.push(`published ${d.published} ليس اليوم ${today}`);
  if (d.updated && d.published && d.updated < d.published) errs.push('updated أقدم من published');
  // مصادر حقيقية: https، نطاقات حقيقية مختلفة، باسم
  const hosts = (d.sources ?? []).map((s) => { try { return /^https:\/\//.test(s.url) && s.name ? new URL(s.url).hostname : null; } catch { return null; } });
  if (hosts.length < 2 || hosts.some((h) => !h)) errs.push('sources: مصدران على الأقل برابط https صالح واسم');
  for (const h of hosts.filter(Boolean)) if (FAKE_HOST.test(h)) errs.push(`مصدر بنطاق غير حقيقي: ${h}`);
  // الرابط يجب أن يرد فعلاً (urlOk يُحسب في add بطلب حقيقي؛ نطاق «يبدو حقيقياً» لا يكفي)
  for (const s of d.sources ?? []) if (/^https:\/\//.test(s.url ?? '') && !urlOk(s.url)) errs.push(`مصدر لا يرد: ${s.url}`);
  for (const s of d.sources ?? []) if (s.name && ([...s.name.trim()].length < 3 || VAGUE_NAME.test(s.name.trim()))) errs.push(`اسم مصدر غامض «${s.name}»: اكتب اسم الجهة (مثل NHS أو وزارة الصحة الأردنية)`);
  if (new Set(hosts.filter(Boolean)).size < Math.min(2, hosts.length)) errs.push('المصدران من النطاق نفسه');
  // الكلمة حقيقية: من قسم «بلا مالك» في GSC الحديث، أو دليل Keyword Planner موجود يحمل الكلمة نصاً
  const fromGsc = (fresh ?? []).some((q) => sim(q, d.keyword ?? '') >= 0.5);
  // دليل Keyword Planner: ملف تصدير في content-plan/keyword-planner/ (csv/tsv/md)، ليس المسودة نفسها، ويحمل الكلمة نصاً.
  // كان أي ملف يحوي الكلمة يكفي، ومنه المسودة نفسها (تدقيق 23 نوفمبر 2026).
  const ev = String(d.research?.evidence ?? '').replace(/\\/g, '/');
  const evOk = /(^|\/)content-plan\/keyword-planner\/[^/]+\.(csv|tsv|md)$/i.test(ev) && ev !== String(draftPath).replace(/\\/g, '/');
  // صيغة تصدير Keyword Planner: رأس فيه عمود الكلمة وعمود متوسط البحث الشهري، وصف الكلمة فيه رقم حجم بحث.
  // shortcut: لا يُثبت أن الملف صدر فعلاً من Google Ads (ملف مزوّر بالرأس نفسه يمرّ)؛ يمنع الخطأ لا الغش، والغش يُكشف بمراجعة الدليل.
  const kpOk = (txt) => {
    const L = txt.split(/\r?\n/); const k = norm(d.keyword ?? '');
    const hi = L.findIndex((l) => /(keyword|الكلمة الرئيسية|كلمة رئيسية)/i.test(l) && /(avg\.? monthly searches|متوسط عمليات البحث الشهرية)/i.test(l));
    return hi >= 0 && L.slice(hi + 1).some((l) => norm(l).includes(k) && /(^|[\t,;])\s*"?\d[\d,]*"?\s*([\t,;]|$)/.test(l));
  };
  const fromKp = d.research?.source === 'keyword-planner' && evOk && exists(ev) && kpOk(read(ev));
  // دليل Ubersuggest (نيل باتل، قرار علاء 23 نوفمبر 2026): نتيجة أداة keyword_overview محفوظة كما رجعت، في
  // content-plan/keyword-planner/ubersuggest-*.json بغلاف {"_tool":"ubersuggest keyword_overview","_at":"<اليوم>","results":[...]}:
  // عنصر بالكلمة نفسها، حجم بحث > 0، ومعه الدولة واللغة والأشهر (monthly_searches)، وعمر الملف ≤ 90 يوماً.
  // shortcut: مثل KP، لا يُثبت أن الملف من الأداة فعلاً؛ يمنع الخطأ والرقم المكتوب باليد بلا أشهر، والغش يكشفه المدقق.
  const usOk = (txt) => { let j; try { j = JSON.parse(txt); } catch { return false; }
    const age = (Date.parse(today) - Date.parse(j?._at)) / 864e5; const k = norm(d.keyword ?? '');
    return /ubersuggest/i.test(j?._tool ?? '') && age >= 0 && age <= 90 && (j.results ?? []).some((r) => norm(r?.keyword ?? '') === k && r.search_volume > 0 && r.location && r.language && Array.isArray(r.monthly_searches) && r.monthly_searches.length >= 3); };
  const usEv = /(^|\/)content-plan\/keyword-planner\/ubersuggest-[^/]+\.json$/i.test(ev) && ev !== String(draftPath).replace(/\\/g, '/');
  const fromUs = d.research?.source === 'ubersuggest' && usEv && exists(ev) && usOk(read(ev));
  if (!fromGsc && !fromKp && !fromUs) errs.push(`الكلمة «${d.keyword}» ليست في قسم «بلا مالك» من تقرير GSC الحديث، ولا دليل Keyword Planner صالح ("research": {"source":"keyword-planner","evidence":"content-plan/keyword-planner/<تصدير>.csv"} يحمل الكلمة نصاً، أو "source":"ubersuggest" بملف content-plan/keyword-planner/ubersuggest-<اليوم>.json من أداة keyword_overview)`);
  const own = kwMap.get(norm(d.keyword ?? '')); if (own) errs.push(`الكلمة الأساسية مملوكة لـ ${own}`);
  for (const [k, u] of kwMap) if (sim(k, d.keyword ?? '') >= 0.75 && u !== own) errs.push(`الكلمة قريبة جداً من ${u} «${k}»`);
  const texts = [d.title, d.metaTitle, d.metaDescription, d.answer, d.excerpt, ...(d.sections ?? []).flatMap((s) => [s.h2, ...(s.paragraphs ?? []), ...(s.list ?? [])]), ...(d.faqs ?? []).flatMap((f) => [f.q, f.a])].filter(Boolean);
  const names = (d.sources ?? []).map((s) => s.name?.trim()).filter((n) => n && [...n].length >= 3 && !VAGUE_NAME.test(n));
  for (const t of texts) {
    const plain = t.replace(/<[^>]+>/g, ' ');
    for (const s of plain.split(/(?<=[.!؟?])\s+/)) { const f = sentenceFault(s); if (f) errs.push(`ادعاء [${f}]: «${s.slice(0, 70)}»`); }
    // رقم يحتاج مصدراً فعلياً في الفقرة نفسها: رابط https أو اسم أحد مصادر المقال (لا كلمة عامة مثل «الطبي» أو «دراسة»)
    // اسم المصدر يُحسب فقط بصيغة نسبة قبله («بحسب NHS»، «تذكر وزارة الصحة»): مصدر اسمه «النجاح» مع «نسبة النجاح 95%» كان يمرّ
    const cited = (n) => new RegExp(`(بحسب|حسب|وفق|وفقاً ل|تذكر|يذكر|ذكرت|ذكر|أفادت|أفاد|تقول|يقول|نشرت|نشر|توصي|يوصي|تشير|يشير|أشارت|أشار|بيانات|موقع)\\s+(\\S+\\s+){0,2}${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(plain);
    if (/\d{2,}|\d+\s*%/.test(plain) && !/href="https:\/\//.test(t) && !names.some(cited)) errs.push(`رقم بلا مصدر في الفقرة: «${plain.slice(0, 70)}»`);
    for (const m of t.matchAll(/href="(\/[^"#]+)"/g)) { const u = m[1]; if (!articles.some((a) => `${AP}${a.slug}` === u) && !services.some((s) => `${SP}${s.slug}` === u) && !/^\/(best-|blog$|services$|about|contact)/.test(u)) errs.push(`رابط داخلي إلى صفحة غير موجودة: ${u}`); }
  }
  if (d.cluster && !new RegExp(`slug: "${d.cluster}"`).test(clustersSrc)) errs.push(`عنقود غير موجود: ${d.cluster}`);
  return errs;
}

if (cmd === 'add') {
  requireFull('new-article add');
  const d = JSON.parse(readFileSync(arg, 'utf8')); const errs = [];
  if (measure?.stop) errs.push(`STOP: الموقع عند ${measure.impressions} ظهور في 28 يوماً (< 100)؛ لا محتوى جديد`);
  if (!measure) errs.push('لا content-plan/measure.json: شغّل measure.mjs لإثبات تجاوز STOP');
  else if (Date.now() - Date.parse(measure.date) > 7 * DAY) errs.push(`measure.json بتاريخ ${measure.date} أقدم من 7 أيام؛ أعد npm run measure`);
  errs.push(...needGates({ articles: ARTICLES, coverage: coverageFile() }));
  const fq = freshQueries(); if (fq.why) errs.push(fq.why);
  const clustersSrc = readFileSync(CONFIG.content.clusters, 'utf8');
  // كل مصدر يُطلب فعلاً (HEAD ثم GET) بمهلة 15 ثانية؛ رد أقل من 400 = يرد
  const status = new Map(await Promise.all((d.sources ?? []).filter((s) => /^https:\/\//.test(s.url ?? '')).map(async (s) => {
    for (const method of ['HEAD', 'GET']) { try { const r = await fetch(s.url, { method, redirect: 'follow', signal: AbortSignal.timeout(15000) }); if (r.status < 400) return [s.url, true]; } catch {} }
    return [s.url, false];
  })));
  errs.push(...draftFaults(d, { articles: ARTICLES, services: SERVICES, clustersSrc, fresh: fq.list, today: localDay(), urlOk: (u) => status.get(u) === true, draftPath: arg }));
  console.log(`فحوص المسودة ${d.slug ?? '?'}: ${errs.length ? '✗ ' + errs.length + ' مشكلة' : '✓ سليمة'}`); errs.forEach((e) => console.log('  ✗ ' + e));
  if (errs.length) process.exit(1);
  if (!apply) { console.log('○ تجربة بلا كتابة؛ أضف --apply للإدراج في src/lib/articles-wave10/'); process.exit(0); }
  const { cluster, ...article } = d; const dir = WAVE10; mkdirSync(dir, { recursive: true });
  const file = `${dir}/${article.slug}.ts`; writeFileSync(file, `import type { Article } from "../articles";\n\nexport const ARTICLE: Article = ${JSON.stringify(article, null, 2)};\n`);
  const idx = `${dir}/index.ts`; const prev = existsSync(idx) ? readFileSync(idx, 'utf8') : '/** الموجة 10: مقالات أُدرجت بأداة new-article.mjs (كل واحد بموجز GSC وبوابات الإدراج). */\nexport const WAVE10_ARTICLES = [];\n';
  writeFileSync(idx, prev.replace(/^(export const WAVE10_ARTICLES = \[)/m, `import { ARTICLE as A_${article.slug.replace(/-/g, '_')} } from "./${article.slug}";\n$1A_${article.slug.replace(/-/g, '_')}, `));
  let arts = readFileSync(CONFIG.content.articles, 'utf8');
  // سطر الاستيراد ونهاية المصفوفة في articles.ts من إعداد الموقع (content.articlesIndexImport / articlesSpread)
  if (!arts.includes('WAVE10_ARTICLES')) {
    const imp = CONFIG.content.articlesIndexImport, spr = CONFIG.content.articlesSpread;
    if (!imp || !spr || !arts.includes(imp) || !arts.includes(spr)) { console.error('⛔ لا أعرف أين أُدرج المقال في articles.ts: اضبط content.articlesIndexImport وarticlesSpread في alaa.config.json'); process.exit(1); }
    arts = arts.replace(imp, () => `${imp}\nimport { WAVE10_ARTICLES } from "./${WAVE10.split('/').pop()}/index";`).replace(spr, () => spr.replace(/\]$/, ', ...WAVE10_ARTICLES]'));
  }
  writeFileSync(CONFIG.content.articles, arts);
  writeFileSync(CONFIG.content.clusters, clustersSrc.replace(new RegExp(`(slug: "${cluster}",[\\s\\S]*?articles: \\[)`), `$1"${article.slug}", `));
  console.log(`✓ أُدرج ${article.slug} في ${file} وسُجّل في articles.ts وعنقود ${cluster}. التالي: npm run build && npm run check:all، ثم humanizer، ثم أعد توليد public/llms.txt.`);
}
if (cmd === 'need') {
  // حكم الأسبوع: هل يُسمح بصفحة، وما المرشحات الحقيقية (استعلامات بلا صفحة مالكة في gsc-opportunities)؟ قراءة فقط.
  const gates = [...(measure ? (measure.stop ? [`STOP: ${measure.impressions} ظهور (< 100)`] : []) : ['لا measure.json']), ...needGates({ articles: ARTICLES, coverage: coverageFile() })];
  const opp = existsSync('content-plan/gsc-opportunities.md') ? readFileSync('content-plan/gsc-opportunities.md', 'utf8') : '';
  const cands = (opp.split(/^## 🆕.*$/m)[1] ?? '').split(/^## /m)[0].split('\n').filter((l) => /^\s*[-|]/.test(l) && !/---|الاستعلام/.test(l) && /\d/.test(l)).slice(0, 5);
  const left = MAX_NEW_PER_WEEK - recentNewPages({ articles: ARTICLES }).length;
  console.log(gates.length ? `⛔ لا صفحة جديدة هذا الأسبوع:\n  • ${gates.join('\n  • ')}` : `✓ مسموح ب${left === 1 ? 'صفحة واحدة' : left === 2 ? 'صفحتين' : `${left} صفحات`} هذا الأسبوع إن وُجدت حاجة حقيقية (الحد ${MAX_NEW_PER_WEEK} في كل 7 أيام).\nمرشحات بلا صفحة مالكة (من npm run gsc):\n${cands.join('\n') || '  لا مرشحات: لا حاجة هذا الأسبوع'}\nالتالي: new-article.mjs brief "<الاستعلام>" ثم الكتابة والمراجعة في جلسة.\n${WRITING_NOTE}`);
  process.exit(0);
}
if (!['brief', 'add', 'need'].includes(cmd)) { console.error('الاستخدام: new-article.mjs brief <استعلام> [--slug=x] | add <draft.json> [--apply] | need | coverage'); process.exit(1); }
