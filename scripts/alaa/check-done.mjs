/**
 * الإتمام: هل طُبّقت الحزمة على هذا الموقع 100%؟ كل بند يُثبت بأمر أو ملف، لا بكلمة «تم».
 * يُشغَّل في جذر الموقع بعد آخر نشر وتحقق حي. رمز 0 = مكتمل، 1 = بند ناقص (يُطبع مع سببه).
 *   node scripts/alaa/check-done.mjs            (أو scripts/check-done.mjs في موقع المرجع)
 *   node scripts/alaa/check-done.mjs --selftest
 * ما لا يُثبت آلياً (فائدة النص للقارئ، مصادر الأرقام) يتولاه برومبت «تدقيق-بعد-العمل.md» بوكيل مستقل.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));

/** شهادة verify-live: حديثة (≤ 60 دقيقة)، بلا أخطاء، كاملة، ولهذا الدومين. */
export function certFault(v, base, now = Date.now()) {
  if (!v) return 'لا شهادة تحقق حي (content-plan/verify-live.json): انشر ثم شغّل verify-live';
  const age = (now - Date.parse(v.at)) / 6e4;
  if (!(age <= 60)) return `شهادة التحقق الحي عمرها ${Math.round(age)} دقيقة (> 60): أعد التحقق بعد آخر نشر`;
  if (v.errors) return `التحقق الحي فيه ${v.errors} خطأ`;
  if (v.checked !== v.urls) return `التحقق الحي جزئي: ${v.checked ?? '?'} من ${v.urls} رابطاً`;
  if (base && v.base !== base) return `الشهادة لدومين آخر: ${v.base}`;
  return null;
}
/** كل ملف دفعة مطبّقة فيه إقرار مراجعة humanizer. الدفعات المؤرخة قبل بدء الشرط (23 نوفمبر 2026) معفاة. */
export const REVIEW_SINCE = '2026-11-23';
export function patchFaults(files) {
  return files.filter(([f, j]) => !(/^\d{4}-\d{2}-\d{2}/.test(f) && f.slice(0, 10) < REVIEW_SINCE) && !(j?._review?.humanizer === true || /^غير منطبق.{10,}/.test(j?._review?.humanizer ?? ''))).map(([f]) => `${f}: بلا "_review": {"humanizer": true} (أو «غير منطبق: <السبب>» لتعديل بلا نص للقارئ)`);
}

if (process.argv.includes('--selftest')) {
  const now = Date.parse('2026-12-01T12:00:00Z'); const ok = { at: '2026-12-01T11:30:00Z', base: 'https://x.com', urls: 10, checked: 10, errors: 0 };
  const cases = [
    ['شهادة سليمة', certFault(ok, 'https://x.com', now), null],
    ['لا شهادة', !!certFault(null, 'https://x.com', now), true],
    ['شهادة قديمة', !!certFault({ ...ok, at: '2026-12-01T09:00:00Z' }, 'https://x.com', now), true],
    ['شهادة بأخطاء', !!certFault({ ...ok, errors: 2 }, 'https://x.com', now), true],
    ['شهادة جزئية', !!certFault({ ...ok, checked: 3 }, 'https://x.com', now), true],
    ['دومين آخر', !!certFault(ok, 'https://y.com', now), true],
    ['دفعة بإقرار', patchFaults([['a.json', { _review: { humanizer: true } }]]).length, 0],
    ['دفعة بلا إقرار', patchFaults([['a.json', { x: 1 }], ['2026-12-01-b.json', { _review: { humanizer: false } }]]).length, 2],
    ['علامة قالب «غير منطبق» بسبب', patchFaults([['2026-12-01-t.json', { _review: { humanizer: 'غير منطبق: لا نص جديد للقارئ' } }]]).length, 0],
    ['«غير منطبق» بلا سبب', patchFaults([['2026-12-01-t.json', { _review: { humanizer: 'غير منطبق' } }]]).length, 1],
    ['دفعة قبل بدء الشرط', patchFaults([['2026-11-22-batch1.json', { x: 1 }]]).length, 0],
  ];
  let bad = 0; for (const [n, got, want] of cases) { const p = got === want; if (!p) bad++; console.log(`${p ? '✓' : '✗'} ${n}`); }
  console.log(bad ? `✗ ${bad} فشلت` : `✓ ${cases.length} حالات صحيحة`); process.exit(bad ? 1 : 0);
}

const { CONFIG } = await import('./_config.mjs'); // بلا alaa.config.json يرفض هنا (رمز 2): الحزمة لم تُركَّب
const { siteUrl } = await import('./_site-url.mjs');
const run = (f, args = []) => spawnSync(process.execPath, [join(HERE, f), ...args], { encoding: 'utf8', timeout: 900000 });
const rows = []; const add = (name, fault, note = '') => { rows.push([name, fault]); console.log(`${fault ? '✗' : '✓'} ${name}${fault ? ` — ${fault}` : note ? ` · ${note}` : ''}`); };
const last = (s, re) => (s.split('\n').filter((l) => re.test(l)).pop() ?? '').trim();
console.log(`━━ إتمام حزمة علاء على ${siteUrl()} (وضع ${CONFIG.mode})`);

add('ملف الإعداد alaa.config.json', null, `صفحات المحتوى ${CONFIG.contentPattern}`);
const g = run('check-all.mjs'); add('الحرّاس (check-all)', g.status === 0 ? null : last(g.stdout + g.stderr, /✗/) || `رمز ${g.status}`);
const s = run('selftest-checks.mjs'); add('إثبات الفواحص بمخالفات مزروعة (selftest-checks)', s.status === 0 ? null : last(s.stdout, /✗/) || `رمز ${s.status}`, last(s.stdout, /فاحصاً/).slice(0, 90));
const r = run('check-report.mjs'); add('التقرير الاستشاري شُغّل (check-report)', r.status === null ? 'لم يكتمل' : null, 'ملاحظاته تُعرض في تقرير صاحب الموقع ولا تحجب');
const v = existsSync('content-plan/verify-live.json') ? JSON.parse(readFileSync('content-plan/verify-live.json', 'utf8')) : null;
add('التحقق الحي بعد آخر نشر (verify-live)', certFault(v, siteUrl()));
const m = run('index-sitemap.mjs', ['--dry']); add('الخريطة الحية = المحلية (index-sitemap --dry)', m.status === 0 ? null : last(m.stdout + m.stderr, /⛔/) || `رمز ${m.status}`);
const dir = 'content-plan/patches'; const pf = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => { try { return [f, JSON.parse(readFileSync(join(dir, f), 'utf8'))]; } catch { return [f, null]; } }) : [];
const pfl = patchFaults(pf); add('كل دفعة تحسين بإقرار مراجعة humanizer', pfl.length ? pfl.slice(0, 3).join('؛ ') : null, `${pf.length} دفعة`);
// التشابه بحزم: الصفحات المعدّلة أو المنشورة خلال 28 يوماً (دفعات + تواريخ الصفحات) لا تشبه صفحة أخرى في الموقع
// ولا تشارك جملة مع مواقع صاحبه الأخرى. الفاحصان حارسان في check-all أيضاً؛ هنا يُذكر كل منهما بنداً بدليله.
const day = (f) => f.slice(0, 10);
const sim = run('check-similarity.mjs', ['--changed']);
add('لا تشابه داخل الموقع في الصفحات المعدّلة خلال 28 يوماً (check-similarity --changed)', sim.status === 0 ? null : last(sim.stdout, /↔/) || last(sim.stdout + sim.stderr, /✗/) || `رمز ${sim.status}`, last(sim.stdout, /معدّلة خلال 28/).replace(/^.*· /, ''));
const xs = run('check-cross-site-dup.mjs', ['--changed']);
add('لا جملة مشتركة مع مواقع صاحب الموقع الأخرى (check-cross-site-dup --changed)', xs.status === 0 ? null : last(xs.stdout, /^✗/) || last(xs.stdout + xs.stderr, /⚠|صفر/) || `رمز ${xs.status}`, last(xs.stdout, /مواقع مقيسة|غير مفحوص|لا صفحات معدّلة/));
// موجز الناقص: كل صفحة في دفعة منذ بدء القاعدة لها content-plan/briefs/<slug>.md فيه «الناقص في صفحتنا» (serp-brief --page)
const GAP_SINCE = '2026-11-24';
const needBrief = [...new Set(pf.filter(([f, j]) => /^\d{4}-\d{2}-\d{2}/.test(f) && day(f) >= GAP_SINCE && !j?._template).flatMap(([, j]) => Object.keys(j ?? {}).filter((k) => !k.startsWith('_'))).map((k) => k.split('/').pop()))];
const noBrief = needBrief.filter((s) => { const f = `content-plan/briefs/${s}.md`; return !existsSync(f) || !readFileSync(f, 'utf8').includes('الناقص في صفحتنا'); });
add('موجز «الناقص» لكل صفحة في دفعة (serp-brief --page)', noBrief.length ? `${noBrief.length} صفحة بلا موجز: ${noBrief.slice(0, 4).join('، ')}` : null, `${needBrief.length} صفحة`);
const gs = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' });
add('لا تعديلات غير محفوظة في git', gs.status !== 0 ? 'ليس مستودع git' : gs.stdout.trim() ? `${gs.stdout.trim().split('\n').length} ملفاً معدّلاً بلا commit` : null);
if (CONFIG.stateFile) { const { localDay } = await import('./apply-patch.mjs'); const t = existsSync(CONFIG.stateFile) ? readFileSync(CONFIG.stateFile, 'utf8') : '';
  add('سطر اليوم في ملف الحالة (stateFile)', t.includes(localDay()) ? null : `لا ${localDay()} في ${CONFIG.stateFile}`); }

const bad = rows.filter(([, f]) => f);
console.log(bad.length ? `\n✗ غير مكتمل: ${bad.length} من ${rows.length} بنداً ناقصاً. لا تقل «اكتمل» قبل أن يصير هذا الأمر أخضر.` : `\n✓ مكتمل: ${rows.length} من ${rows.length} بنداً. التالي: برومبت «تدقيق-بعد-العمل.md» بوكيل مستقل.`);
process.exit(bad.length ? 1 : 0);
