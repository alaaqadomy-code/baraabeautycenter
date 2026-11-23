/**
 * الأداء من dist بلا متصفح (قواعد حسن التقنية مكيّفة لموقع يدوي):
 *   • لا <script> حاجب في <head> (بلا defer/async/type=module) ولا <link rel=stylesheet> خارجي من دومين آخر.
 *   • عنصر LCP نص: أول <h1> يسبق أول <img> غير كسول داخل <main>.
 *   • كل <img> داخل المتن lazy إلا الأولى، وكل صورة ≤ MAX_IMG كيلوبايت وبصيغة حديثة (webp/avif/svg) أو داخل
 *     <picture> بمصادر avif/webp (Astro يضع jpg احتياطياً فقط).
 *   • الخطوط الذاتية: woff2 فقط، كل @font-face له font-display، preload ≤ 3 وكلها معرّفة في @font-face (web.dev).
 *   • حجم CSS الإجمالي ≤ MAX_CSS كيلوبايت وHTML الصفحة ≤ MAX_HTML.
 * الخطوط بقواعد web.dev (woff2، font-display، preload للحرجة فقط) لا بعدد؛ حجمها يُطبع للمعلومة. حدود الصور وCSS وHTML قابلة للضبط بالبيئة.
 */
import { pages, DIST, requireChecked } from './_dist.mjs';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const MAX_IMG = Number(process.env.MAX_IMG_KB || 250), MAX_CSS = Number(process.env.MAX_CSS_KB || 120), MAX_HTML = Number(process.env.MAX_HTML_KB || 400);
// الخطوط بقواعد web.dev لا بعدد مختار: woff2 فقط، font-display على كل @font-face، preload للحرجة فقط (≤ 3 وكلها معرّفة
// في @font-face). حجم الخطوط الإجمالي يُطبع للمعلومة ولا يُحكم به (لا معيار رقمي له في Lighthouse).
const MAX_FONT_PRELOADS = 3;
const all = pages(); const issues = []; const add = (u, m) => issues.push(`${u} :: ${m}`);
const files = []; (function walk(d) { for (const e of readdirSync(d)) { const p = join(d, e); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(DIST);
const size = (rel) => { try { return statSync(join(DIST, decodeURIComponent(rel.split('?')[0]))).size / 1024; } catch { return null; } };
const css = files.filter((f) => f.endsWith('.css')); const cssKB = css.reduce((s, f) => s + statSync(f).size / 1024, 0);
// @font-face قد يسكن في <style> مضمّن (fontsource عبر Astro) لا في ملف CSS، فتُقرأ الرئيسية أيضاً
const inlineCss = (all.find((p) => p.url === '/')?.html.match(/<style[^>]*>[\s\S]*?<\/style>/g) ?? []).join('\n');
const cssText = css.map((f) => readFileSync(f, 'utf8')).join('\n') + '\n' + inlineCss;
const faces = [...cssText.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
const fontFiles = [...new Set(faces.flatMap((f) => [...f.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/["']/g, ''))))];
if (cssKB > MAX_CSS) issues.push(`CSS :: ${cssKB.toFixed(0)} KB > ${MAX_CSS}`);
// وجه بديل بلا url() (src: local(Arial) من next/font لضبط المقاييس) لا يُحمَّل من الشبكة، فلا يحتاج font-display
for (const f of faces) if (/url\(/.test(f) && !/font-display\s*:\s*(swap|optional|fallback)/.test(f)) issues.push('الخطوط :: @font-face بلا font-display: swap');
// web.dev: كل @font-face يقدّم woff2؛ woff أو data: بجانبه احتياط مقبول (fontsource يفعل ذلك)
for (const f of faces) { const us = [...f.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/["']/g, '')).filter((u) => !/^data:/.test(u)); if (us.length && !us.some((u) => /\.woff2(\?|$)/.test(u))) issues.push(`الخطوط :: @font-face بلا woff2: ${us[0].split('/').pop()}`); }
const homeHead = all.find((p) => p.url === '/')?.html.match(/<head[\s\S]*?<\/head>/)?.[0] ?? '';
const preloads = [...homeHead.matchAll(/<link\s[^>]*>/g)].map((m) => m[0]).filter((t) => /rel="preload"/.test(t) && /as="font"/.test(t)).map((t) => t.match(/href="([^"]+)"/)?.[1]).filter(Boolean);
if (preloads.length > MAX_FONT_PRELOADS) issues.push(`الخطوط :: ${preloads.length} preload للخطوط > ${MAX_FONT_PRELOADS} (الحرجة فقط)`);
for (const u of preloads) if (!fontFiles.some((f) => f.endsWith(u.split('/').pop()))) issues.push(`الخطوط :: preload لخط غير معرّف في @font-face: ${u.split('/').pop()}`);
const fontKB = fontFiles.reduce((s, u) => s + (size(u) ?? 0), 0);
const IMG = /<img\s[^>]*>/g;
for (const { url, html, noindex } of all) {
  if (noindex) continue;
  const head = html.match(/<head[\s\S]*?<\/head>/)?.[0] ?? '';
  // noModule (حشوات Next للمتصفحات القديمة) لا تحمّله المتصفحات الداعمة للوحدات
  for (const s of head.matchAll(/<script\s([^>]*)>/g)) if (/(^|\s)src=/.test(s[1]) && !/\b(defer|async)\b|type="module"|\bnomodule\b/i.test(s[1])) add(url, 'سكربت حاجب في head');
  for (const l of head.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="(https?:)?\/\/([^/"]+)/g)) add(url, `stylesheet خارجي من ${l[2]}`);
  if (html.length / 1024 > MAX_HTML) add(url, `HTML ${(html.length / 1024).toFixed(0)} KB > ${MAX_HTML}`);
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? html;
  const h1 = main.search(/<h1[\s>]/), firstEager = main.search(/<img\s(?![^>]*loading="lazy")/);
  if (h1 === -1) add(url, 'لا H1 في main'); else if (firstEager !== -1 && firstEager < h1) add(url, 'صورة غير كسولة قبل H1 (LCP صورة لا نص)');
  const imgs = [...main.matchAll(IMG)].map((m) => m[0]);
  imgs.slice(1).forEach((t) => { if (!/loading="lazy"/.test(t)) add(url, 'صورة بعد الأولى بلا loading="lazy"'); });
  const modern = new Set(main.split('<picture').slice(1).map((x) => x.split('</picture>')[0]).filter((x) => /type="image\/(avif|webp)"/.test(x)).flatMap((x) => [...x.matchAll(IMG)].map((m) => m[0])));
  for (const t of imgs) {
    const src = t.match(/\ssrc="([^"]+)"/)?.[1]; if (!src || /^(https?:|data:)/.test(src)) continue;
    if (!/\.(webp|avif|svg)(\?|$)/.test(src) && !modern.has(t)) add(url, `صورة بصيغة قديمة بلا مصدر حديث ${src.split('/').pop()}`);
    const kb = size(src); if (kb !== null && kb > MAX_IMG) add(url, `صورة ${kb.toFixed(0)} KB > ${MAX_IMG}: ${src.split('/').pop()}`);
  }
  if (url === '/' && fontFiles.length && !/rel="preload"[^>]+as="font"/.test(head) && !faces.every((f) => /font-display/.test(f))) add(url, 'خطوط ذاتية بلا preload ولا font-display');
}
console.log(`صفحات مفحوصة: ${all.length} · CSS ${cssKB.toFixed(0)} KB في ${css.length} ملف · خطوط: ${fontFiles.length} ملف woff2 بـ${fontKB.toFixed(0)} KB، ${preloads.length} preload`); requireChecked(all.length);
const g = {}; for (const i of issues) { const k = i.split(' :: ')[1].replace(/\d+(\.\d+)?/g, 'n').replace(/:.*$/, ''); g[k] = (g[k] || 0) + 1; }
for (const [k, v] of Object.entries(g).sort((a, b) => b[1] - a[1])) console.log(`  ${v}× ${k}`);
issues.slice(0, 8).forEach((i) => console.log('    ' + i));
console.log(issues.length ? `✗ ${issues.length} ملاحظة أداء` : '✓ لا سكربت حاجب، LCP نص، الصور كسولة وحديثة، الخطوط بـswap');
process.exit(issues.length ? 1 : 0);
