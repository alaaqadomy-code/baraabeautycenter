/**
 * بوابة الادعاءات (قرار المالك 17 أكتوبر 2026: دليل مستقل، لا عيادة ولا ادعاءات) — تعمل على <main> في dist.
 *
 * قواعد حسن المنقولة: ضمان، 24/7، نفس اليوم، تفضيل غير مثبت، سعر بنبرة عرض/منسوب إلينا، ترخيص منسوب إلينا.
 * قواعد هذا الموقع (CLAUDE.md): لغة عيادة («احجز»، «نقدّم/نستقبل/فريقنا الطبي/عيادتنا»)، إحصاءات ذاتية
 * (سنوات خبرة، عدد عمليات، نسب رضا)، «راجعه طبياً»، نجوم/تقييمات، وفي السكيما AggregateRating/Review
 * أو MedicalClinic/Physician لوصف الموقع نفسه (خارج ItemList عيادات الغير).
 * الأسعار بالأرقام مسموحة لأنها بمصادر (prices.ts)؛ لا تُمنع إلا بنبرة عرض أو بنسبتها إلينا.
 * النفي والتحذير يُحسبان إن سبقا الكلمة الممنوعة فقط (NEG_WORD/WARNS في excused): «لا نضمن» تُقبل و«نضمن… ولا ألم» تُرفض.
 */
import { pages, main, text, requireChecked } from './_dist.mjs';
import { pathToFileURL } from 'node:url';
import { CONFIG } from './_config.mjs';
// ملف «دليل طبي» (افتراضي) يضيف قواعد دليل التجميل الأربع وفحص MedicalClinic؛ «generic» قواعد حسن الست فقط
const DIRECTORY = CONFIG.claimsProfile !== 'generic';
const SITE_RULES = new Set(['لغة عيادة/حجز', 'إحصاء ذاتي', 'مراجعة طبية مزعومة', 'نجوم/تقييم ذاتي']);

const RULES = [
  { name: 'ضمان', re: /((?<![يتم])[يت]ضمن|نضمن|نتعه?ّ?د|نعدك|ضمان[ةه]?\s+(كامل|100|النتيجة|على النتيجة)|مضمون[ةه]?(?![\p{L}])|(نجاح|النجاح|نتيجة|النتيجة|نتائج|النتائج)\S*\s+مؤكد[ةه]?|مؤكد[ةه]?\s*100)/u },
  { name: '24/7', re: /(24\s*\/\s*7|على مدار الساعة|طوال 24 ساعة)/ },
  { name: 'نفس اليوم', re: /(في نفس اليوم|تأكيد فوري|حجز فوري|سعر فوري)/ },
  { name: 'تفضيل غير مثبت', re: /(الأفضل في (الأردن|السعودية|الخليج|الوطن العربي|مصر)|(رقم 1|الرقم 1|رقم واحد) في (الأردن|السعودية|مصر|الخليج|الوطن العربي|المنطقة|السوق|المجال)|الأكبر في (الأردن|السعودية|المنطقة))/ },
  { name: 'سعر', re: /(\d[\d,.]*\s?(دينار|دولار|ريال|درهم|جنيه|JOD|JD|SAR|USD|\$)|(يبدأ|تبدأ|ابتداءً) من\s*\d|(?<![\p{L}])أرخص سعر|(?<![\p{L}])أفضل سعر)/u },
  { name: 'ترخيص منسوب إلينا', re: /(مرخّ?ص(ون|ين|ة)?|معتمد(ون|ين)? من (وزارة|هيئة|الجهات))/ },
  // قواعد دليل التجميل
  { name: 'لغة عيادة/حجز', re: /(احجز|احجزي|نقدّ?م لك|نستقبل|فريقنا الطبي|عيادتنا|أطباؤنا|أطبائنا|جرّ?احنا|مرضانا|عملائنا|خبرتنا)/ },
  { name: 'إحصاء ذاتي', re: /(\d+\s*(سنة|سنوات|عاماً|عام) (من )?(خبرتنا|الخبرة لدينا)|أجرينا\s*\d|\d+\s*(عملية|حالة) ناجحة|نسبة رضا (مرضانا|عملائنا)|\d+\s*% من (مرضانا|عملائنا|حالاتنا))/ },
  { name: 'مراجعة طبية مزعومة', re: /(راجعه طبي|تمت مراجعته طبي|مراجعة طبية لل(مقال|محتوى)|كتبها? (جراح|طبيب|دكتور)|بقلم (الفريق الطبي|د\.|الدكتور))/ },
  { name: 'نجوم/تقييم ذاتي', re: /(★|⭐|تقييم (5|٥)\/(5|٥)|ثقة آلاف)/ },
];
const WARNS = /(الانتباه|طُ?عم تسويقي|عبارات مثل|عبارة مثل|كلمة مثل|يجب الحذر|الحذر من|احذر|يدّ?عي|تدّ?عي|يزعم|تزعم|مزاعم|يُسوّ?ق|تُسوّ?ق|ابتعد عن|لا تنخدع|وعد سحري|عبارات جازمة|للاسترشاد|الأخطاء الشائعة|خطأ شائع|لا تكتب|يروّ?ج|وعود براقة|الوهم|وهمي|زائف|كاذب|خدع|نصب|نصّ?اب|محتال|احتيال|خراف|مزيّ?ف|يستغل|لا تصدّ?ق|انتبه|علامة تحذير|علامات تحذير|مستحيل|يُ?منع |محظور|لا يجوز|ادّ?عاءات |يعتقد|يظنّ?|الاعتقاد|اعتقاد شائع|شائع أن|يعدك|تعدك|وهماً|ضغط|يضغط|يُغري|إغراء)/;
const OFFERY = /((يبدأ|تبدأ|ابتداءً) من\s*\d[\d.,]*\s*(دينار|دنانير|دولار|JOD|JD|USD|\$)|أرخص سعر|أفضل سعر|أسعارنا|سعرنا|باقاتنا|لدينا باقات|نقدّ?م(ها)? بـ?\s*\d)/;
const OURS = /(نحن|لدينا|خدمتنا|خدماتنا|فريقنا|نتقاضى|رسومنا|عرضنا|عيادتنا)/;
const OUR_AVAIL = /(نرد|ندعمك|دعمنا|فريقنا|متاحون|نعمل معك|تواصل معنا)/;
const THIRD = /(ال)?(مستشفيات|مستشفى|مراكز|مركز|عيادات|عيادة|جهات|جهة|لجان|لجنة|مختبرات|مؤسسات|شركات|طبيب|أطباء|جراح|جراحين|دكتور|مجمّ?ع)(\s+\S+){0,3}\s+[وفبك]?(ال)?(مرخّ?ص|معتمد)/;

// متى يُعفى الممنوع؟ (بعد ثلاثة تدقيقات مستقلة 23 نوفمبر 2026). لكل موضع للكلمة الممنوعة، داخل **مقطعها** فقط
// (ما بين آخر فاصلة/نقطتين/فاصلة منقوطة قبلها وأول واحدة بعدها):
//   • صوت الموقع (نضمن، نتائجنا، احجز، فريقنا، نحن، لدينا…): يُعفيه فقط نفي **ملاصق** للكلمة أو قبلها بكلمة واحدة:
//     «لا نضمن»، «لن نعدك»، «لسنا الأفضل». «لا تقلق نضمن» و«لا شك أن نتائجنا مضمونة» و«لم يسبق لنا فشل احجز» تُرفض.
//   • صوت الغير (وصف): يُعفيه نفي في المقطع قبلها: «لا يوجد دكتور واحد هو الأفضل في الأردن»، «ولا يمكن لأي طبيب أن يضمن».
//   • تحذير في المقطع نفسه قبلها: «احذر من عيادة تقول نضمن». («انتبه: نضمن» و«بدون ضغط، نضمن» تُرفض: المقطع مختلف.)
//   • سؤال: المقطع الذي فيه الكلمة ينتهي بـ«؟» («هل العملية مضمونة؟»)، لا «نضمن لك النتيجة، أليس كذلك؟».
// نفي أو تحذير بعد الكلمة لا يُعفي أبداً. التشكيل والتطويل يُزالان قبل المطابقة («نَضمن»، «نـضمن»).
// shortcut: القاعدة بالأنماط لا بالإعراب؛ صياغة جديدة لم تُختبر قد تمرّ، فتبقى القراءة البشرية لازمة.
const NEG_WORD = /(^|\s)[وف]?(لا|ليس|ليست|لسنا|لن|لم|دون|بدون|غير|ليسوا)(?=\s|$)|يجب ألا|كيف [نتي]ضمن/;
const OUR_VOICE = /(نضمن|نتعه?ّ?د|نعدك|نتائجنا|نتيجتنا|احجز|احجزي|نقدّ?م لك|نستقبل|فريقنا|عيادتنا|أطباؤنا|أطبائنا|نحن |لدينا|خدماتنا|مرضانا|عملائنا|لنا )/;
const SEP = /[،,:؛;]/;
// ctx: نص العنصرين السابقين (عنوان قائمة أو مقدمتها). بند «يضمن لك النجاح» تحت «علامات الاحتيال» وصف لا وعد، فالتحذير
// في السياق السابق يُعفي جمل صوت الغير وحدها؛ صوت الموقع لا يُعفيه إلا تحذير في مقطعه نفسه (تركيب TransplantBridge، 23 نوفمبر 2026)
function excused(s, re, ctx = '') {
  const ours = OUR_VOICE.test(s);
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  for (const m of s.matchAll(g)) {
    const before = s.slice(0, m.index), after = s.slice(m.index);
    const clause = before.split(SEP).pop(), tail = after.split(SEP)[0];
    if (/[؟?]\s*$/.test(tail.trim())) continue; // سؤال في مقطع الكلمة نفسه
    if (WARNS.test(ours ? clause : before + ' ' + ctx)) continue;
    const words = clause.trim().split(/\s+/).filter(Boolean);
    // صوت الموقع: النفي الملاصق فقط (الكلمة السابقة مباشرة)؛ «دون ألم نضمن» و«لا تقلق نضمن» لا تنفيان الوعد
    // أو نفي نية قبل الوعد مباشرة: «لا نريد أن نعدك»، «لا نستطيع أن نضمن»، «لن نقول إننا الأفضل»
    const negIntent = /(^|\s)[وف]?(لا|لن|لم)\s+(نريد|نستطيع|نقدر|يمكننا|نملك|نقول|ندّعي|ندعي)(\s+(أن|إن|إننا|أننا))?\s*$/.test(clause);
    const neg = ours ? NEG_WORD.test(words.slice(-1).join(' ')) || negIntent : NEG_WORD.test(clause);
    if (!neg) return false;
  }
  return true;
}
export function sentenceFault(raw, rawCtx = '') {
  const s = String(raw).replace(/[ً-ْٰـ]/g, ''), ctx = String(rawCtx).replace(/[ً-ْٰـ]/g, ''); // التشكيل والتطويل لا يغيّران الكلمة
  for (const r of RULES) {
    if (!DIRECTORY && SITE_RULES.has(r.name)) continue;
    if (!r.re.test(s) || excused(s, r.re, ctx)) continue;
    if (r.name === 'سعر' && !OFFERY.test(s) && !OURS.test(s)) continue;
    // سعر منقول عن مصدر منشور برصد مؤرّخ (قاعدة CLAUDE.md: كل رقم بمصدر وتاريخ) ليس عرضاً منّا
    if (r.name === 'سعر' && /(رُصد|المنشور|المصدر|يذكر موقع|تذكر|بحسب|وفق|حسب موقع|تاريخ الرصد)/.test(s)) continue;
    if (r.name === '24/7' && !OUR_AVAIL.test(s)) continue;
    if (r.name === 'نفس اليوم' && !OURS.test(s) && !OUR_AVAIL.test(s)) continue;
    if (r.name === 'ترخيص منسوب إلينا' && (!OURS.test(s) || THIRD.test(s))) continue;
    if (r.name === 'ضمان' && /ما نضمنه|لا نضمن/.test(s)) continue;
    // «يضمن» بفاعل غير المتكلم وصف لأثر إجراء لا وعد منّا؛ «نضمن» وصيغ الإطلاق تبقى ممنوعة
    // «مضمون» وعدٌ فقط إن وُصفت به نتيجة أو نجاح أو نسبة («نتائجنا مضمونة»، «النتيجة مضمونة»، «مضمونة 100%»)، لا «حجم مضمون من الحشوة»
    const PROMISE = /نضمن|نتعه?ّ?د|نعدك|ضمان[ةه]?\s+(كامل|100|النتيجة|على النتيجة)|(نتيج|نتائج|نجاح)\S*\s+(\S+\s+)?(مضمون|مؤكد)|(مضمون|مؤكد)[ةه]?\s*(100|النتائج|النتيجة|النجاح)/;
    if (r.name === 'ضمان' && !PROMISE.test(s) && !/[يت]ضمن[^.؟!]{0,60}(نتيجة|النتيجة|نجاح|رضا|ربح|عملاء)/.test(s)) continue;
    // وصف علامة تحذير بصوت الغير: «وعد بنتيجة مضمونة»
    if (r.name === 'ضمان' && !OUR_VOICE.test(s) && /(^|\s)(وعد|وعود|الوعد|الوعود|يعد|تعد)\s/.test(s)) continue;
    // «احجز تذكرة/سكناً/فندقاً» نصيحة سفر، لا حجز عيادة
    if (r.name === 'لغة عيادة/حجز' && /احجزي? (تذكرة|تذاكر|سكن|فندق|غرفة|رحلة|موعد(اً)? (مع|في) (طبيب|جراح|عيادة|مستشفى) (آخر|ثان))/.test(s) && !/(نقدّ?م لك|نستقبل|فريقنا|عيادتنا|أطباؤنا|مرضانا|عملائنا|خبرتنا)/.test(s)) continue;
    // سعر الصرف ليس عرض سعر
    if (r.name === 'سعر' && /(سعر الصرف|=\s*[\d.]+\s*(دينار|دولار))/.test(s) && !OFFERY.test(s)) continue;
    // «كيف تختار الأفضل في الأردن» إرشاد للقارئ لا ادعاء أن الموقع الأفضل (رصد، تركيب 23 نوفمبر 2026)
    if (r.name === 'تفضيل غير مثبت' && /(تختار|يختار|اختيار|اختر|اختاري|تعرف|معايير)\s+(\S+\s+){0,2}الأفضل/.test(s) && !OUR_VOICE.test(s)) continue;
    return r.name;
  }
  return enFault(s);
}

// موقع ثنائي اللغة (تركيب jordanairporttransfer، 23 نوفمبر 2026): قواعد حسن الست نفسها بالإنجليزية، بالمنطق نفسه: صوت الموقع، والإعفاء بنفي أو تحذير
// في مقطع الكلمة قبلها، أو سؤال. shortcut: أنماط لا إعراب، كالقواعد العربية؛ القراءة البشرية تبقى لازمة.
const EN_RULES = [
  { name: 'ضمان', re: /\b(we guarantee|guaranteed|we promise|money[- ]back|100% (satisfaction|guaranteed))\b/i },
  { name: '24/7', re: /(\b24\s*\/\s*7\b|\b24 hours a day\b|\b(a)?round[- ]the[- ]clock\b)/i, ours: true },
  { name: 'نفس اليوم', re: /\b(instant(ly)? (confirmation|confirmed|booking|quote)|confirmed instantly|same[- ]day confirmation)\b/i, ours: true },
  { name: 'تفضيل غير مثبت', re: /(\bthe best\b|\bnumber one\b|#1\b|\bno\.\s?1\b|\bleading\b|\btop[- ]rated\b|\blargest\b)[^.;:,]{0,40}\b(in|of)\s+(jordan|amman|the middle east|the region|the market)\b/i },
  { name: 'سعر', re: /((\$|usd|jod|jd|€|£)\s?\d|\b\d[\d,.]*\s?(usd|jod|jd|dinars?|dollars?)\b|\b(cheapest|lowest|best) (price|fare|rate|transfer|taxi|deal)s?\b)/i, offer: /\b(starting (at|from)|from only|only|cheapest|lowest|best price|our (price|fare|rate)s?)\b/i },
  { name: 'ترخيص منسوب إلينا', re: /\b(licensed|certified|accredited)\b/i, ours: true },
  { name: 'نجوم/تقييم ذاتي', re: /(★|⭐|\b5\/5\b|\brated 5\b|\bthousands of (happy|satisfied)\b)/i },
];
const EN_OURS = /\b(we|we're|we are|our|us)\b/i;
const EN_EXCUSE = /\b(no|not|never|cannot|can't|don't|doesn't|won't|isn't|aren't|nobody|no one|without|beware|avoid|be wary|watch out|warning|scam|claims?|claiming)\b/i;
function enFault(s) {
  if (!/[a-z]{3}/i.test(s)) return null;
  for (const r of EN_RULES) {
    const m = s.match(r.re); if (!m) continue;
    const clause = s.slice(0, m.index).split(SEP).pop(), tail = s.slice(m.index).split(SEP)[0];
    if (/\?\s*$/.test(tail.trim()) || EN_EXCUSE.test(clause)) continue;
    if (r.ours && !EN_OURS.test(s)) continue;
    if (r.offer && !r.offer.test(s) && !EN_OURS.test(s)) continue;
    if (r.name === 'ترخيص منسوب إلينا' && /\b(authorit(y|ies)|ministry|government|official|airport|taxi desk|taxis?)\b[^.]{0,40}\b(licensed|certified|accredited)\b/i.test(s)) continue;
    return r.name;
  }
  return null;
}
/** السكيما: لا تقييمات ولا مراجعات، ولا MedicalClinic/Physician إلا داخل ItemList (عيادات/أطباء الغير). */
function schemaFaults(html) {
  const out = [];
  for (const b of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let j; try { j = JSON.parse(b[1]); } catch { continue; }
    const walk = (n, inList) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach((x) => walk(x, inList));
      const t = [].concat(n['@type'] ?? []);
      if (t.some((x) => /AggregateRating|^Review$|^Rating$/.test(x))) out.push(`سكيما ${t.join('/')}`);
      if (DIRECTORY && !inList && t.some((x) => /MedicalClinic|Physician|MedicalBusiness|HealthAndBeautyBusiness/.test(x))) out.push(`سكيما ${t.join('/')} لوصف الموقع`);
      for (const [k, v] of Object.entries(n)) if (k !== '@type') walk(v, inList || t.includes('ItemList') || k === 'itemListElement');
    };
    walk(j, false);
  }
  return out;
}

// اختبار الجمل: ممنوعة يجب أن تُرفض (منها ما بعده نفي، ثغرة 23 نوفمبر 2026)، وسليمة يجب أن تُقبل
if (process.argv.includes('--selftest')) {
  const BAD = ['اختر الأفضل في الأردن: نحن الأفضل في الأردن', 'نضمن لك نتيجة مثالية، أليس كذلك؟', 'احجز الآن مع فريقنا الطبي، ماذا تنتظر؟', 'لا تقلق نضمن لك النتيجة', 'دون ألم نضمن لك نتيجة مثالية', 'عرض غير مسبوق نتائجنا مضمونة', 'لا شك أن نتائجنا مضمونة', 'لم يسبق لنا فشل احجز الآن', 'بدون ضغط، نضمن لك النتيجة', 'انتبه: نضمن لك نتيجة مثالية', 'نَضمن لك نتيجة مثالية', 'نـضمن لك نتيجة', 'النتائج مضمونـة', 'نتعهد لك بنتيجة مثالية', 'النجاح مؤكد 100%', 'ضمانة كاملة على النتيجة', 'العملية مضمونة 100% ولا ألم فيها', 'النتيجة مضمونة تماماً، لا تقلق', 'النتائج مضمونة دون ألم', 'عملية آمنة ونتائجها مضمونة بدون مضاعفات', 'لا تتردد، احجز الآن', 'تحقق بنفسك: نتائجنا مضمونة', 'الأفضل في الأردن دون منازع', 'العملية مضمونة 100% وغير مؤلمة', 'نضمن لك نتيجة مثالية ولا ألم بعد العملية', 'نضمن لك أنف مثالي بدون جراحة', 'احجز استشارتك الآن ولن تندم', 'نتائجنا مضمونة', 'النتيجة مضمونة تماماً', 'مضمونة 100%', 'نحن الأفضل في الأردن ولا منافس لنا', 'نضمن لك نتيجة مثالية', 'احجز موعدك في عيادتنا', 'نجاح العملية مضمون'];
  const OK = ['وكيف تختار الأفضل في الأردن', 'لا نعدك بنتيجة محددة', 'لسنا الأفضل في الأردن ولا ندّعي ذلك', 'لا توجد عيادة تجميل واحدة هي الأفضل في الأردن لكل الإجراءات.', 'الاستجابة تختلف كثيراً بين الأشخاص، ولا يمكن لأي طبيب أن يضمن نتيجة محددة.', 'لا أحد يضمن لك نتيجة محددة', 'لا نضمن أي نتيجة', 'هل العملية مضمونة؟', 'لا توجد نتيجة مضمونة في أي عملية تجميل', 'تجنّب من يعدك بنتائج مضمونة', 'احذر من عيادة تقول نضمن لك النتيجة', 'النتيجة غير مضمونة', 'ليست هناك عملية مضمونة النتائج', 'الوعود بنتائج مضمونة غير مدعومة', 'احجز تذكرة عودة مرنة', 'وعد بنتيجة رقمية مضمونة', 'حجم مضمون من الحشوة'];
  // سياق: بند قائمة تحت عنوان تحذير (صوت الغير) يُعفى؛ وعد بصوت الموقع لا يُعفيه عنوان تحذير قبله
  const CTX = [['يضمن لك النجاح', 'علامات الاحتيال: احذر ممن', null], ['نضمن لك النجاح', 'علامات الاحتيال: احذر ممن', 'ضمان'], ['لا نريد أن نعدك بما قد لا نلتزم به', '', null], ['نريد أن نعدك بأفضل نتيجة', '', 'ضمان']];
  BAD.push('We guarantee your driver will be on time', 'Pickup is guaranteed for every flight', 'We are available 24/7 for airport pickups', 'Our team answers around the clock', 'We send instant confirmation on WhatsApp', 'The best airport transfer in Jordan', 'We are the #1 transfer company in Amman', 'Prices starting from 25 JOD', 'Our fare is only $30 to the city', 'Our drivers are licensed and insured', 'Rated 5/5 by our customers', 'Thousands of happy travellers');
  OK.push('No company can guarantee a flight will land on time', 'Is the pickup guaranteed?', 'The fare depends on the date, the time and the luggage', 'Beware of anyone who promises the best price in Jordan', 'Airport taxis are licensed by the transport authority', 'Send the details on WhatsApp and you get the exact fare', 'Queen Alia is about 30 to 35 km from Amman', 'A reply still has to confirm the car');
  let bad = 0; for (const [s, c, want] of CTX) { const got = sentenceFault(s, c); if (got !== want) { bad++; console.log(`✗ سياق: «${s}» بعد «${c}» ← ${got} (المتوقع ${want})`); } }
  // في ملف generic قواعد العيادة معطّلة عمداً (موقع خدمة يحجز فعلاً)، فجملها لا تُعدّ فشلاً
  const siteOnly = (s) => !DIRECTORY && RULES.some((r) => SITE_RULES.has(r.name) && r.re.test(s));
  for (const s of BAD) if (!sentenceFault(s) && !siteOnly(s)) { bad++; console.log('✗ مرّت جملة ممنوعة: ' + s); }
  for (const s of OK) { const f = sentenceFault(s); if (f) { bad++; console.log(`✗ رُفضت جملة سليمة [${f}]: ${s}`); } }
  console.log(bad ? `✗ ${bad} حالة فشلت` : `✓ ${BAD.length + OK.length + CTX.length} حالة صحيحة (${BAD.length} ممنوعة، ${OK.length} سليمة، ${CTX.length} بسياق)`); process.exit(bad ? 1 : 0);
}
// الاستيراد (من soften-guarantees) لا يشغّل الفحص
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const all = pages(); const errors = []; let sentences = 0;
for (const { url, html } of all) {
  for (const f of schemaFaults(html)) errors.push(`${url} [${f}]`);
  // حدود العناصر حدود جمل: لا تلتصق نصوص روابط وبنود وخلايا مختلفة في «جملة» واحدة (كانت تصل 540 حرفاً)
  const blocks = main(html).replace(/<\/(p|li|h[1-6]|td|th|dt|dd|div|section|figcaption|summary|caption|tr|a|blockquote)>/g, '$&\u0001'); // علامة لا تبتلعها text() كما تبتلع \n
  // العنوان والوصف يظهران في نتائج البحث، فهما من صوت الموقع أيضاً
  const head = [html.match(/<title>([^<]*)<\/title>/)?.[1], html.match(/<meta name="description" content="([^"]*)"/)?.[1]].filter(Boolean).join('\u0001');
  // السياق = عنوان القسم (h2–h4) الذي تقع فيه الجملة + العنصران السابقان لها: قائمة «علامات الاحتيال» يحدد معناها عنوانها
  const split = (h) => text(h).split(/(?<=[.!؟?])\s+|\s*\u0001\s*/).filter((x) => x.trim());
  // القسم يبدأ عند <h2>؛ عناوين h3/h4 داخله (بطاقات، بنود) جزء منه، فسياق كل جملة عنوان h2 وما سبقها في القسم (حتى 8 جمل)
  const sections = blocks.split(/(?=<h2[\s>])/).map((sec) => ({ heading: text(sec.match(/^<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? ''), list: split(sec) }));
  sections.push({ heading: '', list: split(head) });
  for (const { heading, list } of sections) for (const [i, s] of list.entries()) {
    sentences++;
    const name = sentenceFault(s, [heading, ...list.slice(Math.max(0, i - 8), i)].join(' '));
    if (name) errors.push(`${url} [${name}] «${s.trim().slice(0, 110)}»`);
  }
}
console.log(`صفحات مفحوصة: ${all.length} · جمل: ${sentences} · قواعد: ${RULES.length} عربية + ${EN_RULES.length} إنجليزية`); requireChecked(sentences, 'جملة');
errors.slice(0, 60).forEach((e) => console.log('  ✗ ' + e));
console.log(errors.length ? `✗ ${errors.length} ادعاء مخالف` : '✓ لا ادعاءات مخالفة');
process.exit(errors.length ? 1 : 0);
}
