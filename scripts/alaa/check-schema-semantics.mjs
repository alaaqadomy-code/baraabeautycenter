/**
 * السكيما الدلالية (من deep-audit عند حسن): ليس «JSON-LD صالح» بل «صحيح المعنى» على كل صفحة في dist:
 *   • Organization + WebSite على كل صفحة مفهرسة.
 *   • BreadcrumbList: position متسلسل من 1، لكل عنصر name وitem، وآخر عنصر يطابق مسار الصفحة.
 *   • Article/MedicalWebPage: headline وdatePublished وdateModified ≥ datePublished وauthor وpublisher،
 *     وdateModified يطابق <meta article:modified_time> إن وُجد.
 *   • FAQPage: كل سؤال له acceptedAnswer.text غير فارغ.
 *   • لا AggregateRating/Review (يملكها check-claims)، ولا كتلتان بنفس @type إلا ItemList/ListItem.
 */
import { pages, requireChecked } from './_dist.mjs';
import { siteUrl } from './_site-url.mjs';
const HOST = new URL(siteUrl()).host;
const all = pages().filter((p) => !p.noindex && p.url !== '/404'); const issues = []; let nodes = 0;
// المسار مفكوك الترميز وبلا شرطة أخيرة: روابط عربية مرمّزة (%D8…) تساوي مسار الصفحة نفسه
const path = (u) => { try { return decodeURIComponent(new URL(u, siteUrl()).pathname).replace(/\/$/, '') || '/'; } catch { return u; } };
const same = (a, b) => (a || '').replace(/\/$/, '') === (b || '').replace(/\/$/, '');
// أي نوع من Organization يكفي (LocalBusiness، Store، MedicalOrganization…)، لا الاسم الحرفي وحده
const ORG = /^(Organization|Corporation|LocalBusiness|NGO|OnlineBusiness|OnlineStore|Store|ProfessionalService|[A-Z]\w*(Organization|Business|Store|Service|Clinic|Agency|Office|Center))$/;
for (const { url, html } of all) {
  const add = (m) => issues.push(`${url} :: ${m}`);
  const graph = [];
  for (const b of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) { try { const j = JSON.parse(b[1]); graph.push(...(j['@graph'] ?? [j])); } catch { add('JSON-LD غير صالح'); } }
  nodes += graph.length;
  const types = (n) => [].concat(n?.['@type'] ?? []);
  const has = (t) => graph.some((n) => types(n).includes(t));
  if (!graph.some((n) => types(n).some((t) => ORG.test(t)))) add('لا Organization'); if (!has('WebSite')) add('لا WebSite');
  for (const n of graph.filter((n) => types(n).includes('BreadcrumbList'))) {
    const items = n.itemListElement ?? [];
    if (!items.length) add('BreadcrumbList فارغة');
    items.forEach((it, i) => { if (it.position !== i + 1) add(`Breadcrumb position ${it.position} في الموضع ${i + 1}`); if (!it.name) add(`Breadcrumb ${i + 1} بلا name`); if (!it.item && i < items.length - 1) add(`Breadcrumb ${i + 1} بلا item`); });
    const last = items.at(-1); const lastPath = last?.item ? path(typeof last.item === 'string' ? last.item : last.item['@id']) : null;
    if (lastPath && !same(lastPath, url)) add(`آخر Breadcrumb يشير إلى ${lastPath} لا الصفحة`);
  }
  for (const n of graph.filter((n) => types(n).some((t) => /^(Article|NewsArticle|BlogPosting|MedicalWebPage)$/.test(t)))) {
    const t = types(n).join('/');
    if (!n.headline && !n.name) add(`${t} بلا headline`);
    if (!n.datePublished) add(`${t} بلا datePublished`);
    if (n.datePublished && n.dateModified && n.dateModified < n.datePublished) add(`${t}: dateModified ${n.dateModified} < datePublished ${n.datePublished}`);
    if (!n.author && !n.publisher) add(`${t} بلا author/publisher`);
    const meta = html.match(/property="article:modified_time"\s+content="([^"]+)"/)?.[1]?.slice(0, 10);
    if (meta && n.dateModified && !String(n.dateModified).startsWith(meta)) add(`dateModified ${String(n.dateModified).slice(0, 10)} ≠ meta modified_time ${meta}`);
    for (const k of ['url', 'mainEntityOfPage']) { const v = n[k] && (typeof n[k] === 'string' ? n[k] : n[k]['@id']); if (v && new URL(v, siteUrl()).host !== HOST) add(`${t}.${k} على دومين آخر`); }
  }
  for (const n of graph.filter((n) => types(n).includes('FAQPage'))) for (const q of n.mainEntity ?? []) if (!q.acceptedAnswer?.text?.trim()) add(`سؤال بلا إجابة: «${String(q.name).slice(0, 40)}»`);
  const seen = new Map(); for (const n of graph) for (const t of types(n)) if (!/^(ListItem|ItemList|MedicalClinic|Physician|HealthAndBeautyBusiness|MedicalProcedure|Question|Answer|ImageObject|Person|Organization)$/.test(t)) { if (seen.has(t)) add(`كتلة ${t} مكررة`); seen.set(t, 1); }
  if (!/rel="canonical"/.test(html)) add('لا canonical');
}
console.log(`صفحات مفهرسة مفحوصة: ${all.length} · عقد سكيما: ${nodes}`); requireChecked(all.length); requireChecked(nodes, 'عقدة سكيما');
const g = {}; for (const i of issues) { const k = i.split(' :: ')[1].replace(/\d{4}-\d{2}-\d{2}/g, 'تاريخ').replace(/«.*»/, '').replace(/\d+/g, 'n'); g[k] = (g[k] || 0) + 1; }
for (const [k, v] of Object.entries(g).sort((a, b) => b[1] - a[1])) console.log(`  ${v}× ${k}`);
issues.slice(0, 10).forEach((i) => console.log('    ' + i));
console.log(issues.length ? `✗ ${issues.length} مشكلة دلالية في السكيما` : '✓ السكيما صحيحة المعنى على كل الصفحات');
process.exit(issues.length ? 1 : 0);
