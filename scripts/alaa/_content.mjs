/**
 * طبقة قراءة/كتابة لمحتوى TS (مقالات src/lib/articles-*، وتوسيعاتها، ودلائل services*.ts).
 *
 * الموقع يركّب المقال من كائنه الأصلي ثم طبقات التوسيع (wave9-expansions a/b ← 2026-10-28 ← 2026-11-03)
 * حيث تطغى metaTitle/metaDescription/answer في الطبقة الأعلى. فالكتابة تذهب إلى **الموضع الفعّال**:
 * الحقل القياسي يُعدَّل في أعلى طبقة تعرّفه (وإلا في الكائن الأصلي)، والأسئلة والأقسام تُلحق بالكائن
 * الأصلي، و`replace` يُطبَّق حيث وُجد النص. التعديل بتبديل النص الحرفي داخل نطاق الكائن فقط، فلا
 * تُعاد كتابة الملف ولا يُمسّ غيره. يرفض حقلاً ليس نصاً حرفياً بعلامتي اقتباس (قالب `${pr()}`).
 *
 *   listPages()            → [{ slug, kind, url, title, keyword, updated }]
 *   readPage(slug)         → الكائن الفعّال (بعد التوسيعات) + kind
 *   writePage(slug, patch) → patch: { metaTitle?, metaDescription?, title?, answer?, keyword?, updated?,
 *                            faqs?: [{q,a}] (إلحاق), sections?: [{h2,paragraphs,list?}] (إلحاق), replace?: [{from,to}] }
 *   node scripts/_content.mjs --selftest   # يثبت أن كل كائن يُحدَّد في ملفه وأن القراءة تطابق البناء
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from './_ts.mjs';
import { CONFIG, requireFull } from './_config.mjs';

const LIB = CONFIG.content.lib;
/** طبقات التوسيع من الأدنى إلى الأعلى (الأعلى يطغى). */
const LAYERS = (CONFIG.content.layers ?? []).map((f) => join(LIB, f));
const tsFiles = (d, o = []) => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) { if (e !== 'graphify-out') tsFiles(p, o); } else if (e.endsWith('.ts') && !LAYERS.includes(p)) o.push(p); } return o; };

/** نهاية الكائن الذي يبدأ قوسه عند open: ماسح يتخطى النصوص والتعليقات. */
function closeOf(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; } continue; }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; continue; }
    if (c === '{') depth++; else if (c === '}' && --depth === 0) return i;
  }
  throw new Error('كائن غير مغلق');
}
/** نطاق الكائن الأصلي {file, start, end} لمقال أو دليل. */
function baseSpan(slug) {
  const re = new RegExp(`(^|[\\s{,])"?slug"?\\s*:\\s*"${slug}"`, 'm');
  for (const file of tsFiles(LIB)) {
    const src = readFileSync(file, 'utf8'); const m = re.exec(src); if (!m) continue;
    const start = src.lastIndexOf('{', m.index + 1); // slug أول حقل في كل الكائنات (تحقق --selftest)
    return { file, src, start, end: closeOf(src, start) };
  }
  throw new Error(`لا كائن لـ ${slug} في ${LIB}`);
}
/** نطاق مدخلة التوسيع للـslug في طبقة، أو null. */
function layerSpan(file, slug) {
  const src = readFileSync(file, 'utf8'); const m = new RegExp(`^\\s*"?${slug}"?\\s*:\\s*\\{`, 'm').exec(src); if (!m) return null;
  const start = src.indexOf('{', m.index); return { file, src, start, end: closeOf(src, start) };
}
/** موضع قيمة حقل داخل النطاق: {at, end, value} لنص حرفي بعلامتي اقتباس، أو {at, literal:false} لغيره، أو null. */
function field(span, name) {
  const body = span.src.slice(span.start, span.end + 1);
  const re = new RegExp(`(^|[\\s{,])"?${name}"?\\s*:\\s*`, 'g'); let m;
  while ((m = re.exec(body))) {
    const at = span.start + m.index + m[0].length;
    if (depthAt(body, m.index + m[0].length) !== 1) continue; // حقل كائن فرعي لا الحقل نفسه
    if (span.src[at] !== '"') return { at, literal: false };
    let i = at + 1; while (span.src[i] !== '"') { if (span.src[i] === '\\') i++; i++; }
    return { at, end: i + 1, value: JSON.parse(span.src.slice(at, i + 1)), literal: true };
  }
  return null;
}
function depthAt(body, pos) { let d = 0; for (let i = 0; i < pos; i++) { const c = body[i]; if (c === '"' || c === "'" || c === '`') { const q = c; i++; while (i < pos && body[i] !== q) { if (body[i] === '\\') i++; i++; } continue; } if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') d--; } return d; }

export async function listPages() {
  const { ARTICLES, SERVICES } = await loadContent();
  return [...ARTICLES.map((a) => ({ slug: a.slug, kind: 'article', url: `${CONFIG.content.articlePrefix}${a.slug}`, title: a.title, keyword: a.keyword, updated: a.updated })),
    ...SERVICES.map((s) => ({ slug: s.slug, kind: 'service', url: `${CONFIG.content.servicePrefix}${s.slug}`, title: s.h1, keyword: s.keyword }))];
}
export async function readPage(slug) {
  const { ARTICLES, SERVICES } = await loadContent();
  const a = ARTICLES.find((x) => x.slug === slug); if (a) return { kind: 'article', ...a };
  const s = SERVICES.find((x) => x.slug === slug); if (s) return { kind: 'service', ...s };
  throw new Error(`لا صفحة ${slug}`);
}
const SCALARS = ['metaTitle', 'metaDescription', 'title', 'answer', 'keyword', 'excerpt', 'short', 'h1'];
const ind = (s, n) => s.split('\n').join('\n' + ' '.repeat(n));
export function writePage(slug, patch) {
  requireFull('writePage');
  const edits = new Map(); // file → [{at,end,text}]
  const add = (file, at, end, text) => { (edits.get(file) ?? edits.set(file, []).get(file)).push({ at, end, text }); };
  const base = baseSpan(slug);
  const layers = LAYERS.map((f) => layerSpan(f, slug)).filter(Boolean);
  for (const k of SCALARS) {
    if (patch[k] === undefined) continue;
    const target = [...layers].reverse().map((l) => [l, field(l, k)]).find(([, f]) => f) ?? [base, field(base, k)];
    const [span, f] = target;
    if (!f) { if (k === 'metaTitle' || k === 'metaDescription') throw new Error(`${slug}: لا حقل ${k}`); add(base.file, base.start + 1, base.start + 1, `\n  ${k}: ${JSON.stringify(patch[k])},`); continue; }
    if (!f.literal) throw new Error(`${slug}: ${k} ليس نصاً حرفياً في ${span.file} (قالب أو تعبير)، عدّله يدوياً`);
    if (f.value !== patch[k]) add(span.file, f.at, f.end, JSON.stringify(patch[k]));
  }
  if (patch.updated) {
    const f = field(base, 'updated'); if (!f) throw new Error(`${slug}: لا حقل updated`);
    if (f.literal) { if (f.value !== patch.updated) add(base.file, f.at, f.end, JSON.stringify(patch.updated)); }
    else { const id = /^[A-Za-z_$][\w$]*/.exec(base.src.slice(f.at)); if (!id) throw new Error(`${slug}: updated ليس نصاً ولا معرّفاً`); add(base.file, f.at, f.at + id[0].length, JSON.stringify(patch.updated)); } // ثابت مشترك (U) يُستبدل بتاريخ حرفي لهذا المقال وحده
  }
  for (let [k, items] of [['faqs', patch.faqs], ['sections', patch.sections]]) {
    if (!items?.length) continue;
    const f = field(base, k);
    // لا تكرار: ما سبق إلحاقه (بالسؤال أو العنوان) يُتجاهل، فالتطبيق المكرر للدفعة آمن
    const have = new Set((patch.__current?.[k] ?? []).map((x) => x.q ?? x.h2)); items = items.filter((x) => !have.has(x.q ?? x.h2)); if (!items.length) continue; if (!f || base.src[f.at] !== '[') throw new Error(`${slug}: لا مصفوفة ${k}`);
    const close = closeOf(base.src.replace(/\[/g, '{').replace(/\]/g, '}'), f.at); // نفس الماسح للأقواس المربعة
    let i = close - 1; while (/\s/.test(base.src[i])) i--;
    const comma = base.src[i] === ',' ? '' : ',';
    add(base.file, close, close, `${comma}\n  ${items.map((x) => ind(JSON.stringify(x, null, 2), 2)).join(',\n  ')},\n`);
  }
  for (const r of patch.replace ?? []) {
    const span = [base, ...layers].find((s) => s.src.slice(s.start, s.end).includes(JSON.stringify(r.from).slice(1, -1)));
    if (!span) throw new Error(`${slug}: لم يُعثر على «${r.from.slice(0, 40)}»`);
    const needle = JSON.stringify(r.from).slice(1, -1); const at = span.src.indexOf(needle, span.start);
    add(span.file, at, at + needle.length, JSON.stringify(r.to).slice(1, -1));
  }
  let changed = 0;
  for (const [file, list] of edits) {
    let src = readFileSync(file, 'utf8');
    for (const e of list.sort((a, b) => b.at - a.at)) src = src.slice(0, e.at) + e.text + src.slice(e.end);
    writeFileSync(file, src); changed += list.length;
  }
  return changed;
}

if (process.argv.includes('--selftest')) {
  const { ARTICLES, SERVICES } = await loadContent(); let n = 0, bad = 0;
  for (const a of [...ARTICLES, ...SERVICES]) {
    try {
      const b = baseSpan(a.slug); const t = field(b, 'title') ?? field(b, 'name');
      const first = b.src.slice(b.start + 1, b.start + 40).replace(/\s/g, '').startsWith('"slug"') || b.src.slice(b.start + 1, b.start + 40).replace(/\s/g, '').startsWith('slug');
      if (!first || !t?.literal || t.value !== (a.title ?? a.name)) { bad++; console.log(`✗ ${a.slug}: ${b.file} first=${first} title=${t?.value?.slice(0, 30)}`); }
      n++;
      // كتابة بلا تغيير: لا تعديل في الملفات
      if (writePage(a.slug, a.h1 ? { metaTitle: a.metaTitle, h1: a.h1 } : { metaTitle: a.metaTitle, title: a.title }) !== 0) { bad++; console.log(`✗ ${a.slug}: كتابة بلا تغيير عدّلت الملف`); }
    } catch (e) { bad++; console.log(`✗ ${a.slug}: ${e.message}`); }
  }
  console.log(`كائنات محدَّدة: ${n} من ${ARTICLES.length + SERVICES.length} · أخطاء: ${bad}`);
  process.exit(bad || !n ? 1 : 0);
}
