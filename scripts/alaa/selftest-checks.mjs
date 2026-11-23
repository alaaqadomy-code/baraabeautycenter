/**
 * إثبات الفواحص: نسخة مؤقتة من dist تُزرع فيها مخالفة واحدة لكل فاحص، ويجب أن يفشل عليها (رمز 1)
 * ويفشل أيضاً على مجلد فارغ (صفر صفحة). فاحص يمرّ أخضر على مخالفة مزروعة لا يُعتمد.
 *   node scripts/selftest-checks.mjs
 */
import { cpSync, rmSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './_config.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)); const DISTDIR = process.env.DIST || CONFIG.dist;

// صفحة الزرع: من الإعداد، وإلا أول صفحة في البناء فيها <main> و<h1>
const PAGE = (() => { if (CONFIG.selftestPage && existsSync(join(DISTDIR, CONFIG.selftestPage))) return CONFIG.selftestPage;
  const walk = (d, o = []) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); e.isDirectory() ? walk(p, o) : e.name.endsWith('.html') && o.push(p); } return o; };
  // صفحة محتوى عادية: فيها <main> و<h1> وJSON-LD، ليست الرئيسية ولا 404 ولا noindex (كان يُختار 404 أولاً في رصد)
  const ok = (p) => { const h = readFileSync(p, 'utf8'); const rel = p.replace(/\\/g, '/'); return /<main[\s>]/.test(h) && /<h1[\s>]/.test(h) && !/noindex/.test(h.match(/name="robots"[^>]*>/)?.[0] ?? '') && !/(^|\/)404(\/index)?\.html$/.test(rel) && rel !== join(DISTDIR, 'index.html').replace(/\\/g, '/'); };
  const cands = existsSync(DISTDIR) ? walk(DISTDIR).filter(ok) : [];
  const f = cands.find((p) => /application\/ld\+json/.test(readFileSync(p, 'utf8'))) ?? cands[0] ?? null;
  return f ? f.replace(/\\/g, '/').slice(DISTDIR.replace(/\\/g, '/').length + 1) : 'index.html'; })();
const CASES = [
  { s: 'check-links', plant: (d) => edit(d, PAGE, '<main', '<a href="/blog/no-such-page-xyz">x</a><main') },
  { s: 'audit-pages', plant: (d) => edit(d, PAGE, '<h1', '<h1>زائد</h1><h1') },
  { s: 'check-title-desc', plant: (d) => edit(d, PAGE, '<title>', '<title>' + 'عنوان طويل جداً '.repeat(6)) },
  // سؤال ظاهر ليس في السكيما: يعمل على أي موقع، بأسئلة شائعة أو بلا (يصير «سؤال ظاهر بلا FAQPage»)
  { s: 'check-faq-schema', plant: (d) => edit(d, PAGE, /<main([^>]*)>/, '<main$1><details><summary>سؤال مزروع غير موجود في السكيما؟</summary><p>x</p></details>') },
  { s: 'check-h1-keyword', plant: (d) => edit(d, PAGE, /<h1([^>]*)>[^<]*/, '<h1$1>عنوان بلا كلمة') },
  { s: 'check-claims', plant: (d) => edit(d, PAGE, '<main', '<main><p>نضمن لك نتيجة مثالية ولا ألم بعد العملية.</p>') },
  { s: 'check-internal-links', env: { MIN_INBOUND: '999' } }, // رفع الحدّ يكشف أن العدّ يعمل
  { s: 'check-page-quality', plant: () => {} }, // أحمر أصلاً على الموقع (استشاري)؛ يُثبت بفشل المجلد الفارغ
  // Breadcrumb بموضع خاطئ يُضاف إلى <head>: يعمل على أي موقع، بسكيما أو بلا
  { s: 'check-schema-semantics', plant: (d) => edit(d, PAGE, '</head>', '<script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":7,"name":"مزروع","item":"https://example.invalid/x"}]}</script></head>') },
  { s: 'check-performance', plant: (d) => edit(d, PAGE, '</head>', '<script src="/blocking.js"></script></head>') },
  { s: 'check-layout', plant: (d) => edit(d, PAGE, '<main', '<div style="min-width:900px">x</div><main') },
  // صفحة منسوخة فوق صفحة محتوى أخرى: محتوى مكرر يجب أن يُمسك
  { s: 'check-similarity', plant: (d) => { const other = otherMain(d); if (!other) throw new Error('لم يُزرع: لا صفحة محتوى ثانية'); edit(d, PAGE, /<main[\s\S]*?<\/main>/, other); } },
  // الحارسان الحازمان (--changed): الصفحة المزروعة «معدّلة اليوم» (dateModified)، فيجب أن يمسكاها
  { s: 'check-similarity', args: ['--changed'], plant: (d) => { const other = otherMain(d); if (!other) throw new Error('لم يُزرع: لا صفحة محتوى ثانية'); edit(d, PAGE, /<main[\s\S]*?<\/main>/, other.replace(/<main([^>]*)>/, `<main$1><script type="application/ld+json">{"dateModified":"${TODAY}"}</script>`)); } },
  { s: 'check-cross-site-dup', args: ['--changed'], plant: (d) => { const s = foreignSentence(); if (!s) throw new Error('لم يُزرع: لا موقع آخر ببناء في سجل المواقع'); edit(d, PAGE, '<main', `<main><script type="application/ld+json">{"dateModified":"${TODAY}"}</script><p>${s}.</p>`); } },
  // صفحة الزرع قابلة للضبط (touchSelftest) لموقع بلا index.html في الجذر (/ يحوّل إلى /en)
  // وفي موقع يرطّبه React (Next) يُزال العنصر المزروع في HTML، فالزرع يكون قاعدة CSS تصغّر روابط موجودة (touchSelftest.css)
  { s: 'check-touch-targets', env: { }, plant: (d) => CONFIG.touchSelftest?.css ? appendCss(d, CONFIG.touchSelftest.css) : edit(d, CONFIG.touchSelftest?.file ?? 'index.html', '<main', '<main><a href="/about" style="display:inline-block;width:12px;height:12px">x</a>'), args: [`--pages=${CONFIG.touchSelftest?.path ?? '/'}`] },
];
const TODAY = new Date().toISOString().slice(0, 10);
// جملة حقيقية (10 كلمات فأكثر) من <main> موقع آخر في سجل المواقع، لزرعها في هذا الموقع
function foreignSentence() {
  const reg = 'C:/Users/JCC/Desktop/تحكم كلود/المركز/projects.json'; if (!existsSync(reg)) return null;
  const j = JSON.parse(readFileSync(reg, 'utf8')); const self = process.cwd().toLowerCase();
  for (const p of (Array.isArray(j) ? j : j.projects || Object.values(j))) {
    if (p.type !== 'موقع' || !p.path || p.path.toLowerCase() === self) continue;
    const dist = ['dist', 'out'].map((x) => join(p.path, x)).find((x) => existsSync(x)); if (!dist) continue;
    const stack = [dist]; while (stack.length) { const x = stack.pop(); for (const e of readdirSync(x, { withFileTypes: true })) { const f = join(x, e.name); if (e.isDirectory()) stack.push(f); else if (e.name.endsWith('.html')) {
      const m = readFileSync(f, 'utf8').match(/<p[^>]*>([^<]{80,400})<\/p>/); const s = m?.[1].split(/[.!?؟]/).map((t) => t.trim()).find((t) => t.split(/\s+/).length >= 10); if (s) return s; } } }
  }
  return null;
}
// <main> أطول صفحة محتوى أخرى (بنمط contentPattern، لا الرئيسية) من البناء الحقيقي
const { pages: distPages, isContent } = await import('./_dist.mjs');
function otherMain() { const own = readFileSync(join(DISTDIR, PAGE), 'utf8').match(/<main[\s\S]*?<\/main>/)?.[0];
  let best = null; for (const p of distPages()) { if (p.noindex || !isContent(p.url)) continue; const m = p.html.match(/<main[\s\S]*?<\/main>/)?.[0]; if (m && m !== own && (!best || m.length > best.length)) best = m; } return best; }
function appendCss(d, rule) { const find = (x) => { for (const e of readdirSync(x, { withFileTypes: true })) { const p = join(x, e.name); if (e.isDirectory()) { const r = find(p); if (r) return r; } else if (e.name.endsWith('.css')) return p; } return null; }; const f = find(d); if (!f) throw new Error('لم يُزرع: لا ملف CSS'); writeFileSync(f, readFileSync(f, 'utf8') + '\n' + rule + '\n'); }
function edit(d, f, from, to) { const p = join(d, f); if (!existsSync(p)) throw new Error(`لم يُزرع: لا ${f}`); const s = readFileSync(p, 'utf8'); const o = s.replace(from, to); if (o === s) throw new Error(`لم يُزرع في ${f}`); writeFileSync(p, o); }
const run = (s, DIST, env = {}, args = []) => spawnSync(process.execPath, [join(HERE, `${s}.mjs`), ...args], { env: { ...process.env, DIST, ...env }, encoding: 'utf8', timeout: 120000 });

const tmp = mkdtempSync(join(tmpdir(), 'dist-')); const empty = join(tmp, 'empty'); mkdirSync(empty);
let failed = 0; const na = [], weak = [];
for (const c of CASES) {
  const d = join(tmp, c.s); cpSync(DISTDIR, d, { recursive: true });
  // موقع بلا العنصر الذي تُزرع فيه المخالفة (لا FAQ، لا Breadcrumb…): «غير منطبق»، لا نجاح ولا تعطّل
  try { c.plant?.(d); } catch (err) { if (/لم يُزرع/.test(err.message)) { na.push(`${c.s} (${err.message})`); console.log(`○ ${c.s}: غير منطبق على هذا الموقع — ${err.message}`); continue; } throw err; }
  const r = run(c.s, d, c.env, c.args); const e = run(c.s, empty, {}, c.args);
  const caught = r.status === 1, emptyFails = e.status !== 0;
  // فاحص أحمر أصلاً على البناء الحقيقي: «إمساك» المخالفة لا يثبت شيئاً (إثبات ضعيف، يُذكر صراحة)
  const already = !c.env && run(c.s, DISTDIR, {}, c.args).status === 1; if (already) weak.push(c.s);
  if (!caught || !emptyFails) failed++;
  console.log(`${caught && emptyFails ? (already ? '◐' : '✓') : '✗'} ${c.s}${c.args?.some((a) => a === '--changed') ? ' --changed' : ''}: مخالفة مزروعة → رمز ${r.status}${caught ? '' : ' (لم يمسكها!)'} · مجلد فارغ → رمز ${e.status}${emptyFails ? '' : ' (مرّ أخضر!)'}${already ? ' · أحمر أصلاً على الموقع: إثبات ضعيف' : ''}`);
  if (!caught) console.log(r.stdout.split('\n').slice(-6).join('\n'));
}
if (na.length) console.log(`○ غير منطبق على هذا الموقع (${na.length}): ${na.map((x) => x.split(' ')[0]).join('، ')} — غير مُثبت هنا، ليس نجاحاً`);
if (weak.length) console.log(`◐ إثبات ضعيف (أحمر أصلاً) (${weak.length}): ${weak.join('، ')}`);
// فاحص الأخطاء اللغوية يعمل على src لا dist: مخالفة في ملف مؤقت
const src = join(tmp, 'src'); mkdirSync(src); writeFileSync(join(src, 'x.ts'), 'export const t = "هذه الجملة واضحه وفيها خطأ";');
const ty = spawnSync(process.execPath, [join(HERE, 'check-arabic-typos.mjs'), src], { encoding: 'utf8' });
console.log(`${ty.status === 1 ? '✓' : '✗'} check-arabic-typos: مخالفة مزروعة → رمز ${ty.status}`); if (ty.status !== 1) failed++;
const tyEmpty = spawnSync(process.execPath, [join(HERE, 'check-arabic-typos.mjs'), join(tmp, 'empty')], { encoding: 'utf8' });
console.log(`${tyEmpty.status !== 0 ? '✓' : '✗'} check-arabic-typos: مجلد فارغ → رمز ${tyEmpty.status}`); if (tyEmpty.status === 0) failed++;
// فاحص التنافس يقرأ مصدر TS لا dist: مصدر وهمي فيه مقالان بالكلمة نفسها يجب أن يفشل، وبكلمتين مختلفتين يجب أن ينجح
const cann = (kw2) => { const root = join(tmp, 'cann-' + kw2.length); mkdirSync(join(root, 'src/lib'), { recursive: true });
  const art = (slug, kw) => ({ slug, keyword: kw, title: `عنوان ${slug}`, keywords: [kw] });
  writeFileSync(join(root, 'src/lib/articles.ts'), `export const ARTICLES = ${JSON.stringify([art('a', 'شد الوجه بالخيوط'), art('b', kw2)])};`);
  writeFileSync(join(root, 'src/lib/services.ts'), 'export const SERVICES = [];'); writeFileSync(join(root, 'alaa.config.json'), JSON.stringify({ contentPattern: '^/(blog|services)/[^/]+$', content: { articles: 'src/lib/articles.ts', services: 'src/lib/services.ts', noindex: 'src/lib/noindex.mjs', lib: 'src/lib', articlePrefix: '/blog/', servicePrefix: '/services/' } })); writeFileSync(join(root, 'src/lib/noindex.mjs'), 'export const NOINDEX_SLUGS = [];');
  return spawnSync(process.execPath, [join(HERE, 'check-cannibalization.mjs')], { cwd: root, encoding: 'utf8' }).status; };
const cSame = cann('شد الوجه بالخيوط'), cDiff = cann('سعر الفيلر في عمان');
console.log(`${cSame === 1 && cDiff === 0 ? '✓' : '✗'} check-cannibalization: كلمة مكررة مزروعة → رمز ${cSame} · كلمتان مختلفتان → رمز ${cDiff}`); if (!(cSame === 1 && cDiff === 0)) failed++;
rmSync(tmp, { recursive: true, force: true });
const proven = CASES.length + 2 - na.length;
console.log(failed ? `✗ ${failed} فاحص لم يثبت نفسه` : `✓ ${proven} فاحصاً أمسكت مخالفتها المزروعة وفشلت على الفارغ${weak.length ? ` (منها ${weak.length} بإثبات ضعيف لأنها حمراء أصلاً: ${weak.join('، ')})` : ''}${na.length ? ` · ${na.length} غير منطبق على هذا الموقع` : ''}`);
process.exit(failed ? 1 : 0);
