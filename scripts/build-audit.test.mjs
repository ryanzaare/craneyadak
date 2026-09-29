// scripts/build-audit.test.mjs — node scripts/build-audit.test.mjs
// ورودی خراب شناخته‌شده عمداً هست (قاعده‌ی ۶): اگر ممیزی چیزی را نگیرد، این‌جا قرمز می‌شود.
import { parsePage, routeOf, routeMatrixProblems, metadataProblems, productSchemaProblems, shrinkageProblems, SITE_ORIGIN } from './build-audit.mjs';

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};
const has = (name, list, needle) => {
  const ok = list.some((m) => m.includes(needle));
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → ${JSON.stringify(list)}`}`);
  if (!ok) failed++;
};

const page = ({ title = 'عنوان', desc = 'توضیح', h1 = 'سرتیتر', robots = 'index, follow', body = '', ld = [] } = {}) =>
  `<!doctype html><html><head><title>${title}</title><meta name="description" content="${desc}"><meta name="robots" content="${robots}">` +
  ld.map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('') +
  `</head><body><h1>${h1}</h1>${body}</body></html>`;
const P = (route, opts) => parsePage(route, page(opts));

console.log('── routeOf');
eq('ریشه', routeOf('index.html'), '/');
eq('تودرتو', routeOf('a/b/index.html'), '/a/b/');
eq('404', routeOf('404.html'), '/404.html');

console.log('── ماتریس مسیرها');
const map = [`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/about/`];
eq('سالم', routeMatrixProblems([P('/'), P('/about/'), P('/account/orders/', { robots: 'noindex, follow' })], map), []);
has('مسیر ابزاری ایندکس‌پذیر', routeMatrixProblems([P('/checkout/')], map), 'ابزاری/نمایشی است ولی ایندکس‌پذیر');
has('محصول نمایشی ایندکس‌پذیر', routeMatrixProblems([P('/products/demo-x/')], map), 'ابزاری/نمایشی');
has('صفحه‌ی ایندکس‌پذیر خارج از sitemap', routeMatrixProblems([P('/contact/')], map), 'در sitemap نیست');
eq('noindex بیرون از sitemap مجاز است', routeMatrixProblems([P('/categories/x/y/', { robots: 'noindex, follow' })], map), []);
eq('ریدایرکت نادیده', routeMatrixProblems([parsePage('/old/', '<!doctype html><title>Redirecting</title><meta http-equiv="refresh" content="0;url=/new/">')], map), []);

console.log('── یکتایی متا');
eq('سالم', metadataProblems([P('/a/', { title: 'الف', desc: 'د۱' }), P('/b/', { title: 'ب', desc: 'د۲' })]), []);
has('عنوان تکراری', metadataProblems([P('/a/', { title: 'همان' }), P('/b/', { title: 'همان', desc: 'دیگر' })]), 'عنوان با /a/ یکسان');
has('توضیح تکراری', metadataProblems([P('/a/', { title: 'الف' }), P('/b/', { title: 'ب' })]), 'توضیح با /a/ یکسان');
has('بدون H1', metadataProblems([P('/a/', { h1: '' })]), 'H1 ندارد');
eq('noindex از یکتایی معاف', metadataProblems([P('/a/', { title: 'x' }), P('/b/', { title: 'x', robots: 'noindex' })]), []);

console.log('── اسکیمای محصول');
const prod = (over = {}, body = '<p>SAGA1-L12</p><p>ساگا</p>') =>
  P('/products/p1/', {
    h1: 'ریموت SAGA1-L12',
    body,
    ld: [{ '@type': 'Product', name: 'ریموت SAGA1-L12', sku: 'SAGA1-L12', brand: { name: 'SAGA', alternateName: 'ساگا' }, ...over }],
  });
eq('سالم', productSchemaProblems([prod()]), []);
has('name ناهمخوان', productSchemaProblems([prod({ name: 'چیز دیگر' })]), 'با H1 دیده‌شده یکی نیست');
has('sku نادیدنی', productSchemaProblems([prod({ sku: 'X-999' })]), 'در متن صفحه دیده نمی‌شود');
has('برند نادیدنی', productSchemaProblems([prod({ brand: { name: 'دماگ' } })]), 'برند «دماگ»');
has('OEM نادیدنی', productSchemaProblems([prod({ additionalProperty: [{ name: 'کد معادل', value: 'ZZ-1' }] })]), 'ZZ-1');
has('امتیاز بی‌پشتوانه', productSchemaProblems([prod({ aggregateRating: { ratingValue: 5 } })]), 'aggregateRating');
has('دو Product', productSchemaProblems([P('/products/p2/', { ld: [{ '@type': 'Product' }, { '@type': 'Product' }] })]), 'دقیقاً یک Product');
has('بدون Product', productSchemaProblems([P('/products/p3/')]), 'دقیقاً یک Product');

console.log('── کوچک‌شدن بی‌صدا');
const prev = Array.from({ length: 40 }, (_, i) => `/p${i}/`);
eq('بدون ریزش', shrinkageProblems(prev, prev), []);
eq('حذف دو مسیر عادی است', shrinkageProblems(prev, prev.slice(2)), []);
has('ریزش بزرگ', shrinkageProblems(prev, prev.slice(20)), 'ALLOW_SHRINK=1');
eq('اولین build', shrinkageProblems([], prev), []);
eq('رشد مجاز', shrinkageProblems(prev, [...prev, '/new/']), []);

if (failed) {
  console.error(`\n❌ ${failed} مورد ناموفق`);
  process.exit(1);
}
console.log('\nهمه‌ی آزمون‌های ممیزی build گذشت.');
