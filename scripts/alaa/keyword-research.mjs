/**
 * بحث كلمات مجاني من اقتراحات جوجل (Google Autocomplete) — بلا DataForSEO ولا Ahrefs.
 *
 * يوسّع كل بذرة بالبادئات الاستفهامية/التجارية وبحروف الأبجدية (alphabet soup)، ثم يجمّع النتائج
 * في عناقيد مبدئية بتشابه الكلمات. العناقيد **مرشّحة فقط** (NEEDS_SERP_VALIDATION): تُحسم بمقارنة
 * نتائج البحث الفعلية (WebSearch) قبل إنشاء أي صفحة — نيّة واحدة = صفحة مالكة واحدة.
 *
 * لا يعطي حجم بحث (لا مصدر مجاني موثوق له) — لا تخترع أرقامًا. الإشارة المتاحة: الترتيب داخل
 * الاقتراحات + عدد البادئات التي ظهرت معها العبارة (`hits`) كمؤشّر شيوع نسبي.
 *
 * الاستخدام:
 *   node scripts/keyword-research.mjs --lang=ar --gl=jo "دليل سياحي" "مرشد سياحي"
 *   node scripts/keyword-research.mjs --lang=ar --gl=sa --seeds=content-plan/seeds.txt
 *   --require=الاردن,عمان   أبقِ فقط العبارات التي تحوي إحداها (أو التي لا تذكر بلدًا آخر مع --exclude)
 *   --exclude=مصر,المغرب,تركيا   أسقط العبارات التي تحوي إحداها (أسواق أخرى)
 * المخرجات: content-plan/keyword-universe.json + content-plan/keyword-universe.md
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')).map(([k, v]) => [k, v ?? true]));
const LANG = opt.lang || 'ar';
const GL = opt.gl || 'jo';
let seeds = args.filter((a) => !a.startsWith('--'));
if (opt.seeds && existsSync(opt.seeds)) seeds.push(...readFileSync(opt.seeds, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
if (!seeds.length) { console.error('أعطِ بذرة واحدة على الأقل: node scripts/keyword-research.mjs "دليل سياحي"'); process.exit(1); }

const MODS = {
  ar: { pre: ['كيف', 'ما', 'هل', 'كم', 'أين', 'متى', 'أفضل', 'سعر', 'رقم', 'حجز'], post: ['سعر', 'رقم', 'في', 'مع', 'ل', 'افضل', 'كم', 'هل'], letters: 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي' },
  en: { pre: ['how', 'what', 'best', 'cost', 'do i need', 'hire', 'book', 'private'], post: ['price', 'cost', 'near', 'for', 'with', 'vs', 'in'], letters: 'abcdefghijklmnopqrstuvwxyz' },
  ru: { pre: ['как', 'сколько', 'нужен ли', 'лучший', 'цена', 'заказать'], post: ['цена', 'стоимость', 'на', 'для', 'с', 'отзывы'], letters: 'абвгдежзиклмнопрстуфхцчшэюя' },
}[LANG] || { pre: [], post: [], letters: '' };

const listOpt = (v) => (typeof v === 'string' ? v.split(',').map((x) => x.trim()).filter(Boolean) : []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function suggest(q) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=${LANG}&gl=${GL}&q=${encodeURIComponent(q)}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) });
      if (r.status === 429) { await sleep(5000 * (i + 1)); continue; }
      const j = JSON.parse(await r.text());
      return Array.isArray(j[1]) ? j[1] : [];
    } catch { await sleep(1500); }
  }
  return [];
}

const norm = (s) => s.toLowerCase().normalize('NFC').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ًٌٍَُِّْـ]/g, '').replace(/\s+/g, ' ').trim();
const STOP = new Set(['في', 'من', 'على', 'الى', 'إلى', 'مع', 'عن', 'و', 'ال', 'the', 'in', 'for', 'of', 'a', 'to', 'в', 'на', 'с', 'для', 'и']);
const tokens = (s) => norm(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w));

const REQUIRE = listOpt(opt.require).map(norm);
const EXCLUDE = listOpt(opt.exclude).map(norm);
const found = new Map(); // phrase -> { seed, hits, best }
for (const seed of seeds) {
  const queries = [seed, `${seed} `, ...MODS.pre.map((p) => `${p} ${seed}`), ...MODS.post.map((p) => `${seed} ${p}`), ...[...MODS.letters].map((l) => `${seed} ${l}`)];
  process.stdout.write(`→ ${seed} (${queries.length} استعلام) `);
  for (const q of queries) {
    const list = await suggest(q);
    list.forEach((s, i) => {
      const key = norm(s);
      if (!tokens(seed).some((t) => key.includes(t))) return; // خارج الموضوع
      if (EXCLUDE.some((x) => key.includes(x))) return; // سوق آخر
      if (REQUIRE.length && !REQUIRE.some((x) => key.includes(x)) && key !== norm(seed)) return;
      const prev = found.get(key) || { phrase: s, seed, hits: 0, best: 99 };
      prev.hits++; prev.best = Math.min(prev.best, i + 1);
      found.set(key, prev);
    });
    await sleep(120);
    process.stdout.write('.');
  }
  console.log('');
}

// عناقيد مبدئية: تشابه Jaccard ≥ 0.6 على كلمات المعنى
const items = [...found.values()].sort((a, b) => b.hits - a.hits || a.best - b.best);
const clusters = [];
for (const it of items) {
  const t = new Set(tokens(it.phrase));
  const c = clusters.find((cl) => { const h = new Set(tokens(cl.head)); const inter = [...t].filter((x) => h.has(x)).length; return inter / new Set([...t, ...h]).size >= 0.6; });
  if (c) c.members.push(it); else clusters.push({ head: it.phrase, members: [it] });
}

mkdirSync('content-plan', { recursive: true });
writeFileSync('content-plan/keyword-universe.json', JSON.stringify({ lang: LANG, gl: GL, generated: new Date().toISOString().slice(0, 10), seeds, clusters }, null, 2));
let md = `# Keyword universe (${LANG}-${GL}) — Google Autocomplete\n\nمصدر مجاني: اقتراحات جوجل. **لا أحجام بحث** (لا مصدر مجاني موثوق). \`hits\` = عدد الاستعلامات التي ظهرت فيها العبارة (مؤشّر شيوع نسبي فقط).\nالعناقيد مبدئية — **NEEDS_SERP_VALIDATION** قبل إنشاء أي صفحة.\n\n`;
for (const c of clusters) {
  md += `## ${c.head}\n\n| العبارة | hits | أفضل ترتيب |\n|---|---|---|\n${c.members.map((m) => `| ${m.phrase} | ${m.hits} | ${m.best} |`).join('\n')}\n\n`;
}
writeFileSync('content-plan/keyword-universe.md', md);
console.log(`✓ ${items.length} عبارة في ${clusters.length} عنقودًا مبدئيًا → content-plan/keyword-universe.md`);
