/**
 * قراءة Search Console مباشرة بحساب الخدمة (نفس ملف خادم search-console في ~/.claude.json) حين لا يتصل MCP.
 * قراءة: searchanalytics.query. وكتابة واحدة فقط بقرار علاء 22 نوفمبر 2026: إرسال خريطة الموقع (sitemaps.submit)
 * بعد خضرة البوابة، وفحص حالة الفهرسة (قراءة). طلب الفهرسة لرابط بعينه يتم عبر Chrome ببروتوكول خبير الفهرسة من جلسة الحزمة نفسها.
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { homedir } from 'node:os';

function credPath() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const j = JSON.parse(readFileSync(homedir() + '/.claude.json', 'utf8'));
  return j.mcpServers?.['search-console']?.env?.GOOGLE_APPLICATION_CREDENTIALS;
}
// التوكن صالح ساعة: يُحفظ لكل نطاق بدل طلب جديد قبل كل استدعاء (فحص 165 رابطاً كان يطلب 165 توكناً)
const cache = new Map();
async function token(scope = 'https://www.googleapis.com/auth/webmasters.readonly') {
  const hit = cache.get(scope); if (hit && hit.exp > Date.now()) return hit.t;
  const t = await newToken(scope); cache.set(scope, { t, exp: Date.now() + 50 * 60000 }); return t;
}
async function newToken(scope) {
  const c = JSON.parse(readFileSync(credPath(), 'utf8'));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: c.client_email, scope, aud: c.token_uri, iat: now, exp: now + 3600 })}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(c.private_key, 'base64url');
  const r = await fetch(c.token_uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${sig}` });
  if (!r.ok) throw new Error('token: ' + (await r.text()).slice(0, 200));
  return (await r.json()).access_token;
}
/** صفوف [{ keys:[...], clicks, impressions, ctr, position }] لآخر `days` يوماً (تنتهي قبل 3 أيام لتأخر البيانات). */
export async function searchAnalytics(property, { days = 28, dimensions = ['query'], rowLimit = 5000, dimensionFilterGroups } = {}) {
  const t = await token();
  const end = new Date(Date.now() - 3 * 864e5), start = new Date(end - (days - 1) * 864e5);
  const d = (x) => x.toISOString().slice(0, 10);
  const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/searchAnalytics/query`, {
    method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
    body: JSON.stringify({ startDate: d(start), endDate: d(end), dimensions, rowLimit, dimensionFilterGroups }),
  });
  if (!r.ok) throw new Error('searchAnalytics: ' + (await r.text()).slice(0, 300));
  return { startDate: d(start), endDate: d(end), rows: (await r.json()).rows ?? [] };
}

/** إرسال خريطة الموقع إلى Search Console (يحتاج صلاحية مالك/كامل لحساب الخدمة على الخاصية). */
export async function submitSitemap(property, sitemapUrl) {
  const t = await token('https://www.googleapis.com/auth/webmasters');
  const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(sitemapUrl)}`, { method: 'PUT', headers: { authorization: `Bearer ${t}` } });
  if (!r.ok) throw new Error(`sitemaps.submit ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const g = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(sitemapUrl)}`, { headers: { authorization: `Bearer ${t}` } });
  return g.ok ? await g.json() : null;
}

/** حالة فهرسة رابط (URL Inspection API، قراءة فقط، حصة منفصلة 2,000/يوم للخاصية). */
export async function inspectUrl(property, url) {
  const t = await token();
  const r = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, body: JSON.stringify({ inspectionUrl: url, siteUrl: property, languageCode: 'ar' }), signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`urlInspection ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).inspectionResult;
}
