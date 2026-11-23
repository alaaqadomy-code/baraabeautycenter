/**
 * الفحوص الاستشارية بالتتابع (لا تحجب النشر): كانت `a; b; c` في package.json، وnpm على ويندوز يشغّلها بـ cmd
 * فلا يفهم «;» ولا يعمل أي فاحص (ثغرة 23 نوفمبر 2026). هذا المشغّل يعمل على كل نظام ويطبع ملخصاً بالرموز.
 *   node scripts/check-report.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname as __dn, join as __jn } from 'node:path';
import { fileURLToPath as __fu } from 'node:url';
const HERE = __dn(__fu(import.meta.url));

const CHECKS = ['check-title-desc', 'check-h1-keyword', 'check-internal-links', 'check-cannibalization', 'check-similarity', 'check-page-quality', 'check-touch-targets'];
const sum = [];
for (const c of CHECKS) {
  console.log(`\n━━ ${c}`);
  const r = spawnSync(process.execPath, [__jn(HERE, `${c}.mjs`)], { stdio: 'inherit', timeout: 15 * 60000 });
  sum.push(`${r.status === 0 ? '✓' : r.status === 1 ? '⚠' : '✗'} ${c}${r.status > 1 || r.status === null ? ` (تعطّل: رمز ${r.status})` : ''}`);
}
console.log(`\n━━ الملخص الاستشاري (لا يحجب النشر)\n${sum.join('\n')}`);
// يحجب فقط إن تعطّل فاحص (رمز غير 0 و1)، لأن العطل ليس رأياً استشارياً
process.exit(sum.some((l) => l.startsWith('✗')) ? 2 : 0);
