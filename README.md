# براءة بيوتي سنتر – الموقع

موقع ثابت بدون أي dependencies.

- التعديل: `build.mjs` (المحتوى والصفحات) و `src/` (CSS/JS)
- البناء: `SITE_URL=https://your-domain node build.mjs` ← الناتج في `docs/`
- النشر: Cloudflare Pages ← build `node build.mjs`, output `docs`، الدومين https://baraabeautycenter.com (الافتراضي في build.mjs). نسخة github.io تحوّل تلقائيًا للدومين.
