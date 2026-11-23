/**
 * دومين الموقع للفواحص: من PUBLIC_SITE_URL، ثم domain في alaa.config.json، ثم SITE.url في src/lib/site.ts، ثم .claude/site.json.
 * فاحص يخمّن دوميناً يفحص موقعاً غير الذي أمامه، فيرمي خطأً إن غابت كلها.
 */
import { readFileSync, existsSync } from 'node:fs';
import { CONFIG } from './_config.mjs';
export function siteUrl() {
  const src = existsSync('src/lib/site.ts') ? readFileSync('src/lib/site.ts', 'utf8').match(/\|\|\s*"(https?:\/\/[^"]+)"/)?.[1] : '';
  const json = existsSync('.claude/site.json') ? JSON.parse(readFileSync('.claude/site.json', 'utf8')).domain : '';
  const url = (process.env.PUBLIC_SITE_URL || CONFIG.domain || src || (json && 'https://' + json) || '').trim().replace(/\/+$/, '');
  if (!url) throw new Error('لا دومين: اضبط "domain" في alaa.config.json أو PUBLIC_SITE_URL');
  return url;
}
