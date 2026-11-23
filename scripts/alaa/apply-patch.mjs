/**
 * تطبيق دفعة تحسين على صفحات بعينها: ملف JSON { "<slug>": patch } (صيغة patch في _content.mjs).
 * `updated` يُضبط تلقائياً على تاريخ اليوم لكل صفحة تغيّرت فعلاً، ولا يُمسّ غيرها.
 *   node scripts/apply-patch.mjs content-plan/patches/2026-11-22-batch1.json [--dry]
 *
 * بوابات الدفعة (قرار علاء 23 نوفمبر 2026، البند 3 و5 و7 في الحزمة؛ تعمل مع --dry أيضاً):
 *   • اسم الملف يبدأ بتاريخ الدفعة YYYY-MM-DD، والدفعة = كل ملفات ذلك التاريخ مجتمعة.
 *   • ≤ MAX_BATCH صفحات (افتراضي 5) في تاريخ الدفعة كله.
 *   • ≥ 14 يوماً بين تاريخ الدفعة وآخر دفعة قبلها، ولا تاريخ في المستقبل (قرار علاء 23 نوفمبر 2026 بعد استشارة مستقلة).
 *   • لا صفحة في الدفعة عُدّلت في دفعة خلال آخر 28 يوماً: كل صفحة تُقاس وحدها 28 يوماً قبل أن تُمسّ ثانية.
 *   • إقرار المراجعة في الملف: "_review": { "humanizer": true, "date": "YYYY-MM-DD" } (ولا يُعدّ صفحة).
 *   node scripts/apply-patch.mjs --selftest   → 7 حالات مزروعة لبوابات الدفعة (13)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MAX_BATCH = Number(process.env.MAX_BATCH || 5), GAP_DAYS = 14, REPEAT_DAYS = 28;
// «اليوم» بالتوقيت المحلي (عمّان) لا UTC: بين منتصف الليل والثالثة فجراً كان UTC يرفض دفعة بتاريخ اليوم المحلي
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** آخر تاريخ دفعة في مجلد الدفعات (أسماء تبدأ بـ YYYY-MM-DD)، أو null. */
export const lastBatchDate = (dir = "content-plan/patches") => (existsSync(dir) ? readdirSync(dir).map((f) => DATE(f)).filter(Boolean).sort().pop() ?? null : null);
const DATE = (f) => basename(f).match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;

/** بوابات الدفعة. files: [{name, slugs:[...]}] كل ملفات مجلد الدفعات (ومنها الهدف)، target: اسم الملف. */
export function batchGate(files, target, review, today = localDay(), inPatchesDir = true) {
  const errs = []; const d = DATE(target);
  if (!inPatchesDir) errs.push('ملف الدفعة يجب أن يكون في content-plan/patches/ (وإلا لا تراه بوابة الوتيرة ولا القياس)');
  if (!d) return [...errs, `اسم الملف لا يبدأ بتاريخ الدفعة YYYY-MM-DD: ${basename(target)}`];
  // تاريخ الدفعة = اليوم: تأريخها في الماضي كان يتجاوز بوابة 28 يوماً (ثغرة 23 نوفمبر 2026)
  if (d !== today) errs.push(`تاريخ الدفعة ${d} ليس اليوم ${today}؛ سمِّ الملف بتاريخ يوم التطبيق`);
  const same = new Set(files.filter((f) => DATE(f.name) === d).flatMap((f) => f.slugs));
  if (same.size > MAX_BATCH) errs.push(`دفعة ${d} فيها ${same.size} صفحة (> ${MAX_BATCH})؛ قسّمها على دفعات بينها ${GAP_DAYS} يوماً وبصفحات مختلفة`);
  const prev = [...new Set(files.map((f) => DATE(f.name)).filter((x) => x && x < d))].sort().pop();
  if (prev) { const gap = (Date.parse(d) - Date.parse(prev)) / 864e5; if (gap < GAP_DAYS) errs.push(`آخر دفعة ${prev} قبل ${gap} يوماً فقط (< ${GAP_DAYS})؛ انتظر`); }
  // صفحة عُدّلت خلال آخر 28 يوماً لا تُمسّ قبل أن يُقاس تعديلها (علامات القوالب وصناديق الروابط تُعدّ بصفحاتها)
  const recent = new Set(files.filter((f) => { const x = DATE(f.name); return x && x < d && (Date.parse(d) - Date.parse(x)) / 864e5 < REPEAT_DAYS; }).flatMap((f) => f.slugs));
  const again = [...same].filter((s) => recent.has(s));
  if (again.length) errs.push(`${again.length} صفحة عُدّلت في دفعة خلال آخر ${REPEAT_DAYS} يوماً ولم تُقس بعد: ${again.slice(0, 5).join('، ')}`);
  if (!(review && review.humanizer === true && /^\d{4}-\d{2}-\d{2}$/.test(review.date ?? ''))) errs.push('لا إقرار مراجعة: أضف "_review": { "humanizer": true, "date": "YYYY-MM-DD" } بعد مراجعة كل نص بـ humanizer');
  return errs;
}

if (process.argv.includes('--selftest')) {
  const ok = { humanizer: true, date: '2026-12-20' }; const s = (n) => Array.from({ length: n }, (_, i) => `p${i}`);
  const T = [
    ['دفعة سليمة بعد 28 يوماً', batchGate([{ name: '2026-11-22-a.json', slugs: s(5) }, { name: '2026-12-20-a.json', slugs: s(5) }], '2026-12-20-a.json', ok, '2026-12-20'), 0],
    ['6 صفحات في ملف واحد', batchGate([{ name: '2026-12-20-a.json', slugs: s(6) }], '2026-12-20-a.json', ok, '2026-12-20'), 1],
    ['ملفان في التاريخ نفسه مجموعهما 8', batchGate([{ name: '2026-12-20-a.json', slugs: ['a', 'b', 'c', 'd'] }, { name: '2026-12-20-b.json', slugs: ['e', 'f', 'g', 'h'] }], '2026-12-20-b.json', ok, '2026-12-20'), 1],
    ['بعد 14 يوماً بصفحات مختلفة', batchGate([{ name: '2026-12-06-a.json', slugs: ['a', 'b'] }, { name: '2026-12-20-a.json', slugs: ['c', 'd'] }], '2026-12-20-a.json', ok, '2026-12-20'), 0],
    ['بعد 14 يوماً بصفحة مكررة', batchGate([{ name: '2026-12-06-a.json', slugs: ['a', 'b'] }, { name: '2026-12-20-a.json', slugs: ['b', 'c'] }], '2026-12-20-a.json', ok, '2026-12-20'), 1],
    ['صفحة من علامة قالب قبل 20 يوماً', batchGate([{ name: '2026-11-30-template.json', slugs: s(40) }, { name: '2026-12-20-a.json', slugs: ['p7'] }], '2026-12-20-a.json', ok, '2026-12-20'), 1],
    ['دفعة بعد 10 أيام', batchGate([{ name: '2026-11-22-a.json', slugs: s(3) }, { name: '2026-12-02-a.json', slugs: ['x', 'y', 'z'] }], '2026-12-02-a.json', ok, '2026-12-02'), 1],
    ['بلا إقرار humanizer', batchGate([{ name: '2026-12-20-a.json', slugs: s(2) }], '2026-12-20-a.json', undefined, '2026-12-20'), 1],
    ['اسم بلا تاريخ', batchGate([], 'batch.json', ok, '2026-12-20'), 1],
    ['تاريخ مستقبلي', batchGate([{ name: '2027-01-01-a.json', slugs: s(1) }], '2027-01-01-a.json', ok, '2026-12-20'), 1],
    ['تاريخ ماضٍ للتحايل على 28 يوماً', batchGate([{ name: '2026-11-22-a.json', slugs: s(5) }, { name: '2026-10-01-x.json', slugs: s(3) }], '2026-10-01-x.json', ok, '2026-11-25'), 1],
    ['علامة صناديق بـ4 صفحات ثم دفعة بصفحتين في اليوم نفسه', batchGate([{ name: '2026-12-20-anchors-boxes.json', slugs: s(4) }, { name: '2026-12-20-a.json', slugs: ['x', 'y'] }], '2026-12-20-a.json', ok, '2026-12-20'), 1],
    ['ملف خارج مجلد الدفعات', batchGate([], 'C:/tmp/2026-12-20-a.json', ok, '2026-12-20', false), 1],
  ];
  let bad = 0; for (const [n, e, want] of T) { const g = e.length === want; bad += !g; console.log(`${g ? '✓' : '✗'} ${n}: ${e.length} رفض${e.length ? ' · ' + e.join(' | ') : ''}`); }
  console.log(bad ? `✗ ${bad} حالة فشلت` : `✓ ${T.length} حالات صحيحة`); process.exit(bad ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2]; const dry = process.argv.includes('--dry');
  if (!file) { console.error('الاستخدام: node scripts/apply-patch.mjs <patch.json> [--dry] | --selftest'); process.exit(1); }
  const { _review, ...patches } = JSON.parse(readFileSync(file, 'utf8')); const today = localDay();
  const dir = dirname(file); const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ name: f, slugs: (() => { const j = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')); return [...Object.keys(j).filter((k) => !k.startsWith('_')), ...(j._pages ?? []).map((u) => String(u).split('/').pop())]; })() })) : [];
  if (!files.some((f) => f.name === basename(file))) files.push({ name: basename(file), slugs: Object.keys(patches) });
  const inPatches = resolve(dir).toLowerCase() === resolve('content-plan/patches').toLowerCase();
  const gate = batchGate(files, file, _review, today, inPatches);
  if (gate.length) { console.log('✗ بوابات الدفعة:'); gate.forEach((e) => console.log('  ✗ ' + e)); process.exit(1); }
  (await import('./_config.mjs')).requireFull('apply-patch');
  const { writePage, readPage } = await import('./_content.mjs');
  let pages = 0, edits = 0;
  for (const [slug, patch] of Object.entries(patches)) {
    const before = await readPage(slug);
    const lim = (k, v, max) => { if (v && [...v].length > max) throw new Error(`${slug}: ${k} ${[...v].length} حرفاً > ${max}`); };
    lim('metaTitle', patch.metaTitle, 60); if (patch.metaDescription) { lim('metaDescription', patch.metaDescription, 160); if ([...patch.metaDescription].length < 120) throw new Error(`${slug}: وصف قصير`); }
    const n = dry ? 0 : writePage(slug, { ...patch, __current: before, updated: before.updated ? today : undefined });
    const what = Object.keys(patch).map((k) => Array.isArray(patch[k]) ? `${k}+${patch[k].length}` : k).join(' ');
    console.log(`${dry ? '○' : '✓'} ${slug}: ${what}${dry ? '' : ` (${n} تعديلاً)`}`); pages++; edits += n;
  }
  console.log(`صفحات: ${pages} · تعديلات: ${edits}${dry ? ' (تجربة بلا كتابة)' : ''}`);
  if (!pages) process.exit(1);
}
