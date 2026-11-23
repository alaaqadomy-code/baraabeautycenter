/** الروابط والموارد الداخلية في dist: كل href/src يبدأ بـ/ له وجهة (x.html أو x/index.html أو ملف). */
import { pages, DIST, requireChecked } from './_dist.mjs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const files = new Set();
(function walk(d) { for (const e of readdirSync(d)) { const p = join(d, e); statSync(p).isDirectory() ? walk(p) : files.add(p.replace(/\\/g, '/').slice(DIST.length)); } })(DIST);
const exists = (h) => { const c = decodeURIComponent(h.split('#')[0].split('?')[0]); return c === '/' || files.has(c) || files.has(c + '.html') || files.has(c.replace(/\/$/, '') + '/index.html'); };
const all = pages(); const broken = new Map(); let n = 0;
for (const p of all) for (const m of p.html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  const h = m[1]; if (!h.startsWith('/') || h.startsWith('//')) continue; n++;
  if (!exists(h)) { if (!broken.has(h)) broken.set(h, []); broken.get(h).push(p.url); }
}
console.log(`صفحات مفحوصة: ${all.length} · روابط وموارد داخلية: ${n}`);
requireChecked(all.length); requireChecked(n, 'رابط');
for (const [h, u] of broken) console.log(`  ✗ ${decodeURIComponent(h)}  ← ${u.slice(0, 3).join(' ، ')}${u.length > 3 ? ` (+${u.length - 3})` : ''}`);
console.log(broken.size ? `✗ ${broken.size} رابط داخلي مكسور` : '✓ لا رابط داخلي مكسور');
process.exit(broken.size ? 1 : 0);
