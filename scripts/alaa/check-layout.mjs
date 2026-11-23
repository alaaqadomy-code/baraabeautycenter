/**
 * حارس التخطيط للموقع اليدوي (نظير check-layout عند حسن، لكن على dist لا على global.css القالب):
 *   • كل <table> داخل حاوية تسمح بالتمرير الأفقي (overflow-x: auto/scroll أو صنف overflow-x-auto) وإلا سحب الجوال كله.
 *   • لا width/min-width صلبة ≥ 360px في style= مضمّن أو في CSS بلا media للجوال.
 *   • لا height صلبة للهيدر/التنقل بالبكسل في CSS (تتعارض مع ارتفاع فعلي متغير).
 *   • scroll-margin/scroll-padding للعناوين موجودة إن كان الهيدر لاصقاً (sticky/fixed) وفيه روابط #.
 *   • لا عنصر بـ position: fixed يغطي أسفل الشاشة بلا safe-area (الزر العائم) إلا بهامش.
 */
import { pages, DIST, requireChecked } from './_dist.mjs';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const all = pages(); const issues = []; const add = (u, m) => issues.push(`${u} :: ${m}`);
const cssFiles = []; (function walk(d) { for (const e of readdirSync(d)) { const p = join(d, e); statSync(p).isDirectory() ? walk(p) : p.endsWith('.css') && cssFiles.push(p); } })(DIST);
const css = cssFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
// CSS: قواعد خارج أي @media بعرض صلب كبير
const noMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ' ');
// جدول داخل حاوية تمرير (table-wrap/overflow-x-auto) يحق له min-width: هذا هو حل حسن نفسه للجداول العريضة
// max-width ليست عرضاً صلباً (لا تسبب تمريراً على الجوال): «.max-w-[1180px]» كانت تُعدّ مخالفة (تركيب snaporahub)
for (const m of noMedia.matchAll(/([^{}]+)\{[^{}]*?(?:min-width|(?<!max-)width)\s*:\s*(\d{3,})px/g)) if (Number(m[2]) >= 360 && !/^\s*(html|body|\.container|img|svg|video|iframe)|table/i.test(m[1])) issues.push(`CSS :: عرض صلب ${m[2]}px خارج media: ${m[1].trim().slice(0, 50)}`);
for (const m of noMedia.matchAll(/((?:header|nav|\.site-nav|\.header)[^{}]*)\{[^{}]*?\bheight\s*:\s*(\d{2,})px/g)) issues.push(`CSS :: ارتفاع هيدر صلب ${m[2]}px: ${m[1].trim().slice(0, 40)}`);
let tables = 0, sticky = 0;
for (const { url, html } of all) {
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? html;
  for (const t of main.matchAll(/<table\b/g)) {
    tables++;
    const before = main.slice(Math.max(0, t.index - 400), t.index);
    if (!/overflow-x[-:]\s*(auto|scroll)|overflow-x-auto|overflow-auto|table-lux|table-wrap/.test(before)) add(url, 'جدول بلا حاوية تمرير أفقي');
  }
  for (const s of html.matchAll(/<(\w+)[^>]*style="([^"]*)"/g)) { if (s[1] === 'table' && /table-wrap|overflow-x/.test(html.slice(Math.max(0, s.index - 400), s.index))) continue; const w = s[2].match(/(?<!max-)(?:min-)?width\s*:\s*(\d{3,})px/); if (w && Number(w[1]) >= 360) add(url, `عرض صلب مضمّن ${w[1]}px في <${s[1]}>`); }
  const isSticky = /<header[^>]*class="[^"]*(sticky|fixed)/.test(html) || /header[^{]*\{[^}]*position\s*:\s*(sticky|fixed)/.test(css);
  if (isSticky) { sticky++; if (/href="#s\d|href="#[^"]+"/.test(main) && !/scroll-mt-|scroll-margin|scroll-padding/.test(html + css)) add(url, 'هيدر لاصق وروابط # بلا scroll-margin'); }
  if (/class="[^"]*\bfixed\b[^"]*\bbottom-0\b/.test(html) && !/safe-area|env\(safe/.test(html + css)) add(url, 'عنصر ثابت عند الأسفل بلا safe-area');
}
console.log(`صفحات مفحوصة: ${all.length} · جداول: ${tables} · ملفات CSS: ${cssFiles.length} · هيدر لاصق: ${sticky ? 'نعم' : 'لا'}`); requireChecked(all.length);
const g = {}; for (const i of issues) { const k = i.split(' :: ')[1].replace(/\d+/g, 'n').replace(/:.*$/, ''); g[k] = (g[k] || 0) + 1; }
for (const [k, v] of Object.entries(g).sort((a, b) => b[1] - a[1])) console.log(`  ${v}× ${k}`);
issues.slice(0, 8).forEach((i) => console.log('    ' + i));
console.log(issues.length ? `✗ ${issues.length} ملاحظة تخطيط` : '✓ الجداول قابلة للتمرير، لا عرض صلب، الهيدر والتمرير سليمان');
process.exit(issues.length ? 1 : 0);
