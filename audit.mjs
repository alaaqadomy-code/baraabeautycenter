// Content/schema audit for docs/ (or the live site with --live).
//   SITE_URL=https://baraabeautycenter.com node build.mjs && node audit.mjs
//   node audit.mjs --live        (fetches every sitemap URL from the live domain; encodeURI, no curl)
// Measures: 5-word shingles (Jaccard + containment) for every pair, visible words and body words
// (paragraphs present on >=5 pages removed), hasOfferCatalog carriers, #person @id variants, FAQ stats.
import { readFileSync, existsSync } from 'node:fs';

const LIVE = process.argv.includes('--live');
const SITE = 'https://baraabeautycenter.com';
const OUT = 'docs';

const sitemap = LIVE ? await (await fetch(SITE + '/sitemap.xml')).text() : readFileSync(`${OUT}/sitemap.xml`, 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
const paths = urls.map(u => new URL(u).pathname);

const htmlOf = async p => {
  if (LIVE) { const r = await fetch(encodeURI(SITE + p)); if (!r.ok) throw new Error(`${r.status} ${p}`); return r.text(); }
  const f = `${OUT}${p}index.html`; if (!existsSync(f)) throw new Error('missing ' + f); return readFileSync(f, 'utf8');
};

const decode = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const norm = s => s.normalize('NFC').replace(/[ً-ْـ]/g, '').replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
const BLOCK = /<\/(?:p|h[1-6]|li|summary|blockquote|figcaption|td|th|dt|dd|aside|div|section|article|header|footer|nav|ul|ol|table|tr)>|<br\s*\/?>/gi;
const paras = html => {
  let h = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  h = h.replace(/<head[\s\S]*?<\/head>/i, ' ');
  const mm = h.match(/<main[^>]*>([\s\S]*?)<\/main>/i); if (mm) h = mm[1]; // measure <main> only (header/footer chrome excluded)
  return h.split(BLOCK).map(x => norm(decode(x.replace(/<[^>]+>/g, ' ')))).filter(x => x.length > 0);
};
const shingles = (words, n = 5) => { const s = new Set(); for (let i = 0; i + n <= words.length; i++) s.add(words.slice(i, i + n).join(' ')); return s; };

const pages = [];
for (const p of paths) {
  const html = await htmlOf(p);
  const ps = paras(html);
  const words = ps.flatMap(x => x.split(' '));
  const lds = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const ldText = lds.join('\n');
  const types = new Set([...ldText.matchAll(/"@type":"([^"]+)"/g)].map(m => m[1]));
  const personIds = [...ldText.matchAll(/"@id":"([^"]*#person[^"]*)"/g)].map(m => m[1]);
  // FAQ pairs from JSON-LD
  const faq = [];
  for (const t of lds) { try { const j = JSON.parse(t); const g = j['@graph'] || [j]; for (const n of g) if (n['@type'] === 'FAQPage') for (const q of n.mainEntity) faq.push([q.name, q.acceptedAnswer.text]); } catch { } }
  pages.push({ p, ps, words, sh: shingles(words), offer: /hasOfferCatalog/.test(ldText), service: types.has('Service') && !/hasOfferCatalog/.test('') && /"@type":"Service","name"/.test(ldText) && !p.startsWith('/blog/'), personIds, faq, types, lds });
}

// body: drop paragraphs present on >=5 pages
const freq = new Map();
for (const pg of pages) for (const x of new Set(pg.ps)) freq.set(x, (freq.get(x) || 0) + 1);
for (const pg of pages) { pg.body = pg.ps.filter(x => freq.get(x) < 5); pg.bodyWords = pg.body.reduce((n, x) => n + x.split(' ').length, 0); pg.bodySh = shingles(pg.body.flatMap(x => x.split(' '))); }

const isService = pg => pg.p === '/' || (!pg.p.startsWith('/blog/') && !['/about-baraa/', '/reviews/', '/privacy/', '/terms/'].includes(pg.p));
const res = { pages: pages.length };

// pairs (full text)
const pairs = [];
for (let i = 0; i < pages.length; i++) for (let j = i + 1; j < pages.length; j++) {
  const a = pages[i], b = pages[j]; let inter = 0; const [s, l] = a.sh.size < b.sh.size ? [a.sh, b.sh] : [b.sh, a.sh];
  for (const x of s) if (l.has(x)) inter++;
  if (!inter) continue;
  const jac = inter / (a.sh.size + b.sh.size - inter), cont = inter / Math.min(a.sh.size, b.sh.size);
  pairs.push({ a: a.p, b: b.p, jac: +jac.toFixed(3), cont: +cont.toFixed(3), inter, svcArticle: (isService(a) && b.p.startsWith('/blog/')) || (isService(b) && a.p.startsWith('/blog/')) });
}
pairs.sort((x, y) => y.cont - x.cont);
const WATCH = [['/evening-makeup/', '/blog/evening/'], ['/hair-styling/', '/blog/hair/'], ['/amman-makeup-artist/', '/blog/home-service/'], ['/engagement-makeup/', '/blog/engagement/'], ['/makeup-courses/', '/blog/courses/'], ['/gel-nails/', '/blog/nails/'], ['/hair-color/', '/blog/hair-color-care/'], ['/makeup-artist/', '/blog/evening/']];
console.log('== pages:', pages.length, LIVE ? '(live)' : '(docs/)');
console.log('\n== the 8 audited service/hub pairs (containment, jaccard):');
for (const [a, b] of WATCH) { const pr = pairs.find(x => (x.a === a && x.b === b) || (x.a === b && x.b === a)); console.log(`  ${a} ~ ${b}: cont=${pr ? pr.cont : 0} jac=${pr ? pr.jac : 0}`); }
const badSvc = pairs.filter(x => x.svcArticle && x.cont >= 0.35);
console.log(`\n== service/article pairs with containment >= 0.35: ${badSvc.length}`); badSvc.slice(0, 20).forEach(x => console.log(`  ${x.a} ~ ${x.b}: cont=${x.cont} jac=${x.jac}`));
console.log('\n== top 10 pairs overall:'); pairs.slice(0, 10).forEach(x => console.log(`  ${x.a} ~ ${x.b}: cont=${x.cont} jac=${x.jac}`));

const wc = pages.map(pg => pg.words.length).sort((a, b) => a - b), bw = pages.map(pg => pg.bodyWords).sort((a, b) => a - b);
const q = (arr, f) => arr[Math.floor(arr.length * f)];
console.log(`\n== visible words: min=${wc[0]} median=${q(wc, .5)} max=${wc.at(-1)} | under300=${wc.filter(x => x < 300).length} under600=${wc.filter(x => x < 600).length}`);
console.log(`== body words (paras on >=5 pages removed): min=${bw[0]} median=${q(bw, .5)} max=${bw.at(-1)} | under300=${bw.filter(x => x < 300).length} under400=${bw.filter(x => x < 400).length} under600=${bw.filter(x => x < 600).length}`);
const thin = pages.filter(pg => pg.bodyWords < 400).sort((a, b) => a.bodyWords - b.bodyWords);
console.log(`== pages with body < 400 words: ${thin.length}`); thin.forEach(pg => console.log(`  ${pg.p}: body=${pg.bodyWords} visible=${pg.words.length}`));

const offerPages = pages.filter(pg => pg.offer);
const offerBad = offerPages.filter(pg => !isService(pg));
console.log(`\n== hasOfferCatalog carriers: ${offerPages.length} (outside home/service pages: ${offerBad.length})`); offerBad.slice(0, 10).forEach(pg => console.log('  ' + pg.p));
const personForms = new Set(pages.flatMap(pg => pg.personIds));
console.log(`== #person @id forms: ${personForms.size} ->`, [...personForms]);
// Person definitions: how many distinct property sets define the Person node
const defs = new Map();
const walk = (n, f) => { if (Array.isArray(n)) n.forEach(x => walk(x, f)); else if (n && typeof n === 'object') { f(n); Object.values(n).forEach(v => walk(v, f)); } };
for (const pg of pages) { for (const t of pg.lds) { try { walk(JSON.parse(t), n => { if (n['@type'] === 'Person' && /#person/.test(n['@id'] || '')) { const k = Object.keys(n).join(','); defs.set(k, (defs.get(k) || 0) + 1); } }); } catch { } } }
console.log(`== Person node property-set variants: ${defs.size}`); for (const [k, n] of defs) console.log(`  [${n}] ${k}`);
// FAQ
const all = pages.flatMap(pg => pg.faq.map(([q, a]) => ({ p: pg.p, q: norm(q), a: norm(a), aw: norm(a).split(' ').length })));
const qf = new Map(), af = new Map();
for (const x of all) { qf.set(x.q, (qf.get(x.q) || 0) + 1); af.set(x.a, (af.get(x.a) || 0) + 1); }
console.log(`\n== FAQ: total ${all.length} on ${pages.filter(pg => pg.faq.length).length} pages | answers <25w: ${all.filter(x => x.aw < 25).length} | repeated Q: ${[...qf.values()].filter(n => n > 1).length} | repeated A: ${[...af.values()].filter(n => n > 1).length}`);
for (const [k, n] of qf) if (n > 1) console.log(`  Q x${n}: ${k}`);
for (const [k, n] of af) if (n > 1) console.log(`  A x${n}: ${k.slice(0, 60)}`);

const ok = badSvc.length === 0 && thin.length === 0 && offerBad.length === 0 && personForms.size === 1 && defs.size === 1;
console.log('\n== RESULT:', ok ? 'PASS' : 'FAIL');
process.exitCode = ok ? 0 : 1;
