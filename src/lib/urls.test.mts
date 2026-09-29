// src/lib/urls.test.mts — node --experimental-strip-types --no-warnings src/lib/urls.test.mts
// ورودی‌های خراب شناخته‌شده عمداً هستند (قاعده‌ی ۶): اگر normalizer چیزی را که نباید
// بگیرد، یا چیزی را که باید نگیرد، این‌جا قرمز می‌شود.
import { withTrailingSlash, normalizeInternalLinks, normalizeJsonLdUrls } from './urls.mjs';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};

console.log('── withTrailingSlash');
eq('مسیر ساده', withTrailingSlash('/about'), '/about/');
eq('قبلاً با اسلش', withTrailingSlash('/about/'), '/about/');
eq('ریشه', withTrailingSlash('/'), '/');
eq('مسیر تودرتو', withTrailingSlash('/categories/a/b'), '/categories/a/b/');
eq('نشانی کامل', withTrailingSlash('https://craneyadak.com/about'), 'https://craneyadak.com/about/');
eq('ریشه‌ی کامل بدون مسیر', withTrailingSlash('https://craneyadak.com'), 'https://craneyadak.com/');
eq('فایل دست‌نخورده', withTrailingSlash('/og-default.jpg'), '/og-default.jpg');
eq('sitemap دست‌نخورده', withTrailingSlash('/sitemap-index.xml'), '/sitemap-index.xml');
eq('query حفظ', withTrailingSlash('/track?code=CY-1'), '/track/?code=CY-1');
eq('hash حفظ', withTrailingSlash('/about#team'), '/about/#team');

console.log('── normalizeInternalLinks');
const src =
  '<a href="/about">a</a> <a class="x" href="/products/p-1">b</a> <a href="/track/?x=1">c</a>' +
  ' <a href="https://ext.com/x">d</a> <a href="//cdn.com/x">e</a> <a href="tel:0214">f</a>' +
  ' <a href="/logo.png">g</a> <a href="/about/">h</a> <a href="#top">i</a> <link href="/style.css">' +
  ' <a href="/contact?category=x">j</a>';
const r = normalizeInternalLinks(src);
eq('لینک‌های داخلی بدون اسلش اصلاح شد', r.changed, 2);
eq('خروجی', r.html,
  '<a href="/about/">a</a> <a class="x" href="/products/p-1/">b</a> <a href="/track/?x=1">c</a>' +
  ' <a href="https://ext.com/x">d</a> <a href="//cdn.com/x">e</a> <a href="tel:0214">f</a>' +
  ' <a href="/logo.png">g</a> <a href="/about/">h</a> <a href="#top">i</a> <link href="/style.css">' +
  ' <a href="/contact?category=x">j</a>');

console.log('── normalizeJsonLdUrls');
const O = 'https://craneyadak.com';
const ld = normalizeJsonLdUrls(
  {
    '@id': `${O}/about#webpage`,
    url: `${O}/about`,
    isPartOf: { '@id': `${O}/#website` },
    itemListElement: [{ item: O }, { item: `${O}/products/p1` }, { item: 'https://other.com/x' }],
    potentialAction: { target: { urlTemplate: `${O}/search?q={q}` } },
    logo: { url: `${O}/logo.png` },
  },
  O,
);
eq('url با اسلش', ld.url, `${O}/about/`);
eq('@id دست‌نخورده', ld['@id'], `${O}/about#webpage`);
eq('item ریشه', ld.itemListElement[0].item, `${O}/`);
eq('item محصول', ld.itemListElement[1].item, `${O}/products/p1/`);
eq('نشانی خارجی دست‌نخورده', ld.itemListElement[2].item, 'https://other.com/x');
eq('urlTemplate دست‌نخورده', ld.potentialAction.target.urlTemplate, `${O}/search?q={q}`);
eq('فایل لوگو دست‌نخورده', ld.logo.url, `${O}/logo.png`);

if (failed) {
  console.error(`\n❌ ${failed} مورد ناموفق`);
  process.exit(1);
}
console.log('\nهمه‌ی آزمون‌های نشانی گذشت.');
