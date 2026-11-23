/**
 * قراءة محتوى الموقع من ملفات TS مباشرة في node (بلا esbuild): node 22+ يزيل الأنواع، لكنه لا يحلّ
 * الاستيراد بلا امتداد («./articles-cluster»)، فهذا الخطاف يجرّب .ts و/index.ts و.mjs.
 */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CONFIG, isFull } from './_config.mjs';
registerHooks({
  resolve(spec, ctx, next) {
    if (/^\.\.?\//.test(spec) && !/\.[a-z]+$/.test(spec) && ctx.parentURL) {
      const base = fileURLToPath(new URL(spec, ctx.parentURL));
      for (const c of [base + '.ts', base + '/index.ts', base + '.mjs']) if (existsSync(c)) return next(pathToFileURL(c).href, ctx);
    }
    return next(spec, ctx);
  },
});
const root = pathToFileURL(process.cwd() + '/').href;
/** { ARTICLES, SERVICES } كما يراها البناء (بعد التوسيعات). */
// وضع الفحص فقط (dist): لا محتوى TS، فتعمل الفواحص على البناء وحده (مصفوفات فارغة)
export async function loadContent() {
  if (!isFull()) return { ARTICLES: [], SERVICES: [], NOINDEX_SLUGS: [] };
  const c = CONFIG.content, opt = (p, k, d) => (p && existsSync(p) ? import(root + p).then((m) => m[k] ?? d) : Promise.resolve(d));
  const [ARTICLES, SERVICES, NOINDEX_SLUGS] = await Promise.all([opt(c.articles, 'ARTICLES', []), opt(c.services, 'SERVICES', []), opt(c.noindex, 'NOINDEX_SLUGS', [])]);
  return { ARTICLES, SERVICES, NOINDEX_SLUGS };
}
