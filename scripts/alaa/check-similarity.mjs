/**
 * تشابه الصفحات داخل الموقع نفسه (استشاري): يقرأ نص <main> لكل صفحة محتوى في البناء ويقيس ثلاثة أشياء:
 *   1. جمل مكررة: جملة من 10 كلمات فأكثر تتكرر حرفياً في صفحتين أو أكثر (بعد حذف نص القالب المشترك).
 *   2. محتوى شبه مكرر: تشابه نصي (تقاطع مقاطع من 5 كلمات) ≥ SIM_MAX بين صفحتين.
 *   3. نية متداخلة: أغلب عناوين H2 في الصفحة الأصغر لها نظير في صفحة أخرى، فالصفحتان تجيبان السؤال نفسه.
 * نص القالب (إخلاء المسؤولية، كتل الترشيح…): كل جملة تتكرر في أكثر من خُمس الصفحات تُحذف قبل القياس.
 * يكمّل check-cannibalization (تطابق الكلمة الأساسية والعنوان) وcheck-cross-site-dup (التكرار بين المواقع).
 *   node scripts/check-similarity.mjs
 */
import { pages, main, text, isContent, requireChecked, recentPages, templateCorpus } from './_dist.mjs';
import { CONFIG } from './_config.mjs';
// --changed (حارس في check-all): يفشل فقط إن كانت في الزوج صفحة عُدّلت أو نُشرت خلال آخر 28 يوماً؛ تشابه الصفحات القديمة يُذكر ولا يحجب
const CHANGED = process.argv.includes('--changed');
const SIM_MAX = Number(process.env.SIM_MAX || 0.3), MIN_SENT = 10, SHARED_MIN = 3, H2_SHARE = 0.6;
const norm = (s) => s.toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['في', 'من', 'على', 'عن', 'الى', 'مع', 'او', 'و', 'ما', 'هل', 'كيف', 'كم', 'هو', 'هي', 'the', 'a', 'an', 'of', 'to', 'in', 'and', 'or', 'for', 'is', 'how', 'what']);
// نص الروابط (صناديق «ذات صلة»، قوائم المصادر، «ضمن قسم») ليس كتابة الصفحة، ويُقسم الجمل عنده
// والجداول بيانات مشتركة عن قصد (جدول أسعار واحد يُعرض في عدة صفحات)، لا كتابة مكررة
// ونهاية كل كتلة (فقرة، عنوان، بند…) حدّ جملة، فلا يلتصق عنوان قسم بأول جملة بعده
const strip = (h) => h.replace(/<(nav|aside|header|footer|form|table)[\s\S]*?<\/\1>/g, ' ').replace(/<a[\s>][\s\S]*?<\/a>/g, ' . ').replace(/<\/(p|li|h[1-6]|div|dd|dt|summary|figcaption|blockquote|section|span|strong|b)>|<br\s*\/?>/g, ' . '); // نقطة لا سطر: text() يدمج الأسطر
// نص مكرر عن قصد (إخلاء مسؤولية، تنبيه أسعار): عبارات في similarityAllow بملف الإعداد، والمدقق المستقل يراجعها
const ALLOW = (CONFIG.similarityAllow ?? []).map(norm).filter(Boolean);
const raw = pages(); const RECENT = recentPages(raw);
// الشرط على متن الصفحة لا القالب: جملة مكتوبة في ملف مكوّن أو قالب (components، layouts) لا تُحسب
const TPL = templateCorpus(norm); let fromTpl = 0;
const all = raw.filter((p) => !p.noindex && isContent(p.url)).map((p) => {
  const m = strip(main(p.html));
  const sents = text(m).split(/[.!؟?\n]+|\s[-–—]\s/).map(norm).filter((s) => s.split(' ').length >= MIN_SENT && !ALLOW.some((a) => s.includes(a))).filter((s) => !(TPL.includes(s) && ++fromTpl));
  const h2 = [...m.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((x) => new Set(norm(text(x[1])).split(' ').filter((w) => w.length > 1 && !STOP.has(w)))).filter((s) => s.size);
  return { url: p.url, sents, h2 };
});
// نص القالب: جملة في أكثر من خُمس الصفحات (وفي 3 على الأقل) ليست كتابة صفحة بعينها
const df = new Map(); for (const p of all) for (const s of new Set(p.sents)) df.set(s, (df.get(s) ?? 0) + 1);
const tpl = (s) => df.get(s) > Math.max(2, all.length / 5);
// عناوين القالب («المصادر والمراجع»، «أسئلة شائعة»، «اقرأ أيضاً»): عنوان بنصه في 4 صفحات فأكثر لا يدل على نية
const hk = (h) => [...h].sort().join(' '); const hdf = new Map(); for (const p of all) for (const k of new Set(p.h2.map(hk))) hdf.set(k, (hdf.get(k) ?? 0) + 1);
// وكلمات القالب داخل العناوين («خيارات X»، «مراحل X»، «دلائل عن X»، «الأردن»): كلمة في عناوين أكثر من 10% من الصفحات
// لا تميّز موضوعاً، فتُحذف ويُقارن ما يبقى (موضوع العنوان نفسه)
const wdf = new Map(); for (const p of all) for (const w of new Set(p.h2.flatMap((h) => [...h]))) wdf.set(w, (wdf.get(w) ?? 0) + 1);
for (const p of all) p.h2 = p.h2.filter((h) => hdf.get(hk(h)) < 4).map((h) => new Set([...h].filter((w) => wdf.get(w) <= Math.max(3, all.length / 10)))).filter((h) => h.size);
for (const p of all) {
  p.own = [...new Set(p.sents.filter((s) => !tpl(s)))];
  const w = p.own.join(' ').split(' '); p.sh = new Set(); for (let i = 0; i + 5 <= w.length; i++) p.sh.add(w.slice(i, i + 5).join(' '));
}
const jac = (a, b) => { if (!a.size || !b.size) return 0; let i = 0; const [x, y] = a.size < b.size ? [a, b] : [b, a]; for (const v of x) if (y.has(v)) i++; return i / (a.size + b.size - i); };
const issues = [];
for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
  const a = all[i], b = all[j]; const pair = `${a.url} ↔ ${b.url}`;
  const bs = new Set(b.own); const shared = a.own.filter((s) => bs.has(s));
  if (shared.length >= SHARED_MIN) issues.push(['جمل مكررة', pair, `${shared.length} جملة، مثل «${shared[0].split(' ').slice(0, 9).join(' ')}…»`]);
  const sim = jac(a.sh, b.sh); if (sim >= SIM_MAX) issues.push(['محتوى شبه مكرر', pair, `تشابه ${(sim * 100).toFixed(0)}%`]);
  const [s, l] = a.h2.length <= b.h2.length ? [a, b] : [b, a];
  if (s.h2.length >= 3) { const hit = s.h2.filter((h) => l.h2.some((g) => jac(h, g) >= 0.6)).length; if (hit / s.h2.length >= H2_SHARE) issues.push(['نية متداخلة', pair, `${hit} من ${s.h2.length} عناوين H2 لها نظير`]); }
}
console.log(`صفحات محتوى مفحوصة: ${all.length} · جمل قالب مستبعدة: ${[...df.keys()].filter(tpl).length} · جمل من ملفات القالب: ${fromTpl} · عبارات مسموح تكرارها: ${ALLOW.length}${CHANGED ? ` · معدّلة خلال 28 يوماً: ${all.filter((p) => RECENT.has(p.url)).length}` : ''}`); requireChecked(all.length);
const isNew = ([, pair]) => pair.split(' ↔ ').some((u) => RECENT.has(u));
const hard = CHANGED ? issues.filter(isNew) : issues, old = CHANGED ? issues.filter((x) => !isNew(x)) : [];
const g = {}; for (const [k] of hard) g[k] = (g[k] ?? 0) + 1;
for (const [k, v] of Object.entries(g)) console.log(`  ${v}× ${k}`);
hard.slice(0, process.env.SIM_ALL ? Infinity : 15).forEach(([k, p, d]) => console.log(`    ${k}: ${p} · ${d}`));
if (old.length) console.log(`  ○ ${old.length} زوج قديم في صفحات لم تُعدّل خلال 28 يوماً (لا يحجب؛ يُعالج في دفعة تحسين)`);
console.log(hard.length ? `✗ ${hard.length} زوج صفحات متشابه${CHANGED ? ' فيه صفحة معدّلة حديثاً' : ''}: ادمج، أو فرّق النية، أو أعد كتابة المكرر بكلام يخص كل صفحة` : `✓ لا تشابه${CHANGED ? ' في الصفحات المعدّلة حديثاً' : ' مقلق بين صفحات الموقع'}`);
process.exit(hard.length ? 1 : 0);
