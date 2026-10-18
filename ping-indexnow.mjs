// Run after deployment: node ping-indexnow.mjs
// Submits all site URLs to IndexNow (Bing, Yandex, etc.) for immediate indexing.
import { readFileSync } from 'node:fs';

const SITE = 'https://baraabeautycenter.com';
const KEY = 'f5dd5f7e8e0cbbbe898342bace087e6e';
const KEY_LOCATION = `${SITE}/${KEY}.txt`;

const sitemap = readFileSync('./docs/sitemap.xml', 'utf8');
const urls = [...sitemap.matchAll(/<loc>(https?:\/\/[^<]+)<\/loc>/g)].map(m => m[1]);

console.log(`Submitting ${urls.length} URLs to IndexNow...`);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: 'baraabeautycenter.com', key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
});

console.log(`IndexNow: ${res.status} ${res.statusText}`);
if (res.status === 200) console.log('✅ جميع الصفحات مُرسلة للأرشفة الفورية');
else if (res.status === 202) console.log('✅ مقبول — سيتم فهرسة الصفحات قريباً');
else { const txt = await res.text(); console.log('Response:', txt); }
