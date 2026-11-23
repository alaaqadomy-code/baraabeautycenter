/**
 * الحرّاس العشرة بالتتابع (تحجب النشر): نظير `npm run check:all`، لكنه يعمل من أي مكان ركّبت فيه الحزمة
 * (scripts/ أو scripts/alaa/) وبلا اعتماد على أسماء أوامر npm في الموقع. يتوقف عند أول فاحص أحمر (كـ &&).
 *   node scripts/check-all.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './_config.mjs';
const HERE = dirname(fileURLToPath(import.meta.url));
// التشابه بحزم (قرار علاء 23 نوفمبر 2026): صفحة عُدّلت أو نُشرت خلال 28 يوماً لا تشبه صفحة أخرى في الموقع،
// ولا تشارك جملة واحدة (8 كلمات فأكثر) مع مواقع صاحبه الأخرى. تشابه الصفحات القديمة يُذكر في check-report ولا يحجب.
const GUARDS = ['check-links', 'audit-pages', 'check-faq-schema', 'check-schema-semantics', 'check-claims', 'check-performance', 'check-layout', 'check-similarity --changed', 'check-cross-site-dup --changed'];
for (const g of GUARDS) {
  const [name, ...args] = g.split(' ');
  const r = spawnSync(process.execPath, [join(HERE, `${name}.mjs`), ...args], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`\n✗ check-all: توقف عند ${g} (رمز ${r.status})`); process.exit(r.status || 1); }
}
// الأخطاء العربية على مصادر المحتوى (typosPaths)؛ موقع بلا مصادر نصية (ووردبريس مثلاً) يُذكر صراحة، لا أخضر صامت
const paths = (CONFIG.typosPaths ?? ['src']).filter((p) => existsSync(p));
if (!paths.length) console.log('⚠ check-arabic-typos: لا مصادر نصية في typosPaths لهذا الموقع؛ غير مفحوص (ليس نجاحاً)');
for (const p of paths) {
  const r = spawnSync(process.execPath, [join(HERE, 'check-arabic-typos.mjs'), p, '--quiet'], { stdio: 'inherit' });
  if (r.status !== 0) { console.error(`\n✗ check-all: توقف عند check-arabic-typos ${p}`); process.exit(r.status || 1); }
}
console.log('\n✓ check-all: الحرّاس كلها خضراء');
