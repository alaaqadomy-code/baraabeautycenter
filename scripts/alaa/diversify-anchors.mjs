/**
 * تنويع المراسي (محسّن حسن مكيّفاً): صناديق «للتوسع في الموضوع» (src/lib/phase2-links.ts) تكرر نص
 * المرساة نفسه 10–15 مرة لكل هدف، فيرصدها check-internal-links هيمنةً (> ثلث الروابط). الحل: لكل هدف
 * صيغتان بديلتان من كلماته البحثية الحقيقية (`keywords` في كائنه)، تُوزَّع على المقالات المصدر
 * بالتناوب فلا تزيد أي صيغة على الثلث. تُكتب `anchors: { <slug المصدر>: <نص> }` في الهدف،
 * و[slug].astro يقرأها. تجربة بلا كتابة افتراضياً.
 * بوابة الدفعة (تدقيق 23 نوفمبر 2026: كانت الأداة تكتب في صفحات كثيرة متجاوزة حد 5 صفحات و28 يوماً):
 *   • الصناديق (`--apply --reviewed`): تعديل قالب واحد يمس صفحات كثيرة، فيُسمح فقط بعد ≥ 28 يوماً من آخر دفعة،
 *     ويُكتب علامة content-plan/patches/<اليوم>-anchors-boxes.json تمنع دفعة أخرى قبل القياس.
 *   • المتن (`--inline --write`): لا كتابة في الصفحات؛ مسودة دفعة في content-plan/patches-draft/ تُطبَّق بـ apply-patch.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { readPage } from './_content.mjs';
import { localDay, lastBatchDate, GAP_DAYS, MAX_BATCH } from './apply-patch.mjs';
import { CONFIG, requireFull } from './_config.mjs';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
requireFull('diversify-anchors');
const FILE = CONFIG.anchorBoxes?.file, ASTRO = CONFIG.anchorBoxes?.astro;
const BOXES = FILE && existsSync(FILE);
const inline = process.argv.includes('--inline');
const apply = !inline && process.argv.includes('--apply');
if (apply) {
  const last = lastBatchDate(); const gap = last ? (Date.parse(localDay()) - Date.parse(last)) / 864e5 : Infinity;
  if (gap < GAP_DAYS) { console.error(`⛔ آخر دفعة ${last} قبل ${gap} يوماً (< ${GAP_DAYS})؛ تنويع الصناديق يمس صفحات كثيرة، فقِس أولاً`); process.exit(1); }
  if (!process.argv.includes('--reviewed')) { console.error('⛔ أضف --reviewed بعد قراءة كل مرساة بديلة في التجربة (نص الرابط يظهر للقارئ)'); process.exit(1); }
}
const norm = (s) => s.replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
// موقع بلا صناديق روابط (anchorBoxes) يعمل بوضع المتن وحده
let src = BOXES ? readFileSync(FILE, 'utf8') : ''; const { P2_TARGETS } = BOXES ? await import(pathToFileURL(process.cwd() + '/' + FILE).href) : { P2_TARGETS: [] };
let targets = 0, assigned = 0, skipped = [], affected = [];
for (const t of P2_TARGETS) {
  if (t.anchors) continue; // منوَّع من قبل
  const slug = t.href.split('/').pop(); let page; try { page = await readPage(slug); } catch { skipped.push(`${t.href}: لا صفحة`); continue; }
  const words = (s) => s.trim().split(/\s+/).length;
  const variants = [...new Set(page.keywords.map((k) => k.trim()))].filter((k) => norm(k) !== norm(t.anchor) && words(k) >= 2 && words(k) <= 6 && !/^(كم|هل|ما |متى|كيف)|(أ|ا)فضل (دكتور|طبيب|جراح|مركز|عيادة)|مجان|(^| )(الاردن|الانف|افضل|اسعار|ابر|اذابه|اثار|اضرار|اعراض|الاسنان|ايهما|ام)( |$)/.test(k)).slice(0, 3);
  if (variants.length < 2) { skipped.push(`${t.href}: ${variants.length} صيغة بديلة فقط`); continue; }
  // الأصل يبقى لمرساة المتن (حيث يرد كثيراً أصلاً)، والصناديق تأخذ البدائل بالتناوب
  const pool = variants.length === 3 ? variants : [t.anchor, ...variants]; const anchors = {};
  t.from.forEach((f, i) => { anchors[f] = pool[i % pool.length]; });
  targets++; assigned += Object.keys(anchors).length; affected.push(...t.from);
  console.log(`${apply ? '✓' : '○'} ${t.href}: «${t.anchor}» + «${variants[0]}» + «${variants[1]}» على ${t.from.length} مصدراً`);
  if (apply) {
    const re = new RegExp(`(href: ${JSON.stringify(t.href)}, anchor: ${JSON.stringify(t.anchor)},)`);
    if (!re.test(src)) throw new Error(`لم أجد سطر ${t.href} في ${FILE}`);
    src = src.replace(re, `$1\n    anchors: ${JSON.stringify(anchors)},`);
  }
}
// صفحات المصادر التي يتغيّر فيها نص رابط: تدخل في حد الدفعة (5 صفحات لليوم) كأي دفعة (تدقيق 23 نوفمبر 2026)
const pagesTouched = [...new Set(affected)];
if (apply && !targets) { console.log('لا أهداف للتنويع؛ لا كتابة ولا علامة دفعة.'); process.exit(0); }
if (apply && pagesTouched.length > MAX_BATCH) { console.error(`⛔ تنويع الصناديق يغيّر نص روابط في ${pagesTouched.length} صفحة (> ${MAX_BATCH})؛ قسّمه على دفعات بينها ${GAP_DAYS} يوماً`); process.exit(1); }
if (apply) {
  src = src.replace('export type P2Target = { href: string; anchor: string; from: string[] };', 'export type P2Target = { href: string; anchor: string; from: string[]; /** مرساة بديلة لمصدر بعينه (تنويع المراسي 22 نوفمبر 2026) */ anchors?: Record<string, string> };');
  writeFileSync(FILE, src);
  let astro = readFileSync(ASTRO, 'utf8'); const from = '{p2.map((t) => <li><a href={t.href}>{t.anchor}</a></li>)}';
  if (astro.includes(from)) writeFileSync(ASTRO, astro.replace(from, '{p2.map((t) => <li><a href={t.href}>{t.anchors?.[a.slug] ?? t.anchor}</a></li>)}')); // مطبّق من قبل إن غاب السطر الأصلي
  // علامة الدفعة: صفحاتها في `_pages` تُحسب في حد 5 صفحات لليوم، وتاريخها يمنع دفعة أخرى قبل 28 يوماً.
  // الإقرار هنا تصريح من صاحب --reviewed، لا تحقق آلي.
  writeFileSync(`content-plan/patches/${localDay()}-anchors-boxes.json`, JSON.stringify({ _template: FILE, _review: { humanizer: true, date: localDay(), note: 'صرّح به --reviewed: نصوص روابط من كلمات الأهداف، قُرئت في التجربة' }, _targets: targets, _pages: pagesTouched }, null, 2));
}
skipped.forEach((s) => console.log('  ⚠ ' + s));
console.log(`أهداف: ${targets} من ${P2_TARGETS.length} · مراسٍ بديلة: ${assigned}${apply ? '' : ' (تجربة؛ أضف --apply)'}`);
if (!targets && !process.argv.includes("--inline")) process.exit(1);

/**
 * --inline: المراسي داخل متن المقالات (لا صناديق للتوسع): حين يهيمن نص واحد على أكثر من ثلث روابط هدفه
 * (قاعدة check-internal-links)، يُستبدل في بعض المصادر نص الرابط `<a href="/blog/x">النص</a>` بصيغة من
 * كلمات الهدف البحثية، بالتناوب، حتى ينزل تحت الحدّ. الجملة لا تتغير إلا في نص الرابط.
 */
const esc = (s) => s.replace(/[.*+?^$(){}|[\]\\]/g, (c) => '\\' + c);
const LINK_RE = new RegExp('<a href="((?:' + [CONFIG.content.articlePrefix, CONFIG.content.servicePrefix].map(esc).join('|') + ')[^"#?]+)">([^<]+)</a>', 'g');
if (process.argv.includes('--inline')) {
  const { pages, isContent } = await import('./_dist.mjs'); const write = process.argv.includes('--write'); const patch = {};
  const all = pages(); const inbound = new Map();
  for (const p of all) {
    const art = (p.html.match(/<article[\s\S]*?<\/article>/)?.[0] ?? '').replace(/<aside[\s\S]*?<\/aside>/g, ' ').replace(/<nav[\s\S]*?<\/nav>/g, ' ').replace(/<p[^>]*>ضمن قسم[\s\S]*?<\/p>/g, ' ');
    for (const m of art.matchAll(LINK_RE)) { const l = inbound.get(m[1]) ?? []; if (!l.some((x) => x.from === p.url)) l.push({ from: p.url, anchor: m[2] }); inbound.set(m[1], l); }
  }
  let fixedTargets = 0, swaps = 0;
  for (const [target, list] of inbound) {
    if (!isContent(target)) continue;
    const counts = new Map(); for (const { anchor } of list) counts.set(anchor, (counts.get(anchor) ?? 0) + 1);
    const limit = Math.max(4, Math.ceil(list.length / 3));
    for (const [anchor, n] of counts) {
      if (anchor.split(/\s+/).length < 4 || n <= limit) continue;
      let page; try { page = await readPage(target.split('/').pop()); } catch { continue; }
      const variants = [...new Set(page.keywords.map((k) => k.trim()))].filter((k) => norm(k) !== norm(anchor) && k.split(/\s+/).length >= 2 && k.split(/\s+/).length <= 6 && !/^(كم|هل|ما |متى|كيف)|(أ|ا)فضل (دكتور|طبيب|جراح|مركز|عيادة)|مجان|(^| )(الاردن|الانف|افضل|اسعار|ابر|اذابه|اثار|اضرار|اعراض|الاسنان|ايهما|ام)( |$)/.test(k)).slice(0, 3);
      if (variants.length < 2) { console.log(`  ⚠ ${target}: لا صيغ بديلة لـ «${anchor}»`); continue; }
      const sources = list.filter((x) => x.anchor === anchor && /^\/blog\//.test(x.from)).slice(0, n - limit);
      sources.forEach((s, i) => {
        const from = `<a href="${target}">${anchor}</a>`, to = `<a href="${target}">${variants[i % variants.length]}</a>`;
        console.log(`  ○ ${s.from} → ${target}: «${anchor}» ⇒ «${variants[i % variants.length]}»`);
        const slug = s.from.split('/').pop(); (patch[slug] ??= { replace: [] }).replace.push({ from, to }); swaps++;
      });
      fixedTargets++;
    }
  }
  const n = Object.keys(patch).length;
  if (write && n) {
    mkdirSync('content-plan/patches-draft', { recursive: true }); const f = `content-plan/patches-draft/${localDay()}-anchors-inline.json`;
    writeFileSync(f, JSON.stringify(patch, null, 2));
    console.log(`✓ مسودة دفعة: ${f} (${n} صفحة). اقرأ كل جملة تغيّر نص رابطها، أضف "_review"، انقلها إلى content-plan/patches/ ثم npm run patch -- <الملف>.${n > 5 ? ` ⚠ ${n} صفحة > 5: قسّمها على دفعات.` : ''}`);
  }
  console.log(`أهداف بمرساة مهيمنة في المتن: ${fixedTargets} · استبدالات مقترحة: ${swaps} في ${n} صفحة${write ? '' : ' (تجربة؛ أضف --write لكتابة مسودة الدفعة)'}`);
}
