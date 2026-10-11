// Static site generator (no deps): node build.mjs  ->  ./docs
import { mkdirSync, writeFileSync, copyFileSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { minify } from './minify.mjs';
import { posts } from './content/blog.mjs';
import { cats } from './content/categories.mjs';
import { reviews } from './content/reviews.mjs';
// attach each post to its cluster; fail loudly on orphans/duplicates
const catBySlug = {};
for (const c of cats) for (const s of c.posts) { if (catBySlug[s]) throw new Error('dup cluster: ' + s); catBySlug[s] = c; }
for (const p of posts) { p.cat = catBySlug[p.slug]; if (!p.cat) throw new Error('post without cluster: ' + p.slug); p.tag = p.cat.name; }
for (const c of cats) c.items = c.posts.map(s => posts.find(p => p.slug === s) || (() => { throw new Error('missing post: ' + s); })());
const catOfPillar = path => cats.filter(c => c.pillar?.[0] === path);
import { createHash } from 'node:crypto';
const ver = f => createHash('md5').update(readFileSync(f)).digest('hex').slice(0, 8); // cache-busting
const V_CSS = ver('src/styles.css'), V_JS = ver('src/main.js');

const SITE = (process.env.SITE_URL || 'https://baraabeautycenter.com').replace(/\/$/, '');
const OUT = 'docs';
const BASE = new URL(SITE).pathname.replace(/\/$/, ''); // '' on custom domain, '/repo' on GitHub project pages
// critical path: CSS inlined (removes the render-blocking request); font URLs made root-absolute
const CSS_INLINE = minify.css(readFileSync('src/fonts.css', 'utf8') + readFileSync('src/styles.css', 'utf8')).replace(/url\(fonts\//g, `url(${BASE}/fonts/`);
const rebase = h => h.replace(/(href|src)="\/(?!\/)/g, `$1="${BASE}/`);
const TODAY = new Date().toISOString().slice(0, 10);
import { execSync } from 'node:child_process';
const gitDate = (...f) => { try { return execSync(`git log -1 --format=%cs -- ${f.join(' ')}`, { encoding: 'utf8' }).trim() || TODAY; } catch { return TODAY; } };
const SITE_UPDATED = gitDate('build.mjs', 'src');

const B = {
  name: 'براءة بيوتي سنتر', nameEn: 'Baraa Beauty Center',
  city: 'الزرقاء', cityEn: 'Zarqa', area: 'ضاحية المدينة المنورة', owner: 'براءة علي',
  phone: '+962796892705', phoneLocal: '0796 892 705',
  phoneHome: '+962790690117', phoneHomeLocal: '0790 690 117',
  waHome: 'https://wa.me/962790690117?text=' + encodeURIComponent('مرحباً، بدي أستفسر عن الخدمة المنزلية من براءة بيوتي سنتر 🌸'),
  wa: 'https://wa.me/962796892705?text=' + encodeURIComponent('مرحباً براءة بيوتي سنتر، بدي أحجز موعد 🌸'),
  fb: 'https://www.facebook.com/Baraabeautycenter/',
  ig: 'https://www.instagram.com/baraa_beauty_center/',
  snap: 'https://www.snapchat.com/@makeup.bybaraa',
  maps: 'https://www.google.com/maps?cid=9717818474838566468', // Google Business Profile
  geo: { lat: 32.0515639, lng: 36.0459091 },
};

// ---------- images (Unsplash CDN, auto AVIF/WebP) ----------
const U = (id, w, h) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ''}&q=70`;
const PH = JSON.parse(readFileSync('src/photos/meta.json', 'utf8'));
// real photos from the salon's Instagram, self-hosted WebP (4:5)
const ph = (name, alt, sizes = '(max-width:900px) 100vw, 50vw', eager = false) => {
  const [w, h] = PH[name];
  const set = [...new Set([400, w])].map(x => `${BASE}/photos/${name}-${x}.webp ${x}w`).join(', ');
  return `<img src="/photos/${name}-${w}.webp" srcset="${set}" sizes="${sizes}" width="${w}" height="${h}" alt="${alt}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
};
const img = (id, alt, opts = {}) => id.startsWith('ph:') ? ph(id.slice(3), alt, opts.sizes, opts.eager) : imgU(id, alt, opts);
const imgU = (id, alt, { ratio = 1.25, sizes = '(max-width:900px) 100vw, 50vw', eager = false, cls = '', widths = [480, 800, 1200] } = {}) => {
  const set = widths.map(w => `${U(id, w, Math.round(w * ratio))} ${w}w`).join(', ');
  const w = widths[1], h = Math.round(w * ratio);
  return `<img src="${U(id, w, h)}" srcset="${set}" sizes="${sizes}" width="${w}" height="${h}" alt="${alt}"${cls ? ` class="${cls}"` : ''} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
};
const P = {
  heroMakeup: 'photo-1636023730877-233b9237d4ec', bride: 'photo-1549416878-b9ca95e26903', blow: 'photo-1580618672591-eb180b1a973f',
  bride2: 'photo-1596092882833-4a5417bc7ac7', bride3: 'photo-1645827042168-4fb0cdd0bf7e',
  mua: 'photo-1709477542149-f4e0e21d590b', mua2: 'photo-1638959882708-9503b1cd595f', brushes: 'photo-1583784561105-a674080f391e', cosmetics: 'photo-1512496015851-a90fb38ba796',
  curl: 'photo-1629397685944-7073f5589754', hair2: 'photo-1634449571017-5fecfd26ad76',
  nails: 'photo-1632345031435-8727f6897d53', nails2: 'photo-1610992015762-45dca7fa3a85',
  facial: 'photo-1570172619644-dfd03ed5d881', lashes: 'photo-1589710751893-f9a6770ad71b',
  salon: 'photo-1637777277435-3c44f82fd0c9', lips: 'photo-1630084775816-7abb7383ded5', palette: 'photo-1596704017254-9b121068fb31',
};

// ---------- icons ----------
const I = {
  wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5 2.5 1 3 .8 3.6.7.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  fb: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 8V6.5c0-.7.2-1.2 1.3-1.2H17V2.2C16.7 2.1 15.6 2 14.4 2 11.9 2 10.2 3.5 10.2 6.3V8H7.5v3.4h2.7V22H14V11.4h2.7l.4-3.4H14z"/></svg>',
  snap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 2.5c3 0 5.2 2.3 5.2 5.3v2.4c.5.2 1.2 0 1.7-.2.6-.2 1.1.6.5 1-.6.5-1.8.8-2 1.4.6 1.7 2 3.4 3.8 3.9.4.1.4.6 0 .8-.7.3-1.6.4-2 .7-.2.3-.1 1-.5 1.2-.6.2-1.6-.3-2.8.1-1 .4-1.9 1.6-3.9 1.6s-2.9-1.2-3.9-1.6c-1.2-.4-2.2.1-2.8-.1-.4-.2-.3-.9-.5-1.2-.4-.3-1.3-.4-2-.7-.4-.2-.4-.7 0-.8 1.8-.5 3.2-2.2 3.8-3.9-.2-.6-1.4-.9-2-1.4-.6-.4-.1-1.2.5-1 .5.2 1.2.4 1.7.2V7.8c0-3 2.2-5.3 5.2-5.3z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/></svg>',
  nav: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 11l18-8-8 18-2-8z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.3-9.2C1.4 7.4 3.7 4 7.2 4c2 0 3.5 1.1 4.8 2.8C13.3 5.1 14.8 4 16.8 4c3.5 0 5.8 3.4 4.5 6.8C19.5 15.4 12 20 12 20z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>',
};

// ---------- services ----------
const services = [
  { t: 'مكياج العرائس', d: 'إطلالة ليلة العمر مع مدام براءة شخصياً: مكياج ثابت، تسريحة وطرحة متكتكة. أكثر من 1000 عروس وثقوا فينا.', img: 'ph:bride-salon', href: '/bridal-makeup/', alt: 'مدام براءة تجهّز عروس في براءة بيوتي سنتر' },
  { t: 'مكياج السهرات والمناسبات', d: 'مكياج احترافي يبرز جمالك الطبيعي، لكل مناسبة إطلالتها.', img: 'ph:hijab-glam', href: '/makeup-artist/', alt: 'مكياج سهرة مع حجاب من أعمال براءة بيوتي سنتر' },
  { t: 'السشوار وتصفيف الشعر', d: 'سشوار وفير وتسريحات ساحرة لجميع المناسبات.', img: P.curl, href: '/makeup-artist/', alt: 'تصفيف الشعر بالمكواة في الصالون' },
  { t: 'عروس الحنّة', d: 'لوك حنّة مميز بألوان دافية وتفاصيل بتليق بليلتك.', img: 'ph:henna-bride', href: '/bridal-makeup/', alt: 'عروس الحنة بالثوب الفلاحي من أعمال براءة بيوتي سنتر' },
  { t: 'تجهيز المرافقات', d: 'مكياج وتسريحات لأهل العروس وصاحباتها بنفس اليوم.', img: 'ph:bride-pearls', href: '/bridal-makeup/', alt: 'عروس بطرحة اللؤلؤ من أعمال براءة بيوتي سنتر' },
  { t: 'دورات المكياج والماستر كلاس', d: 'دورات خاصة وماستر كلاس مع خبيرة المكياج براءة علي.', img: 'ph:turquoise-liner', href: '/makeup-courses/', alt: 'تقنية التركواز تحت العين من دروس براءة علي' },
  { t: 'الخدمة المنزلية الفاخرة', d: 'تجربة الصالون كاملة لعتبة دارك، بنفس الجودة وأعلى معايير التعقيم.', img: 'ph:soft-glam', href: '/home-service/', alt: 'مكياج سوفت جلام من أعمال براءة بيوتي سنتر' },
  { t: 'VIP لعرايس عمّان', d: 'تجهيز عرايس الفستان الأبيض بالبيت أو غرفة الفندق داخل عمّان مع مدام براءة.', img: 'ph:bride-veil', href: '/home-service/', alt: 'عروس بالطرحة من أعمال براءة بيوتي سنتر' },
];

const WORK = [
  ['bride-tiara', 'عروس بتسريحة مرفوعة وتاج فضي', 'عروس · تسريحة مع تاج'],
  ['hijab-black', 'مكياج سهرة ناعم مع حجاب أسود', 'سهرة · حجاب'],
  ['bride-companion', 'عروس ومرافقتها من تجهيز السنتر', 'عروس ومرافقة'],
  ['glow-glam', 'مكياج جلو برونزي مع رموش', 'جلو برونزي'],
  ['hijab-duo', 'مكياج مرافقات مع حجاب أبيض', 'مرافقات'],
  ['bride-bow', 'عروس بلوك ناعم وفيونكة', 'عروس · لوك ناعم'],
  ['waves-glam', 'سهرة مع شعر ويفي طويل', 'سهرة · ويفي'],
  ['hijab-pink', 'مكياج طبيعي مع حجاب وردي', 'لوك ناعم · حجاب'],
  ['bride-pearls', 'عروس بطرحة اللؤلؤ ومكياج ناعم', 'عروس · طرحة لؤلؤ'],
  ['cateye-glam', 'مكياج آيلاينر مجنّح مع حجاب', 'آيلاينر مجنّح'],
  ['henna-bride', 'عروس الحنة بالثوب المطرّز', 'عروس الحنّة'],
  ['bride-salon', 'مدام براءة تلبّس العروس التاج في السنتر', 'تجهيز العروس بالسنتر'],
  ['soft-glam', 'مكياج سوفت جلام مع كونتور ناعم', 'سوفت جلام'],
  ['bride-veil', 'عروس بالطرحة والفيونكة', 'عروس · لوك ناعم'],
  ['turquoise-liner', 'تركواز تحت العين بلمسة براءة', 'تركواز تحت العين'],
  ['hijab-glam', 'مكياج سهرة مع حجاب أبيض', 'سهرة · حجاب'],
  ['natural-glam', 'مكياج طبيعي من فريق السنتر', 'لوك طبيعي'],
];

// ---------- client reviews (verbatim, content/reviews.mjs) ----------
const revCard = r => `<figure class="rev" data-reveal><blockquote>${r.t}</blockquote><figcaption>${r.svc ? `<b>${r.svc}</b>` : ''}<span>${r.i ? `${r.i}. · ` : ''}عبر ${r.via} · ${r.date.slice(0, 4)}</span></figcaption></figure>`;
const REV_HOME = [2, 18, 16, 1, 6, 22].map(i => reviews[i]).filter(Boolean);
const revSec = (list, more = true) => `<section class="sec" aria-labelledby="rev-h"><div class="wrap">
  <div class="sec__head center" data-reveal><span class="eyebrow">آراء زبوناتنا</span><h2 id="rev-h">كلامهن، مش كلامنا</h2><p class="muted">رسائل حقيقية من زبونات السنتر، منقولة بالحرف من <a href="${B.ig}" target="_blank" rel="noopener" style="color:var(--gold-2)">هايلايت "فيد باك" على إنستغرام</a> وتوصيات فيسبوك.</p></div>
  <div class="revs">${list.map(revCard).join('')}</div>
  ${more ? `<p style="text-align:center;margin-top:36px"><a class="btn btn--ghost" href="/reviews/">كل الآراء (${reviews.length}) ${I.arrow}</a> <a class="btn btn--ghost" href="${B.maps}" target="_blank" rel="noopener">تقييمات جوجل</a></p>` : ''}
</div></section>`;

// ---------- FAQ banks ----------
const faqHome = [
  ['وين موقع براءة بيوتي سنتر؟', `براءة بيوتي سنتر في ${B.city}، ${B.area}، الأردن. رقم السنتر ${B.phoneLocal}.`],
  ['كيف بحجز موعد؟', `اتصلي على رقم السنتر ${B.phoneLocal}، أو راسلينا على إنستغرام. للخدمة المنزلية: ${B.phoneHomeLocal} (اتصال أو واتساب). المواعيد محدودة شهرياً، فاحجزي بدري.`],
  ['هل في خدمة منزلية؟', `نعم، خدمة تجميل منزلية فاخرة تشمل السشوار وتصفيف الشعر والمكياج. وخدمة تجهيز عرايس الفستان الأبيض بالبيت أو الفندق مخصصة لعرايس عمّان. رقم الخدمة المنزلية ${B.phoneHomeLocal}.`],
  ['شو الخدمات اللي بتقدموها؟', 'مكياج عرائس وعروس الحنّة، مكياج سهرات ومناسبات، سشوار وتسريحات، تجهيز المرافقات، خدمة منزلية وفندقية، ودورات مكياج خاصة وماستر كلاس.'],
  ['مين خبيرة المكياج في السنتر؟', `${B.owner}، خبيرة مكياج جمّلت أكثر من 1000 عروس، وبتقدّم دورات خاصة وماستر كلاس.`],
];
const faqBridal = [
  ['متى لازم أحجز مكياج العرس؟', 'المواعيد متوفرة بأعداد محدودة شهرياً، فننصحك تحجزي بدري خصوصاً بموسم الأعراس.'],
  ['هل مدام براءة بتعمل مكياج العروس بنفسها؟', 'نعم، مكياج عرايس الفستان الأبيض مع مدام براءة شخصياً.'],
  ['هل بتجوا عالبيت أو الفندق يوم العرس؟', `نعم، خدمة تجهيز العروس بالبيت أو غرفة الفندق متوفرة لعرايس عمّان (فستان أبيض). وبالزرقاء تشرفينا بالسنتر في ${B.area}.`],
  ['هل بتجهزوا أهل العروس وصاحباتها؟', 'أكيد، في خدمة للعروس والمرافقات بنفس اليوم.'],
  ['هل في لوك لعروس الحنّة؟', 'نعم، نجهّز عروس الحنّة بلوك خاص بيناسب أجواء الليلة.'],
];
const faqMua = [
  ['شو أنواع المكياج اللي بتعملوها؟', 'مكياج سهرات ومناسبات، خطوبة، حنّة وعرائس، بستايل يبرز جمالك الطبيعي.'],
  ['هل بتعملوا سشوار وتسريحات كمان؟', 'نعم، سشوار وفير وتصفيف شعر لجميع المناسبات، بالسنتر أو بالبيت.'],
  ['هل بتستخدموا منتجات أصلية؟', 'نستخدم أرقى مواد التجميل العالمية مع التزام تام بمعايير التعقيم.'],
  ['وين السنتر؟', `في ${B.city}، ${B.area}. رقم السنتر ${B.phoneLocal}.`],
];
const faqHomeSvc = [
  ['شو بتشمل الخدمة المنزلية؟', 'سشوار وفير وتصفيف شعر لجميع المناسبات، ومكياج احترافي، وتجهيز عرايس الأبيض مع مدام براءة شخصياً.'],
  ['هل خدمة العرايس بالبيت أو الفندق متوفرة بكل المناطق؟', 'خدمة تجهيز عرايس الفستان الأبيض بالبيت والفندق مخصصة لعرايس عمّان.'],
  ['كيف بحجز الخدمة المنزلية؟', `اتصلي أو راسلينا واتساب على ${B.phoneHomeLocal}. المواعيد محدودة شهرياً.`],
  ['هل الأدوات معقّمة؟', 'نعم، نلتزم بأعلى معايير التعقيم والاحترافية ونستخدم أرقى مواد التجميل العالمية.'],
];
const faqCourses = [
  ['شو نوع الدورات اللي بتقدموها؟', `دورات مكياج خاصة (Private courses) وماستر كلاس مع خبيرة المكياج ${B.owner}.`],
  ['وين بتكون الدورات؟', `في براءة بيوتي سنتر، ${B.city}، ${B.area}.`],
  ['كيف بعرف المواعيد والأسعار؟', `تواصلي معنا على ${B.phoneLocal} أو برسالة على إنستغرام، ونرسلك تفاصيل الدورة الجاية.`],
];

// ---------- partials ----------
const nav = cur => {
  const items = [['/', 'الرئيسية'], ['/bridal-makeup/', 'مكياج العرائس'], ['/makeup-artist/', 'ميك أب آرتست'], ['/home-service/', 'خدمة منزلية'], ['/makeup-courses/', 'الدورات'], ['/blog/', 'المدونة']];
  return items.map(([h, t]) => `<a href="${h}"${h === cur ? ' aria-current="page"' : ''}>${t}</a>`).join('');
};
const header = cur => `<a class="skip" href="#main">انتقلي إلى المحتوى</a>
<header class="hdr"><div class="wrap hdr__in">
  <a class="logo" href="/" aria-label="${B.name} – الصفحة الرئيسية"><b>براءة</b><span>بيوتي سنتر<small>BEAUTY CENTER</small></span></a>
  <button class="burger" aria-label="القائمة" aria-expanded="false" aria-controls="nav"><span></span><span></span><span></span></button>
  <nav class="nav" id="nav" aria-label="القائمة الرئيسية">${nav(cur)}<a class="btn" href="${B.wa}" target="_blank" rel="noopener">${I.wa}احجزي الآن</a></nav>
</div></header>`;

const footer = () => `<footer class="ftr"><div class="wrap">
  <div class="ftr__grid">
    <div>
      <a class="logo" href="/"><b>براءة</b><span>بيوتي سنتر<small>BEAUTY CENTER</small></span></a>
      <p class="muted" style="margin-top:16px;max-width:38ch">صالون تجميل نسائي في ${B.city}، ${B.area}. مكياج عرائس وسهرات، سشوار وتسريحات، خدمة منزلية ودورات مكياج.</p>
      <div class="socials">
        <a href="${B.ig}" target="_blank" rel="noopener" aria-label="إنستغرام">${I.ig}</a>
        <a href="${B.fb}" target="_blank" rel="noopener" aria-label="فيسبوك">${I.fb}</a>
        <a href="${B.snap}" target="_blank" rel="noopener" aria-label="سناب شات">${I.snap}</a>
        <a href="${B.wa}" target="_blank" rel="noopener" aria-label="واتساب">${I.wa}</a>
      </div>
    </div>
    <div><h3>خدماتنا</h3><ul>
      <li><a href="/bridal-makeup/">مكياج العرائس في ${B.city}</a></li>
      <li><a href="/makeup-artist/">ميك أب آرتست في ${B.city}</a></li>
      <li><a href="/home-service/">خدمة تجميل منزلية</a></li>
      <li><a href="/engagement-makeup/">مكياج خطوبة في ${B.city}</a></li>
      <li><a href="/reviews/">آراء الزبونات</a></li>
      <li><a href="/makeup-courses/">دورات المكياج</a></li>
      <li><a href="/blog/">مدونة التجميل</a></li>
      <li><a href="/about-baraa/">عن ${B.owner}</a></li>
    </ul></div>
    <div><h3>تواصلي معنا</h3><ul>
      <li>السنتر: <a href="tel:${B.phone}" dir="ltr">${B.phoneLocal}</a></li>
      <li>الخدمة المنزلية: <a href="tel:${B.phoneHome}" dir="ltr">${B.phoneHomeLocal}</a></li>
      <li><a href="${B.waHome}" target="_blank" rel="noopener">واتساب الخدمة المنزلية</a></li>
      <li><a href="${B.maps}" target="_blank" rel="noopener">${B.city}، ${B.area}</a></li>
    </ul></div>
  </div>
  <div class="ftr__bottom"><span>© <span id="y">${new Date().getFullYear()}</span> ${B.name} · ${B.nameEn}</span><span>صُنع بحب في الأردن</span></div>
</div></footer>
<button class="fab fab--map" type="button" aria-haspopup="dialog" aria-controls="mapsheet" aria-label="موقع السنتر على الخريطة">${I.pin}<span class="fab__tip">موقعنا</span></button>
<a class="fab" href="${B.wa}" target="_blank" rel="noopener" aria-label="احجزي عبر واتساب">${I.wa}</a>
<dialog class="mapsheet" id="mapsheet" aria-labelledby="map-h">
  <div class="mapsheet__card">
    <button class="mapsheet__x" type="button" aria-label="إغلاق">${I.close}</button>
    <div class="mapsheet__map"><iframe title="خريطة موقع ${B.name}" data-src="https://maps.google.com/maps?q=${B.geo.lat},${B.geo.lng}&hl=ar&z=16&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
    <div class="mapsheet__body">
      <span class="eyebrow">زورينا</span>
      <h2 id="map-h">${B.name}</h2>
      <p class="muted">${B.city}، ${B.area} · يفتح الساعة 10:00 صباحاً</p>
      <div class="hero__cta">
        <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${B.geo.lat},${B.geo.lng}" target="_blank" rel="noopener">${I.nav}الاتجاهات</a>
        <a class="btn btn--ghost" href="${B.maps}" target="_blank" rel="noopener">${I.pin}خرائط جوجل</a>
      </div>
    </div>
  </div>
</dialog>`;

const ctas = (light = false) => `<div class="hero__cta">
  <a class="btn" href="${B.wa}" target="_blank" rel="noopener">${I.wa}احجزي عبر واتساب</a>
  <a class="btn btn--ghost" href="tel:${B.phone}">${I.phone}<span dir="ltr">${B.phoneLocal}</span></a>
</div>`;

const words = (txt, shineFrom = 99) => txt.split(' ').map((w, i) => `<span class="word"><span style="--i:${i}"${i >= shineFrom ? ' class="shine"' : ''}>${w}</span></span>`).join(' ');

const fmtDate = d => new Date(d).toLocaleDateString('ar-JO', { year: 'numeric', month: 'long', day: 'numeric' });
const postCard = (p, i = 0) => `<a class="pcard" href="/blog/${p.slug}/" data-reveal style="--d:${i % 3}">
  <div class="pcard__img">${ph(p.cover, p.title, '(max-width:700px) 100vw, 33vw')}</div>
  <div class="pcard__body"><span class="tag">${p.tag}</span><h3>${p.title}</h3><p>${p.desc}</p><span class="pcard__more">اقرئي المقال ${I.arrow}</span></div></a>`;

const faqBlock = (items, title = 'أسئلة شائعة') => `<section class="sec sec--light" id="faq" aria-labelledby="faq-h">
  <div class="wrap">
    <div class="sec__head center" data-reveal><span class="eyebrow">إجابات سريعة</span><h2 id="faq-h">${title}</h2></div>
    <div class="faq">${items.map(([q, a], i) => `<details data-reveal style="--d:${i}"${i === 0 ? ' open' : ''}><summary>${q}</summary><div class="ans"><p>${a}</p></div></details>`).join('')}</div>
  </div></section>`;

const ctaBlock = (h = 'جاهزة لإطلالتك الجاية؟', p = 'احجزي موعدك الآن، وخلّي الباقي علينا.') => `<section class="sec"><div class="wrap">
  <div class="cta" data-reveal="clip">${img(P.cosmetics, '', { ratio: .5, sizes: '100vw', widths: [800, 1400, 2000] })}
    <span class="eyebrow">${B.name}</span><h2>${h}</h2><p class="muted" style="max-width:46ch;margin-inline:auto">${p}</p>${ctas()}
  </div></div></section>`;

// ---------- schema ----------
const salonId = `${SITE}/#salon`;
const personId = `${SITE}/about-baraa/#person`;
const salonLD = {
  '@type': 'BeautySalon', '@id': salonId,
  name: B.name, alternateName: B.nameEn, url: SITE + '/',
  image: [U(P.salon, 1200, 630), ...WORK.slice(0, 4).map(([n]) => `${SITE}/photos/${n}-${PH[n][0]}.webp`)], logo: `${SITE}/favicon.svg`,
  telephone: B.phone, priceRange: '$$', hasMap: B.maps,
  geo: { '@type': 'GeoCoordinates', latitude: B.geo.lat, longitude: B.geo.lng },
  address: { '@type': 'PostalAddress', streetAddress: B.area, addressLocality: B.city, addressRegion: 'محافظة الزرقاء', addressCountry: 'JO' },
  areaServed: [{ '@type': 'City', name: B.city }, { '@type': 'City', name: 'عمّان' }],
  sameAs: [B.fb, B.ig, B.snap, B.maps],
  founder: { '@type': 'Person', '@id': personId, url: `${SITE}/about-baraa/`, name: B.owner, alternateName: "Bara'a Ali", jobTitle: 'خبيرة مكياج', sameAs: [B.ig, B.snap] },
  contactPoint: [{ '@type': 'ContactPoint', telephone: B.phone, contactType: 'reservations', name: 'رقم السنتر' }, { '@type': 'ContactPoint', telephone: B.phoneHome, contactType: 'reservations', name: 'الخدمة المنزلية' }],
  knowsLanguage: ['ar'],
  hasOfferCatalog: { '@type': 'OfferCatalog', name: 'خدمات التجميل', itemListElement: services.map(s => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.t, description: s.d } })) },
};
const ld = (path, extra = []) => {
  const graph = [
    { '@type': 'WebSite', '@id': `${SITE}/#website`, url: SITE + '/', name: B.name, inLanguage: 'ar-JO', publisher: { '@id': salonId } },
    salonLD, ...extra,
  ];
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
};
const faqLD = items => ({ '@type': 'FAQPage', mainEntity: items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
const crumbLD = list => ({ '@type': 'BreadcrumbList', itemListElement: list.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: SITE + u })) });
const serviceLD = (name, desc, path) => ({ '@type': 'Service', name, description: desc, serviceType: name, provider: { '@id': salonId }, areaServed: { '@type': 'City', name: B.city }, url: SITE + path });

// ---------- page shell ----------
const page = ({ path, title, desc, ogImg, ogAbs, lcp, preload = '', body, schema = [] }) => `<!doctype html>
<html lang="ar-JO" dir="rtl">
<head>
<meta charset="utf-8">
<script>if(location.hostname.endsWith('github.io'))location.replace('https://baraabeautycenter.com'+location.pathname.replace('/baraa-beauty-center','')+location.search+location.hash)</script>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${SITE}${path}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#120a0f">
<meta name="geo.region" content="JO-AZ"><meta name="geo.placename" content="${B.city}"><meta name="geo.position" content="${B.geo.lat};${B.geo.lng}"><meta name="ICBM" content="${B.geo.lat}, ${B.geo.lng}">
<meta property="og:type" content="website"><meta property="og:locale" content="ar_JO"><meta property="og:site_name" content="${B.name}">
<meta property="og:title" content="${title}"><meta property="og:description" content="${desc}">
<meta property="og:url" content="${SITE}${path}"><meta property="og:image" content="${ogAbs || U(ogImg, 1200, 630)}">
${ogAbs ? '' : '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'}
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://images.unsplash.com" crossorigin>
<link rel="preload" href="/fonts/ibm-plex-sans-arabic-400-arabic.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/el-messiri-500-arabic.woff2" as="font" type="font/woff2" crossorigin>
${lcp ? `<link rel="preload" as="image" media="(max-width:900px)" imagesrcset="${U(lcp, 640, 1024)} 640w, ${U(lcp, 1080, 1728)} 1080w" imagesizes="100vw" fetchpriority="high">
<link rel="preload" as="image" media="(min-width:901px)" imagesrcset="${U(lcp, 1600, 992)} 1600w, ${U(lcp, 2200, 1364)} 2200w" imagesizes="100vw" fetchpriority="high">` : ''}
${preload}<style>${CSS_INLINE}</style>
${ld(path, schema)}
</head>
<body>
${header(path)}
<main id="main">${body}</main>
${footer()}
<script src="/main.js?v=${V_JS}" defer></script>
</body>
</html>`;

// hero image: portrait crop on phones, landscape on desktop (art direction via <picture>)
const heroImg = (id, alt, active, eager) => `<picture>
  <source media="(max-width:900px)" srcset="${U(id, 640, 1024)} 640w, ${U(id, 1080, 1728)} 1080w" sizes="100vw">
  <img src="${U(id, 1600, 992)}" srcset="${U(id, 1600, 992)} 1600w, ${U(id, 2200, 1364)} 2200w" sizes="100vw" width="1600" height="992" alt="${alt}"${active ? ' class="is-active"' : ''} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
</picture>`;
const heroMedia = slides => `<div class="hero__media">${slides.map(([id, alt], i) => heroImg(id, alt, i === 0, i === 0)).join('')}</div>`;

// ---------- HOME ----------
const home = page({
  path: '/', ogImg: P.heroMakeup, ogAbs: `${SITE}/photos/hero-d.webp`,
  preload: `<link rel="preload" as="image" media="(max-width:900px)" href="/photos/hero-m.webp" fetchpriority="high">
<link rel="preload" as="image" media="(min-width:901px)" imagesrcset="${BASE}/photos/hero-d-640.webp 640w, ${BASE}/photos/hero-d.webp 1320w" imagesizes="62vw" fetchpriority="high">
`,
  title: `${B.name} | صالون تجميل وميك أب آرتست في ${B.city}`,
  desc: `${B.name} في ${B.city} (${B.area}): مكياج عرائس مع خبيرة المكياج ${B.owner}، أكثر من 1000 عروس، سهرات، سشوار وتسريحات، خدمة منزلية وVIP لعرايس عمّان. ${B.phoneLocal}`,
  schema: [faqLD(faqHome)],
  body: `
<section class="hero" aria-labelledby="h1">
  <div class="hero__media hero__media--feature"><picture>
    <source media="(max-width:900px)" srcset="${BASE}/photos/hero-m.webp" width="793" height="1102">
    <img src="/photos/hero-d.webp" srcset="${BASE}/photos/hero-d-640.webp 640w, ${BASE}/photos/hero-d.webp 1320w" sizes="62vw" width="1320" height="1102" alt="خبيرة المكياج في براءة بيوتي سنتر تضع المكياج لعروس" class="is-active" fetchpriority="high" decoding="async">
  </picture></div>
  <div class="wrap">
    <span class="eyebrow">صالون تجميل نسائي · ${B.city}، الأردن</span>
    <h1 id="h1">${words('جمالكِ يبدأ بلمسة براءة', 3)}</h1>
    <p class="hero__lead">مع خبيرة المكياج براءة علي: مكياج عرائس وسهرات، سشوار وتسريحات، خدمة منزلية وفندقية. أكثر من 1000 عروس طلعوا من عنّا ملكات.</p>
    ${ctas()}
    <div class="hero__chips"><span class="chip">💍 +1000 عروس</span><span class="chip">VIP لعرايس عمّان</span><span class="chip">خدمة منزلية</span><span class="chip">🎓 دورات وماستر كلاس</span></div>
  </div>
  <span class="scroll-cue" aria-hidden="true"></span>
</section>

<div class="marquee-wrap"><div class="marquee" aria-hidden="true"><div class="marquee__track">${[0, 1].map(() => `<span>مكياج عرائس</span><span>عروس الحنّة</span><span>سشوار وتسريحات</span><span>خدمة منزلية</span><span>VIP عرايس عمّان</span><span>ماستر كلاس</span><span>+1000 عروس</span>`).join('')}</div></div></div>

<section class="sec sec--light" id="services" aria-labelledby="srv-h">
  <div class="wrap">
    <div class="sec__head" data-reveal><span class="eyebrow">خدماتنا</span><h2 id="srv-h">كل اللي بتحتاجيه لإطلالة كاملة، تحت سقف واحد</h2>
    <p class="muted">من أول لمسة مكياج لآخر دبوس بالطرحة، فريق براءة بيوتي سنتر يهتم بكل تفصيلة.</p></div>
    <div class="bento">${services.map((s, i) => `<a class="card c-${i + 1}" href="${s.href}" data-reveal style="--d:${i % 3}">
      ${img(s.img, s.alt, { ratio: i === 0 ? 1.1 : 1.25, sizes: i === 0 ? '(max-width:900px) 100vw, 60vw' : '(max-width:560px) 100vw, (max-width:900px) 50vw, 40vw' })}
      <span class="card__num">0${i + 1}</span><span class="card__arrow">${I.arrow}</span>
      <div class="card__body"><h3>${s.t}</h3><p>${s.d}</p></div></a>`).join('')}</div>
  </div>
</section>

<section class="sec sec--plum" aria-labelledby="story-h">
  <div class="wrap">
    <div class="sec__head" data-reveal><span class="eyebrow">رحلة العروس</span><h2 id="story-h">من أول رسالة… لآخر صورة بالعرس</h2></div>
    <div class="story">
      <div class="story__media">
        ${img(P.palette, 'اختيار ألوان المكياج المناسبة للعروس', { ratio: 1.25 })}
        ${img(P.mua, 'جلسة تجربة مكياج العروس', { ratio: 1.25 })}
        ${img('ph:bride-pearls', 'عروس بطرحة اللؤلؤ من أعمال براءة بيوتي سنتر')}
      </div>
      <div>
        <div class="step" data-step="0"><span class="step__n">01</span><h3>استشارة واختيار الستايل</h3><p class="muted">ابعتيلنا صورة الفستان والستايل اللي بتحبيه، ونقترح عليكِ الألوان والتسريحة اللي بتناسب ملامحك ولون بشرتك.</p></div>
        <div class="step" data-step="1"><span class="step__n">02</span><h3>جلسة التجربة</h3><p class="muted">نجرّب الإطلالة قبل العرس ونعدّل لحد ما تحسّي إنها إنتِ، بس بأحلى نسخة.</p></div>
        <div class="step" data-step="2"><span class="step__n">03</span><h3>يوم العرس</h3><p class="muted">بالسنتر بالزرقاء، أو ببيتك وغرفتك بالفندق إذا كنتِ عروس بعمّان. مكياج ثابت لآخر الليل، وتسريحة وطرحة متكتكة.</p><p><a class="btn" href="/bridal-makeup/">باقات العرائس ${I.arrow}</a></p></div>
      </div>
    </div>
  </div>
</section>

<section class="sec" aria-labelledby="home-h">
  <div class="wrap split split--rev">
    <div data-reveal>
      <span class="eyebrow">خدمة تجميل منزلية</span>
      <h2 id="home-h" style="font-size:clamp(2rem,4.4vw,3.4rem)">الصالون بيجي لعندك</h2>
      <p class="muted">دلالكِ يوصلكِ وين ما كنتِ: سشوار وتسريحات ومكياج احترافي بنفس جودة السنتر، وعرايس الأبيض بعمّان مع مدام براءة شخصياً بالبيت أو الفندق.</p>
      <ul class="ticks"><li>سشوار وفير وتصفيف شعر لجميع المناسبات</li><li>أرقى مواد التجميل العالمية وأعلى معايير التعقيم</li><li>رقم الخدمة المنزلية: <a href="tel:${B.phoneHome}" dir="ltr">${B.phoneHomeLocal}</a></li></ul>
      <a class="btn" href="/home-service/">تفاصيل الخدمة المنزلية ${I.arrow}</a>
    </div>
    <div class="split__img" data-reveal="clip">${img(P.mua2, 'خبيرة مكياج تجهّز عميلة في منزلها')}
      <div class="split__badge"><b>VIP لعرايس عمّان</b>بالبيت أو غرفة الفندق</div></div>
  </div>
</section>

<section class="sec sec--plum" id="work" aria-labelledby="gal-h">
  <div class="wrap">
    <div class="sec__head center" data-reveal><span class="eyebrow">من أعمالنا</span><h2 id="gal-h">إطلالات حقيقية من براءة بيوتي سنتر</h2><p class="muted">كل صورة هون من شغل مدام براءة وفريق السنتر. المزيد على <a href="${B.ig}" target="_blank" rel="noopener" style="color:var(--gold-2)">إنستغرام</a>.</p></div>
    <div class="gallery">${WORK.slice(0, 12).map(([n, alt, cap]) => `<figure>${ph(n, alt, '(max-width:600px) 100vw, 33vw')}<figcaption>${cap}</figcaption></figure>`).join('')}</div>
    <p style="text-align:center;margin-top:40px"><a class="btn btn--ghost" href="${B.ig}" target="_blank" rel="noopener">${I.ig}شوفي كل أعمالنا</a></p>
  </div>
</section>

${revSec(REV_HOME)}

<section class="sec sec--light" aria-labelledby="why-h">
  <div class="wrap">
    <div class="sec__head center" data-reveal><span class="eyebrow">ليش براءة؟</span><h2 id="why-h">لأن إطلالتك تستاهل الأفضل</h2></div>
    <div class="feats">
      <div class="feat" data-reveal style="--d:0">${I.crown}<h3>+1000 عروس</h3><p>أكثر من ألف عروس جمّلتهم براءة علي بإطلالات فخمة وناعمة.</p></div>
      <div class="feat" data-reveal style="--d:1">${I.shield}<h3>نظافة وتعقيم</h3><p>أدوات معقّمة لكل عميلة ومنتجات احترافية أصلية.</p></div>
      <div class="feat" data-reveal style="--d:2">${I.home}<h3>بيت وفندق</h3><p>خدمة منزلية فاخرة، وVIP لعرايس عمّان بالبيت أو الفندق.</p></div>
      <div class="feat" data-reveal style="--d:3">${I.sparkle}<h3>خبيرة بتعلّم</h3><p>دورات خاصة وماستر كلاس، لأن الخبرة الحقيقية بتنقال.</p></div>
    </div>
  </div>
</section>

${faqBlock(faqHome)}
<section class="sec"><div class="wrap"><div class="sec__head" data-reveal><span class="eyebrow">من المدونة</span><h2>نصائح من خبيرة عرائس</h2></div><div class="pgrid">${posts.slice(0, 3).map(postCard).join('')}</div><p style="text-align:center;margin-top:36px"><a class="btn btn--ghost" href="/blog/">كل المقالات ${I.arrow}</a> <a class="btn btn--ghost" href="/blog/zarqa-salons/">دليل صالونات الزرقاء ${I.arrow}</a></p></div></section>
${ctaBlock()}`,
});

// ---------- landing page factory ----------
const clusterSec = path => catOfPillar(path).map(c => `<section class="sec"><div class="wrap"><div class="sec__head" data-reveal><span class="eyebrow">من المدونة</span><h2>${c.h1}</h2></div>
<div class="pgrid">${c.items.slice(0, 6).map(postCard).join('')}</div><p style="text-align:center;margin-top:36px"><a class="btn btn--ghost" href="/blog/${c.slug}/">كل مقالات ${c.name} ${I.arrow}</a></p></div></section>`).join('');

const landing = ({ path, crumb, title, desc, h1, h1Shine, eyebrow, lead, hero, ogImg, sections, faq, service }) => page({
  path, title, desc, lcp: hero, ogImg: ogImg || hero,
  schema: [serviceLD(crumb, desc, path), faqLD(faq), crumbLD([['الرئيسية', '/'], [crumb, path]])],
  body: `
<section class="hero hero--page" aria-labelledby="h1">
  ${heroMedia([[hero, h1]])}
  <div class="wrap">
    <nav class="crumbs" aria-label="مسار التنقل"><ol><li><a href="/">الرئيسية</a></li><li aria-current="page">${crumb}</li></ol></nav>
    <span class="eyebrow">${eyebrow}</span>
    <h1 id="h1">${words(h1, h1Shine)}</h1>
    <p class="hero__lead">${lead}</p>
    ${ctas()}
  </div>
</section>
${sections}
${clusterSec(path)}
${faqBlock(faq, `أسئلة شائعة عن ${crumb}`)}
${ctaBlock()}`,
});

const feats = list => `<div class="feats">${list.map(([ic, t, p], i) => `<div class="feat" data-reveal style="--d:${i}">${I[ic]}<h3>${t}</h3><p>${p}</p></div>`).join('')}</div>`;
const splitSec = ({ eyebrow, h, p, ticks, imgId, alt, rev = false, plum = false, badge, wa }) => `<section class="sec${plum ? ' sec--plum' : ''}"><div class="wrap split${rev ? ' split--rev' : ''}">
  ${rev ? '' : `<div class="split__img" data-reveal="clip">${img(imgId, alt)}${badge ? `<div class="split__badge">${badge}</div>` : ''}</div>`}
  <div data-reveal><span class="eyebrow">${eyebrow}</span><h2 style="font-size:clamp(1.9rem,4vw,3.1rem)">${h}</h2><p class="muted">${p}</p>
  <ul class="ticks">${ticks.map(t => `<li>${t}</li>`).join('')}</ul><a class="btn" href="${wa || B.wa}" target="_blank" rel="noopener">${I.wa}اسألينا على واتساب</a></div>
  ${rev ? `<div class="split__img" data-reveal="clip">${img(imgId, alt)}${badge ? `<div class="split__badge">${badge}</div>` : ''}</div>` : ''}
</div></section>`;

const bridal = landing({
  path: '/bridal-makeup/', crumb: 'مكياج العرائس', hero: P.bride,
  title: `مكياج عرايس في ${B.city} | ${B.name}`,
  desc: `مكياج عرايس في ${B.city} مع مدام ${B.owner} شخصياً، أكثر من 1000 عروس. تسريحة وطرحة، عروس الحنّة، والمرافقات، وخدمة بالبيت أو الفندق لعرايس عمّان.`,
  eyebrow: `مكياج عرايس · ${B.city}`, h1: 'إطلالة ليلة العمر بتوقيع براءة', h1Shine: 3,
  lead: 'مكياج احترافي وثابت مع مدام براءة شخصياً، تسريحة وطرحة متكتكة، بدون توتر ولا عجقة طريق. بالسنتر بالزرقاء، أو بالبيت والفندق لعرايس عمّان.',
  faq: faqBridal,
  sections: `
<section class="sec sec--light"><div class="wrap">
  <div class="sec__head" data-reveal><span class="eyebrow">باقة العروس</span><h2>كل تفصيلة محسوبة ليومك</h2><p class="muted">نشتغل معك خطوة بخطوة من الاستشارة لحد آخر صورة.</p></div>
  ${feats([['crown', 'مع مدام براءة', 'مكياج عرايس الأبيض بإيد خبيرة المكياج براءة علي شخصياً.'], ['heart', 'تسريحة وطرحة', 'تسريحة ثابتة وطرحة متكتكة طول الليل.'], ['sparkle', 'عروس الحنّة', 'لوك خاص لليلة الحنّة.'], ['home', 'بيت أو فندق', 'لعرايس عمّان: نوصلك لباب بيتك أو غرفتك بالفندق.']])}
</div></section>
${splitSec({ eyebrow: 'VIP لعرايس عمّان', h: 'يومك الكبير بروقان وراحة', p: 'خدمة تجهيز عرايس الفستان الأبيض بتوصلك لغاية باب بيتك أو غرفتك بالفندق داخل عمّان، مع مدام براءة.', ticks: ['ميك أب احترافي وثابت', 'تسريحة وطرحة متكتكة', 'أعداد محدودة شهرياً، احجزي بدري'], imgId: 'ph:bride-veil', alt: 'عروس بالطرحة من أعمال مدام براءة', plum: true, badge: '<b>بيت أو فندق</b>داخل عمّان' })}
${splitSec({ eyebrow: 'العروس والمرافقات', h: 'جهّزي أهلك وصاحباتك معك', p: `خدمة العرايس والمرافقات بالسنتر في ${B.city}، ${B.area}.`, ticks: ['مكياج وتسريحات للمرافقات', 'أجواء حلوة ومريحة مع فريق السنتر', `رقم السنتر: ${B.phoneLocal}`], imgId: 'ph:bride-salon', alt: 'مدام براءة تجهّز العروس في السنتر', rev: true })}`,
});

const mua = landing({
  path: '/makeup-artist/', crumb: 'ميك أب آرتست', hero: P.mua,
  title: `ميك أب آرتست في ${B.city} | مكياج سهرات ومناسبات – ${B.name}`,
  desc: `ميك أب آرتست في ${B.city}: ${B.owner}، خبيرة مكياج بأكثر من 1000 عروس. مكياج سهرات ومناسبات، سشوار وتسريحات بالسنتر أو بالبيت. ${B.phoneLocal}`,
  eyebrow: `ميك أب آرتست · ${B.city}`, h1: 'مكياج يحكي عنكِ قبل ما تحكي', h1Shine: 2,
  lead: 'مكياج احترافي يبرز جمالك الطبيعي، بإيد فريق براءة بيوتي سنتر وخبيرة المكياج براءة علي.',
  faq: faqMua,
  sections: `
<section class="sec sec--light"><div class="wrap">
  <div class="sec__head" data-reveal><span class="eyebrow">ستايلات المكياج</span><h2>لكل مناسبة إطلالتها</h2></div>
  ${feats([['sparkle', 'سهرات ومناسبات', 'إطلالة بتلفت النظر بكل مناسبة.'], ['crown', 'عرائس', 'مع مدام براءة شخصياً.'], ['heart', 'عروس الحنّة', 'لوك دافي ومميز لليلة الحنّة.'], ['home', 'بالبيت', 'نفس جودة السنتر لعتبة دارك.']])}
</div></section>
${splitSec({ eyebrow: 'منتجات وأدوات', h: 'منتجات احترافية وأدوات معقّمة', p: 'نستخدم أرقى مواد التجميل العالمية مع التزام تام بأعلى معايير التعقيم والاحترافية.', ticks: ['مواد تجميل عالمية', 'أدوات معقّمة لكل عميلة', 'مكياج ثابت طول المناسبة'], imgId: P.brushes, alt: 'فراشي مكياج احترافية', plum: true })}
${splitSec({ eyebrow: 'تسريحات', h: 'كمّلي الإطلالة بتسريحة', p: 'سشوار وفير وتصفيف شعر ساحر لجميع المناسبات.', ticks: ['تسريحات سهرة وعرائس', 'سشوار وفير', 'بالسنتر أو بالبيت'], imgId: P.curl, alt: 'تسريحة شعر بالمكواة', rev: true })}`,
});

const homeSvc = landing({
  path: '/home-service/', crumb: 'خدمة تجميل منزلية', hero: P.mua2,
  title: `خدمة تجميل منزلية | مكياج وسشوار بالبيت وعرايس عمّان VIP – ${B.name}`,
  desc: `خدمة تجميل منزلية فاخرة من ${B.name}: سشوار وتسريحات ومكياج احترافي، وتجهيز عرايس الأبيض بالبيت أو الفندق في عمّان مع مدام براءة. ${B.phoneHomeLocal}`,
  eyebrow: 'خدمة منزلية وفندقية', h1: 'دلالكِ يوصلكِ وين ما كنتِ', h1Shine: 2,
  lead: 'أرقى تجارب الصالون وخبرات خبيراتنا مباشرة لعتبة داركِ، بنفس الجودة وأعلى معايير التعقيم. للحجز: 0790 690 117 (اتصال أو واتساب).',
  faq: faqHomeSvc,
  sections: `
<section class="sec sec--light"><div class="wrap">
  <div class="sec__head" data-reveal><span class="eyebrow">كيف بتشتغل الخدمة؟</span><h2>ثلاث خطوات وبنكون عندك</h2></div>
  ${feats([['wa', 'تواصلي معنا', `اتصلي أو راسلينا واتساب على ${B.phoneHomeLocal}.`], ['clock', 'نأكد الموعد', 'المواعيد محدودة شهرياً، فاحجزي بدري.'], ['home', 'بنوصل لعندك', 'لبيتك، أو لغرفتك بالفندق لعرايس عمّان.']])}
</div></section>
${splitSec({ eyebrow: 'شو بنقدّم بالبيت؟', h: 'تجربة الصالون كاملة', p: 'لا داعي للانتظار أو عناء الطريق.', ticks: ['سشوار وفير وتصفيف شعر لجميع المناسبات', 'ميك أب احترافي يبرز جمالك الطبيعي', 'عرايس الأبيض مع مدام براءة شخصياً'], imgId: P.hair2, alt: 'تسريحة شعر في المنزل', plum: true, wa: B.waHome, badge: '<b>VIP</b>عرايس عمّان: بيت أو فندق' })}`,
});

const faqEngage = [
  ['شو أحسن مكياج للخطوبة؟', 'السوفت جلام هو الأكثر طلباً للخطوبة، والناعم أنسب للخطوبة العائلية النهارية، والجلام الكامل لحفلات القاعات بالليل.'],
  ['وين أعمل مكياج خطوبة بالزرقاء؟', `في ${B.name}، ${B.city} ${B.area}. رقم السنتر ${B.phoneLocal}.`],
  ['هل بتجوا عالبيت للخطوبة؟', `نعم، الخدمة المنزلية تشمل المكياج والسشوار والتسريحات. للحجز ${B.phoneHomeLocal}.`],
];
const engageDef = () => landing({
  path: '/engagement-makeup/', crumb: 'مكياج خطوبة', hero: P.mua,
  title: `مكياج خطوبة في ${B.city} | سوفت جلام وتسريحات – ${B.name}`,
  desc: `مكياج خطوبة في ${B.city}: ناعم أو سوفت جلام أو جلام كامل، مع تسريحة أو لفة حجاب، بالسنتر في ${B.area} أو بالبيت. احجزي ${B.phoneLocal}.`,
  eyebrow: `مكياج خطوبة · ${B.city}`, h1: 'إطلالة خطوبة بتسرق الأنظار', h1Shine: 2,
  lead: 'من الناعم للجلام الكامل: مكياج خطوبة متنسّق مع فستانك وحجابك وإضاءة الحفلة، بإيد فريق براءة بيوتي سنتر.',
  faq: faqEngage,
  sections: `
<section class="sec sec--light"><div class="wrap">
  <div class="sec__head" data-reveal><span class="eyebrow">اختاري لوكك</span><h2>ثلاث ستايلات للخطوبة</h2></div>
  ${feats([['heart', 'ناعم', 'للخطوبة العائلية والنهارية: بشرة مشرقة ولمسة طبيعية.'], ['sparkle', 'سوفت جلام', 'الأكثر طلباً: بيطلع حلو بالصور وبالحقيقة.'], ['crown', 'جلام كامل', 'لحفلات القاعات بالليل: عيون قوية وإطلالة فخمة.']])}
</div></section>
${splitSec({ eyebrow: 'مع الحجاب أو التسريحة', h: 'إطلالة متكاملة', p: 'بنخطط المكياج مع التسريحة أو لفة الحجاب كقطعة وحدة.', ticks: ['تنسيق مع لون الفستان والحجاب', 'تثبيت يدوم طول الحفلة', 'بالسنتر أو بالبيت'], imgId: 'ph:soft-glam', alt: 'مكياج سوفت جلام للخطوبة من أعمال براءة بيوتي سنتر', plum: true })}`,
});

const courses = landing({
  path: '/makeup-courses/', crumb: 'دورات المكياج', hero: P.palette,
  title: `دورة مكياج في ${B.city} | دورات خاصة وماستر كلاس مع ${B.owner}`,
  desc: `دورات مكياج خاصة وماستر كلاس في ${B.city} مع خبيرة المكياج ${B.owner}، صاحبة خبرة بأكثر من 1000 عروس. تواصلي على ${B.phoneLocal}.`,
  eyebrow: `دورات مكياج · ${B.city}`, h1: 'تعلّمي المكياج من خبيرة', h1Shine: 2,
  lead: `دورات خاصة وماستر كلاس مع ${B.owner}، خبرة أكثر من 1000 عروس بين إيديكِ.`,
  faq: faqCourses,
  sections: `
<section class="sec sec--light"><div class="wrap">
  <div class="sec__head" data-reveal><span class="eyebrow">نوعين من التعلّم</span><h2>اختاري الطريقة اللي بتناسبك</h2></div>
  ${feats([['crown', 'دورة خاصة', 'تدريب فردي مع براءة علي حسب مستواكِ وهدفك.'], ['sparkle', 'ماستر كلاس', 'جلسة مكثفة على تقنيات وستايلات محددة.']])}
</div></section>
${splitSec({ eyebrow: 'ليش مع براءة؟', h: 'خبرة حقيقية من آلاف الإطلالات', p: 'تعلّمي من خبيرة اشتغلت مع أكثر من 1000 عروس.', ticks: ['تطبيق عملي', 'أسرار الثبات والتسريحة والطرحة', `السنتر في ${B.city}، ${B.area}`], imgId: 'ph:turquoise-liner', alt: 'تقنية التركواز تحت العين من أعمال براءة علي', plum: true })}`,
});

// ---------- BLOG ----------
const blogIndex = page({
  path: '/blog/', ogImg: P.cosmetics,
  title: `مدونة التجميل | نصائح مكياج وعرائس في الزرقاء وعمّان – ${B.name}`,
  desc: `مدونة ${B.name}: أدلة ونصائح عن مكياج العرايس، اختيار أفضل صالون في الزرقاء، الخدمة المنزلية في عمّان، ودورات المكياج في الأردن.`,
  schema: [{ '@type': 'Blog', '@id': `${SITE}/blog/#blog`, name: `مدونة ${B.name}`, url: `${SITE}/blog/`, inLanguage: 'ar-JO', publisher: { '@id': salonId },
    blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}/`, datePublished: p.date })) },
    crumbLD([['الرئيسية', '/'], ['المدونة', '/blog/']])],
  body: `
<section class="hero hero--blog"><div class="wrap">
  <nav class="crumbs" aria-label="مسار التنقل"><ol><li><a href="/">الرئيسية</a></li><li aria-current="page">المدونة</li></ol></nav>
  <span class="eyebrow">مدونة براءة</span><h1>${words('أسرار الجمال من خبيرة عرائس', 2)}</h1>
  <p class="hero__lead">أدلة ونصائح عملية عن المكياج والعرائس والتسريحات، من خبرة أكثر من 1000 عروس.</p>
</div></section>
<section class="sec sec--light" style="padding-top:60px"><div class="wrap">
<nav class="catnav" aria-label="تصنيفات المدونة">${cats.map(c => `<a href="/blog/${c.slug}/">${c.name} <small>${c.items.length}</small></a>`).join('')}</nav>
${cats.map(c => `<section class="catsec" aria-labelledby="c-${c.slug}"><div class="catsec__head"><h2 id="c-${c.slug}">${c.name}</h2><a href="/blog/${c.slug}/">كل المقالات ${I.arrow}</a></div>
<div class="pgrid">${c.items.slice(0, 3).map(postCard).join('')}</div></section>`).join('')}
</div></section>
${ctaBlock()}`,
});

const postPage = p => {
  const related = [...p.cat.items.filter(x => x !== p), ...posts.filter(x => x.cat !== p.cat)].slice(0, 3);
  const path = `/blog/${p.slug}/`;
  return page({
    path, ogImg: P.cosmetics, title: `${p.title} | ${B.name}`, desc: p.desc,
    ogAbs: `${SITE}/photos/${p.cover}-${PH[p.cover][0]}.webp`,
    schema: [{ '@type': 'BlogPosting', '@id': `${SITE}${path}#post`, headline: p.title, description: p.summary || p.desc, inLanguage: 'ar-JO',
      datePublished: p.date, dateModified: p.updated || p.date, keywords: p.keywords.join('، '), articleSection: p.tag,
      image: `${SITE}/photos/${p.cover}-${PH[p.cover][0]}.webp`, mainEntityOfPage: `${SITE}${path}`,
      author: { '@type': 'Person', '@id': personId, name: B.owner, jobTitle: 'خبيرة مكياج', url: `${SITE}/about-baraa/` }, publisher: { '@id': salonId } },
      faqLD(p.faq), crumbLD([['الرئيسية', '/'], ['المدونة', '/blog/'], [p.cat.name, `/blog/${p.cat.slug}/`], [p.title, path]])],
    body: `
<article>
<header class="hero hero--blog"><div class="wrap">
  <nav class="crumbs" aria-label="مسار التنقل"><ol><li><a href="/">الرئيسية</a></li><li><a href="/blog/">المدونة</a></li><li><a href="/blog/${p.cat.slug}/">${p.cat.name}</a></li><li aria-current="page">${p.title}</li></ol></nav>
  <a class="eyebrow" href="/blog/${p.cat.slug}/">${p.cat.name}</a>
  <h1 class="post-h1">${p.title}</h1>
  <p class="post-meta">بقلم <a href="/about-baraa/"><b>${B.owner}</b></a>، خبيرة مكياج · <time datetime="${p.date}">${fmtDate(p.date)}</time></p>
</div></header>
<div class="sec sec--light post"><div class="wrap post__grid">
  <figure class="post__cover">${ph(p.cover, p.title, '(max-width:900px) 100vw, 380px', true)}</figure>
  <div class="prose">${p.summary ? `<aside class="tldr" aria-label="الجواب المختصر"><b>الجواب المختصر</b><p>${p.summary}</p></aside>` : ''}${p.body}
    <h2>أسئلة شائعة</h2>
    ${p.faq.map(([q, a]) => `<h3>${q}</h3><p>${a}</p>`).join('')}
    <aside class="guide"><b>هذا المقال جزء من دليل: <a href="/blog/${p.cat.slug}/">${p.cat.h1}</a></b>${p.cat.pillar ? `<p>للحجز وتفاصيل الخدمة: <a href="${p.cat.pillar[0]}">${p.cat.pillar[1]}</a></p>` : ''}
      <ul>${p.cat.items.filter(x => x !== p).map(x => `<li><a href="/blog/${x.slug}/">${x.title}</a></li>`).join('')}</ul></aside>
    <div class="post__cta"><b>جاهزة تحجزي؟</b> ${ctas()}</div>
  </div>
</div></div>
</article>
<section class="sec sec--plum"><div class="wrap">
  <div class="sec__head" data-reveal><span class="eyebrow">اقرئي كمان</span><h2>مقالات ممكن تعجبك</h2></div>
  <div class="pgrid">${related.map(postCard).join('')}</div>
</div></section>`,
  });
};

const hubPage = c => {
  const path = `/blog/${c.slug}/`;
  return page({
    path, ogImg: P.cosmetics, title: `${c.h1} | مدونة ${B.name}`, desc: c.intro.slice(0, 155),
    ogAbs: `${SITE}/photos/${c.items[0].cover}-${PH[c.items[0].cover][0]}.webp`,
    schema: [{ '@type': 'CollectionPage', '@id': `${SITE}${path}#hub`, name: c.h1, description: c.intro, url: `${SITE}${path}`, inLanguage: 'ar-JO',
      isPartOf: { '@id': `${SITE}/blog/#blog` }, about: c.name, ...(c.pillar ? { relatedLink: SITE + c.pillar[0] } : {}),
      mainEntity: { '@type': 'ItemList', numberOfItems: c.items.length, itemListElement: c.items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/blog/${p.slug}/`, name: p.title })) } },
      crumbLD([['الرئيسية', '/'], ['المدونة', '/blog/'], [c.name, path]])],
    body: `
<section class="hero hero--blog"><div class="wrap">
  <nav class="crumbs" aria-label="مسار التنقل"><ol><li><a href="/">الرئيسية</a></li><li><a href="/blog/">المدونة</a></li><li aria-current="page">${c.name}</li></ol></nav>
  <span class="eyebrow">${c.name} · ${c.items.length} مقالات</span><h1>${words(c.h1, 2)}</h1>
  <p class="hero__lead">${c.intro}</p>
  ${c.pillar ? `<p class="hero__cta"><a class="btn" href="${c.pillar[0]}">${c.pillar[1]} ${I.arrow}</a></p>` : ''}
</div></section>
<section class="sec sec--light" style="padding-top:60px"><div class="wrap">
<nav class="catnav" aria-label="تصنيفات المدونة">${cats.map(x => `<a href="/blog/${x.slug}/"${x === c ? ' aria-current="page"' : ''}>${x.name} <small>${x.items.length}</small></a>`).join('')}</nav>
<div class="pgrid">${c.items.map(postCard).join('')}</div></div></section>
${ctaBlock()}`,
  });
};

const about = page({
  path: '/about-baraa/', ogImg: P.cosmetics, ogAbs: `${SITE}/photos/bride-pearls-${PH['bride-pearls'][0]}.webp`,
  title: `${B.owner} | خبيرة مكياج عرائس في ${B.city} – ${B.name}`,
  desc: `تعرّفي على ${B.owner}، خبيرة مكياج العرائس وصاحبة ${B.name} في ${B.city}، ${B.area}. أكثر من 1000 عروس، ودورات مكياج خاصة وماستر كلاس.`,
  schema: [{ '@type': 'ProfilePage', '@id': `${SITE}/about-baraa/#page`, url: `${SITE}/about-baraa/`, inLanguage: 'ar-JO', mainEntity: {
      '@type': 'Person', '@id': personId, name: B.owner, alternateName: "Bara'a Ali", jobTitle: 'خبيرة مكياج عرائس', url: `${SITE}/about-baraa/`,
      image: `${SITE}/photos/bride-pearls-${PH['bride-pearls'][0]}.webp`, worksFor: { '@id': salonId },
      workLocation: { '@type': 'Place', name: `${B.area}، ${B.city}` }, sameAs: [B.ig, B.snap],
      knowsAbout: ['مكياج العرائس', 'مكياج عروس الحنّة', 'مكياج السهرات', 'مكياج المحجبات', 'تسريحات العرائس مع الطرحة', 'تعليم المكياج'] } },
    crumbLD([['الرئيسية', '/'], [`عن ${B.owner}`, '/about-baraa/']])],
  body: `
<section class="hero hero--blog"><div class="wrap">
  <nav class="crumbs" aria-label="مسار التنقل"><ol><li><a href="/">الرئيسية</a></li><li aria-current="page">عن ${B.owner}</li></ol></nav>
  <span class="eyebrow">خبيرة مكياج · ${B.city}</span><h1>${words(B.owner + ' خبيرة العرائس', 1)}</h1>
  <p class="hero__lead">صاحبة ${B.name} في ${B.area}، وإيدها كانت بإطلالة أكثر من 1000 عروس.</p>
</div></section>
${splitSec({ eyebrow: 'مين براءة؟', h: 'خبرة بتبان بالتفاصيل', p: `${B.owner} خبيرة مكياج عرائس وصاحبة ${B.name} في ${B.city}. بتشتغل بنفسها على العرايس بالسنتر، وبتجهّز عرايس عمّان بالبيت أو الفندق، وبتعلّم المكياج بدورات خاصة وماستر كلاس.`, ticks: ['أكثر من 1000 عروس', 'مكياج عرائس وعروس الحنّة والمرافقات', 'سهرات وسشوار وتسريحات مع الطرحة', 'دورات خاصة وماستر كلاس'], imgId: 'ph:bride-pearls', alt: `مكياج عروس من أعمال ${B.owner}` })}
<section class="sec sec--light"><div class="wrap">
  <div class="sec__head" data-reveal><span class="eyebrow">من أعمالها</span><h2>إطلالات بتحكي عن الشغل</h2></div>
  <div class="gallery">${WORK.slice(0, 6).map(([n, alt, cap]) => `<figure>${ph(n, alt, '(max-width:600px) 100vw, 33vw')}<figcaption>${cap}</figcaption></figure>`).join('')}</div>
</div></section>
<section class="sec"><div class="wrap">
  <div class="sec__head" data-reveal><span class="eyebrow">بقلم ${B.owner}</span><h2>أدلة من خبرتها</h2></div>
  <nav class="catnav" aria-label="تصنيفات المدونة">${cats.map(c => `<a href="/blog/${c.slug}/">${c.name} <small>${c.items.length}</small></a>`).join('')}</nav>
  <div class="pgrid">${cats.map(c => c.items[0]).slice(0, 6).map(postCard).join('')}</div>
</div></section>
${ctaBlock()}`,
});

const reviewsPage = page({
  path: '/reviews/', ogImg: P.cosmetics, ogAbs: `${SITE}/photos/bride-tiara-${PH['bride-tiara'][0]}.webp`,
  title: `آراء الزبونات | ${B.name} – ${B.city}`,
  desc: `${reviews.length} رأي حقيقي من زبونات ${B.name} في ${B.city} عن المكياج والتسريحات والأظافر والعرايس، منقولة بالحرف من إنستغرام وفيسبوك.`,
  schema: [crumbLD([['الرئيسية', '/'], ['آراء الزبونات', '/reviews/']])],
  body: `
<section class="hero hero--blog"><div class="wrap">
  <nav class="crumbs" aria-label="مسار التنقل"><ol><li><a href="/">الرئيسية</a></li><li aria-current="page">آراء الزبونات</li></ol></nav>
  <span class="eyebrow">${reviews.length} رأي حقيقي</span><h1>${words('شو بيحكوا عن براءة', 2)}</h1>
  <p class="hero__lead">رسائل وصلتنا من زبونات السنتر بعد المكياج والتسريحات والأظافر، منشورة كما هي بدون تعديل.</p>
</div></section>
${revSec(reviews, false)}
<section class="sec sec--light"><div class="wrap" style="text-align:center">
  <h2>جرّبتي براءة؟</h2><p class="muted">رأيك بيفرق معنا ومع العرايس الجايات. اكتبيلنا تقييم على جوجل.</p>
  <p style="margin-top:24px"><a class="btn" href="${B.maps}" target="_blank" rel="noopener">قيّمينا على جوجل</a></p>
</div></section>
${ctaBlock()}`,
});

const notFound = page({
  path: '/404.html', ogImg: P.cosmetics, title: `الصفحة غير موجودة | ${B.name}`, desc: 'الصفحة المطلوبة غير موجودة.',
  body: `<section class="hero hero--page"><div class="wrap"><span class="eyebrow">404</span><h1>${words('الصفحة مش موجودة', 2)}</h1><p class="hero__lead">يمكن الرابط تغيّر. ارجعي للرئيسية أو احجزي مباشرة.</p><div class="hero__cta"><a class="btn" href="/">الرئيسية</a></div></div></section>`,
}).replace('index,follow', 'noindex');

// ---------- write ----------
rmSync(OUT, { recursive: true, force: true });
const engage = engageDef();
const pages = { '/': home, '/bridal-makeup/': bridal, '/makeup-artist/': mua, '/home-service/': homeSvc, '/makeup-courses/': courses, '/engagement-makeup/': engage, '/blog/': blogIndex, '/about-baraa/': about, '/reviews/': reviewsPage, ...Object.fromEntries(cats.map(c => [`/blog/${c.slug}/`, hubPage(c)])), ...Object.fromEntries(posts.map(p => [`/blog/${p.slug}/`, postPage(p)])) };
for (const [p, html] of Object.entries(pages)) {
  mkdirSync(OUT + p, { recursive: true });
  writeFileSync(`${OUT}${p}index.html`, minify.html(rebase(html)));
}
writeFileSync(`${OUT}/404.html`, minify.html(rebase(notFound)));
writeFileSync(`${OUT}/styles.css`, minify.css(readFileSync('src/fonts.css', 'utf8') + readFileSync('src/styles.css', 'utf8')));
copyFileSync('src/main.js', `${OUT}/main.js`);
copyFileSync('src/favicon.svg', `${OUT}/favicon.svg`);
mkdirSync(`${OUT}/fonts`, { recursive: true });
for (const f of readdirSync('src/fonts')) copyFileSync(`src/fonts/${f}`, `${OUT}/fonts/${f}`);
mkdirSync(`${OUT}/photos`, { recursive: true });
for (const f of readdirSync('src/photos').filter(f => f.endsWith('.webp'))) copyFileSync(`src/photos/${f}`, `${OUT}/photos/${f}`);
writeFileSync(`${OUT}/.nojekyll`, '');
// Cloudflare Pages headers (ignored by GitHub Pages)
writeFileSync(`${OUT}/_headers`, `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/photos/*
  Cache-Control: public, max-age=2592000
/styles.css
  Cache-Control: public, max-age=31536000, immutable
/main.js
  Cache-Control: public, max-age=31536000, immutable
`);
writeFileSync(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
const maxDate = list => list.map(p => p.updated || p.date).sort().pop();
const lastmod = path => {
  const post = posts.find(p => path === `/blog/${p.slug}/`); if (post) return post.updated || post.date;
  const cat = cats.find(c => path === `/blog/${c.slug}/`); if (cat) return [maxDate(cat.items), SITE_UPDATED].sort().pop();
  if (path === '/blog/') return [maxDate(posts), SITE_UPDATED].sort().pop();
  return SITE_UPDATED;
};
writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(pages).map(p => `  <url><loc>${SITE}${p}</loc><lastmod>${lastmod(p)}</lastmod></url>`).join('\n')}\n</urlset>\n`);
writeFileSync(`${OUT}/site.webmanifest`, JSON.stringify({ name: B.name, short_name: 'براءة', lang: 'ar', dir: 'rtl', start_url: BASE + '/', display: 'standalone', background_color: '#120a0f', theme_color: '#120a0f', icons: [{ src: BASE + '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }] }));
writeFileSync(`${OUT}/llms.txt`, `# ${B.name} (${B.nameEn})

> صالون تجميل نسائي في ${B.city}، ${B.area}، الأردن. خبيرة المكياج ${B.owner} (أكثر من 1000 عروس). مكياج عرائس وعروس الحنّة، سهرات، سشوار وتسريحات، خدمة منزلية، تجهيز عرايس عمّان بالبيت أو الفندق (فستان أبيض)، ودورات مكياج خاصة وماستر كلاس.

- المدينة: ${B.city}، الأردن
- العنوان: ${B.area}، ${B.city}
- رقم السنتر: ${B.phone}
- الخدمة المنزلية (اتصال وواتساب): ${B.phoneHome}
- إنستغرام: ${B.ig}
- فيسبوك: ${B.fb}
- سناب شات: ${B.snap}

## الصفحات
- [الرئيسية](${SITE}/): نظرة عامة على الخدمات والحجز
- [مكياج العرائس في ${B.city}](${SITE}/bridal-makeup/): باقة العروس وجلسة التجربة وتجهيز المرافقات
- [ميك أب آرتست في ${B.city}](${SITE}/makeup-artist/): مكياج سهرات ومناسبات وتسريحات
- [خدمة تجميل منزلية](${SITE}/home-service/): مكياج وسشوار في المنزل، وVIP لعرايس عمّان
- [دورات المكياج](${SITE}/makeup-courses/): دورات خاصة وماستر كلاس
- [مكياج خطوبة في ${B.city}](${SITE}/engagement-makeup/)
- [عن ${B.owner}](${SITE}/about-baraa/): خبيرة المكياج وصاحبة السنتر
- [المدونة](${SITE}/blog/)

## المدونة حسب الموضوع
${cats.map(c => `### [${c.name}](${SITE}/blog/${c.slug}/)\n${c.intro}\n${c.items.map(p => `- [${p.title}](${SITE}/blog/${p.slug}/): ${p.summary || p.desc}`).join('\n')}`).join('\n\n')}

## الخدمات
${services.map(s => `- ${s.t}: ${s.d}`).join('\n')}
`);
console.log('built ->', OUT, 'SITE =', SITE);
