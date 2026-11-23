/**
 * إعداد الحزمة لكل موقع: يقرأ alaa.config.json من جذر الموقع (cwd) ويدمجه فوق القيم الافتراضية.
 * القيم الافتراضية محايدة لا تخص أي موقع، وبلا ملف إعداد ترفض الحزمة العمل (رمز 2).
 * المُركِّب (install.mjs في مجلد الحزمة) يكتشف الموقع ويكتب الملف. لا أسرار هنا أبداً.
 *
 * mode: "full"  = محتوى بصيغة تعرفها الحزمة (TS بمصفوفات ARTICLES/SERVICES): فحص + تحسين + توليد.
 *       "dist"  = أي موقع آخر: فحص البناء + بيانات جوجل + قياس + فهرسة + تقرير أسبوعي؛ أدوات الكتابة ترفض
 *                 وتكتب اقتراحاتها في ملف، والتطبيق يدوي.
 */
import { existsSync, readFileSync } from 'node:fs';

const FILE = 'alaa.config.json';
// قيم محايدة لا تخص أي موقع: كل ما يخص الموقع (أقسامه، صفحاته، ملفاته، كلماته) يكتبه install.mjs في alaa.config.json
// داخل الموقع نفسه. بلا ذلك الملف ترفض الحزمة العمل، فلا يأخذ موقع قيم موقع آخر أبداً (قرار علاء 23 نوفمبر 2026).
export const DEFAULTS = {
  mode: null, // null = يُستنتج: full إن وُجد content.articles، وإلا dist
  domain: null, // null = PUBLIC_SITE_URL ثم site.ts ثم .claude/site.json (سلوك _site-url)
  dist: 'dist',
  contentPattern: null, // إلزامي: نمط مسار صفحات المحتوى، مثل ^/(blog|services)/[^/]+$
  contentExclude: null,
  content: {
    articles: null, services: null, noindex: null, lib: null, layers: [],
    articlePrefix: '/', servicePrefix: '/__none__/', clusters: null, newDir: null,
    articlesIndexImport: null, articlesSpread: null,
  },
  titleMax: 60, descMin: 120, descMax: 160,
  moneyPages: [], minMoney: 12,
  h1Exempt: '^/404$',
  // ملف claims: "medical-directory" = قواعد دليل طبي (لا عيادة، لا حجز، لا إحصاء ذاتي)؛ "generic" = قواعد حسن الست فقط
  claimsProfile: 'generic',
  selftestPage: null, // null = يُختار تلقائياً
  touchGroups: [],
  liveAssets: [],
  bannedLive: [],
  anchorBoxes: null,
  typosPaths: ['src'], // مصادر المحتوى لفاحص الأخطاء العربية (md/mdx/ts/astro)
  trailingSlash: false, // روابط الموقع بشرطة أخيرة («/x/») تُقارن بها صفحات x/index.html
  // موقع متعدد اللغات: بادئة الرابط ← [lang, dir]، مثل {"/en": ["en","ltr"], "/ar": ["ar","rtl"]}. null = عربي فقط (ar/rtl)
  locales: null,
  // نص يتكرر عن قصد (إخلاء مسؤولية، تنبيه أسعار) يُستثنى من check-similarity؛ لا نص مقال أبداً، والمدقق يراجعه
  similarityAllow: [],
  // ملفات المكوّنات والقوالب: نصها «قالب» لا يُحسب في التشابه (الشرط على متن الصفحة). null = المسارات الشائعة
  componentDirs: null,
  sitemapLive: '/sitemap-index.xml', // مسار الخريطة الحية (فهرس خرائط أو خريطة واحدة)
  sitemapLocal: null, // null = <dist>/sitemap-0.xml
  gscProperty: null, // null = sc-domain:<host>
};

const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b ?? {})) o[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? merge(a[k], v) : v; return o; };
function load() {
  let user = {};
  // بلا ملف إعداد لا عمل: القيم الافتراضية محايدة ولا تكفي لفحص أي موقع
  if (!existsSync(FILE)) { console.error(`⛔ لا ${FILE} في ${process.cwd()}: ركّب الحزمة على هذا الموقع أولاً (node <مجلد الحزمة>/install.mjs <مجلد الموقع>)`); process.exit(2); }
  { try { user = JSON.parse(readFileSync(FILE, 'utf8')); } catch (e) { throw new Error(`${FILE} غير صالح: ${e.message}`); } }
  const c = merge(DEFAULTS, user);
  if (!c.mode) c.mode = c.content?.articles && existsSync(c.content.articles) ? 'full' : 'dist';
  if (!c.contentPattern) { console.error(`⛔ ${FILE}: الحقل contentPattern فارغ؛ أعد التركيب أو اكتبه`); process.exit(2); }
  c.hasFile = true;
  return c;
}
export const CONFIG = load();
export const isFull = () => CONFIG.mode === 'full';
export const localSitemap = () => CONFIG.sitemapLocal ?? `${CONFIG.dist}/sitemap-0.xml`;
export const gscProperty = (host) => CONFIG.gscProperty ?? `sc-domain:${host}`;
/** رسالة رفض موحّدة لأدوات الكتابة في وضع الفحص فقط. */
export function requireFull(tool) {
  if (isFull()) return;
  console.error(`⛔ ${tool}: هذا الموقع بوضع «الفحص فقط» (alaa.config.json: mode = "dist")، فصيغة محتواه لا تعرفها الحزمة.\n   لا كتابة في ملفات الموقع. اكتب التعديلات المقترحة في content-plan/ وطبّقها يدوياً، ثم ابنِ وشغّل الفحوص.`);
  process.exit(2);
}
