/**
 * موجز منافسين مجاني لكل صفحة قبل كتابتها — بلا أدوات مدفوعة.
 *
 * الخطوة اليدوية (الوكيل): ابحث عن الكلمة الأساسية بأداة WebSearch، وانسخ أول 3–5 نتائج
 * **عضوية** (تجاهل الإعلانات ومنصّات الحجز العملاقة إن لم تكن نفس نوع الصفحة).
 * ثم شغّل:
 *   node scripts/serp-brief.mjs --slug=<slug> --kw="الكلمة" <url1> <url2> <url3>
 *   ولصفحة قائمة (تحسين لا كتابة جديدة): أضف --page=/blog/<slug> فيُكتب قسم «الناقص في صفحتنا»: مواضيع
 *   عناوين المنافسين التي لا تغطيها صفحتنا، وطول صفحتنا مقابل وسيطهم للمعلومة فقط (لا هدف عددي).
 *
 * يجلب كل صفحة ويستخرج: العنوان، H1، عناوين H2/H3، عدد الكلمات، الجداول، الأسئلة الشائعة،
 * أنواع السكيما — ويكتب content-plan/briefs/<slug>.md. مولّد المقالات (gen-article-gemini)
 * يقرأ هذا الملف تلقائيًا ويطلب تغطية **كل** ما يغطيه المنافسون + ما ينقصهم.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split(/=(.*)/s)).map(([k, v]) => [k, v ?? true]));
const urls = args.filter((a) => /^https?:\/\//.test(a));
if (!opt.slug || !urls.length) { console.error('الاستخدام: node scripts/serp-brief.mjs --slug=<slug> --kw="..." <url...>'); process.exit(1); }

const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

async function analyse(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130', 'Accept-Language': 'ar,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(25000) });
    if (!r.ok) return { url, error: `HTTP ${r.status}` };
    const h = await r.text();
    const main = h.match(/<main[\s\S]*?<\/main>/)?.[0] || h.match(/<article[\s\S]*?<\/article>/)?.[0] || h;
    const heads = [...main.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => ({ lvl: +m[1], text: strip(m[2]) })).filter((x) => x.text && x.text.length < 160 && !/^(related|faq|share|comments?|subscribe|menu|contact|categor|tags?|recent posts|.*tourism$|مقالات ذات صلة|منشورات ذات صلة|ذات صلة|اقرأ أيضا|الأسئلة الشائعة|شارك|التعليقات|القائمة|التصنيفات|أحدث المقالات|похожие|комментарии)/i.test(x.text));
    const words = strip(main).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    const schema = [...h.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
    return {
      url,
      title: strip(h.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] || ''),
      words,
      tables: (main.match(/<table/g) || []).length,
      faq: /faq|الأسئلة الشائعة|أسئلة شائعة|частые вопросы/i.test(main),
      schema: [...new Set(schema)].slice(0, 10),
      heads,
    };
  } catch (e) { return { url, error: e.message }; }
}

const res = [];
for (const u of urls) { process.stdout.write(`→ ${u} `); const a = await analyse(u); res.push(a); console.log(a.error ? `✗ ${a.error}` : `✓ ${a.words} كلمة، ${a.heads.length} عنوان`); }
const ok = res.filter((r) => !r.error);
const median = ok.length ? ok.map((r) => r.words).sort((a, b) => a - b)[Math.floor(ok.length / 2)] : 0;

let md = `# موجز المنافسين: ${opt.kw || opt.slug}\n\nتاريخ: ${new Date().toISOString().slice(0, 10)} · صفحات محلّلة: ${ok.length}/${res.length} · وسيط الطول: ${median} كلمة\n\n`;
md += `## ما يجب أن يغطيه المقال (من عناوين المنافسين)\n\n${[...new Set(ok.flatMap((r) => r.heads.filter((x) => x.lvl === 2).map((x) => x.text)))].map((t) => `- ${t}`).join('\n')}\n\n`;
// صفحة قائمة (--page=/blog/x): ما يغطيه المنافسون ولا تغطيه صفحتنا، من البناء. لا هدف عددي للطول
// (Google: عدد الكلمات ليس عامل ترتيب، والكتابة لعدد كلمات إشارة سلبية؛ استشارة مستقلة 23 نوفمبر 2026).
if (opt.page) {
  opt.page = String(opt.page).replace(/^[A-Za-z]:\/Program Files\/Git/, ''); // Git Bash يحوّل «/blog/x» إلى مسار ملف
  const { pages, main: mainOf, text } = await import('./_dist.mjs');
  const pg = pages().find((p) => p.url === opt.page); if (!pg) { console.error(`✗ لا صفحة ${opt.page} في البناء`); process.exit(1); }
  const norm = (s) => s.toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const cw = (s) => norm(s).split(/\s+/).filter((w) => w.length > 2);
  const ours = mainOf(pg.html); const body = new Set(cw(text(ours))); const ourWords = text(ours).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  // موضوع منافس مغطّى إن وردت 70% من كلماته الجوهرية في نص صفحتنا
  const topics = new Map(); for (const r of ok) for (const x of r.heads.filter((h) => h.lvl === 2)) { const k = cw(x.text).sort().join(' '); if (k) topics.set(k, { text: x.text, n: (topics.get(k)?.n ?? 0) + 1 }); }
  const missing = [...topics.entries()].filter(([k]) => { const w = k.split(' '); return w.filter((x) => body.has(x)).length / w.length < 0.7; }).map(([, v]) => v).sort((a, b) => b.n - a.n);
  md += `## الناقص في صفحتنا ${opt.page}\n\n- طول صفحتنا: ${ourWords} كلمة · وسيط المنافسين: ${median} كلمة (للمعلومة فقط، لا هدف).\n- ${missing.length} موضوعاً عند المنافسين لا تغطيه صفحتنا${missing.length ? ' (الأكثر تكراراً أولاً):' : '.'}\n${missing.map((m) => `  - ${m.text}${m.n > 1 ? ` (عند ${m.n} منافسين)` : ''}`).join('\n')}\n\n**أضف الناقص فقط**، وفقط ما يخدم نية «${opt.kw || ''}» ولا تملكه صفحة أخرى في الموقع (\`check-similarity\` و\`check-cannibalization\` بعد البناء). لا توسيع لبلوغ رقم.\n\n`;
  console.log(`صفحتنا ${ourWords} كلمة · وسيط المنافسين ${median} · ناقص: ${missing.length} موضوعاً`);
}
md += `## تعليمات للكاتب\n\n- غطِّ ما ينقص بما يناسب نيّة «${opt.kw || ''}»، ثم أضف ما ينقصهم (تجربة مباشرة، جدول مقارنة، أسئلة حقيقية من العملاء).\n- لا تنسخ صياغاتهم. لا هدف عددي للطول: وسيط أقوى النتائج ${median} كلمة للمعلومة، والطول يحدده استيفاء النية بلا حشو.\n${ok.some((r) => r.faq) ? '- المنافسون يستخدمون أسئلة شائعة — أضف 6–8 أسئلة أفضل.\n' : ''}${ok.some((r) => r.tables) ? '- المنافسون يستخدمون جداول — أضف جدولًا أوضح.\n' : ''}\n`;
for (const r of res) {
  md += `## ${r.url}\n\n`;
  if (r.error) { md += `تعذّر الجلب: ${r.error}\n\n`; continue; }
  md += `- العنوان: ${r.title}\n- الكلمات: ${r.words} · جداول: ${r.tables} · أسئلة شائعة: ${r.faq ? 'نعم' : 'لا'} · سكيما: ${r.schema.join(', ') || '—'}\n\n${r.heads.map((x) => `${'  '.repeat(x.lvl - 1)}- H${x.lvl}: ${x.text}`).join('\n')}\n\n`;
}
mkdirSync('content-plan/briefs', { recursive: true });
writeFileSync(`content-plan/briefs/${opt.slug}.md`, md);
console.log(`✓ content-plan/briefs/${opt.slug}.md (وسيط ${median} كلمة)`);
