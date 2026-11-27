// scripts/content/content.test.mjs — npm run test:content
// قاعده‌ی ۶: هر قاعده‌ی lint روی ورودی خرابِ شناخته‌شده قرمز می‌شود و روی ورودی سالم سبز.
import { compileContent, parseFaq, parseParts, parseHeading, extractDirectives, imageSize, plainText as lintText } from './compile.mjs';
import { lintDoc, norm, shingles } from './lint.mjs';

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};
const has = (name, issues, rule, level = 'error') => {
  const ok = issues.some((i) => i.rule === rule && i.level === level);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → ${JSON.stringify(issues.map((i) => `${i.level}:${i.rule}`))}`}`);
  if (!ok) failed++;
};
const hasNot = (name, issues, rule) => {
  const ok = !issues.some((i) => i.rule === rule);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → ${JSON.stringify(issues.filter((i) => i.rule === rule))}`}`);
  if (!ok) failed++;
};

const GOOD = `---
kind: article
slug: saga-remote-pairing
title: جفت کردن ریموت ساگا با گیرنده
primaryKeyword: جفت کردن ریموت ساگا
intent: informational
excerpt: راهنمای گام‌به‌گام جفت کردن ریموت ساگا با گیرنده طبق دفترچه‌ی سازنده؛ پیش‌نیازها، مراحل و هشدار کارگاه‌های چندریموتی.
sources:
  - { title: دفترچه SAGA1-L12, url: https://example.com }
---
برای **جفت کردن ریموت ساگا** با گیرنده‌ی تازه، فرستنده کد شناسه را روی گیرنده می‌نویسد. [ریموت ساگا L12](/products/saga-saga1-l12/) و [دسته‌ی ریموت](/categories/control-safety/remote-control/) و [راهنمای عیب‌یابی](/blog/saga-troubleshooting/).

![مراحل جفت کردن فرستنده با گیرنده](images/pair.jpg "مراحل")

## پیش‌نیازهای جفت کردن ریموت ساگا {nav="پیش‌نیازها"}
هم‌مدل و هم‌کانال.

:::callout warning هشدار
همه‌ی رادیوهای هم‌مدل در برد اثر می‌گیرند.
:::

:::aside
نکته‌ی کناری.
:::

## پرسش‌های متداول
:::faq
### چند دقیقه فرصت دارم؟
چهار دقیقه پس از روشن کردن گیرنده.
### کلید چه نقشی دارد؟
بی‌اثر است.
:::

## ویدیو
:::video url="https://www.aparat.com/v/inl6nb2" alt="ویدیوی جفت کردن"
`;

console.log('── کامپایل');
const g = compileContent(GOOD, { file: 'a.md' });
eq('بی خطای نحوی', g.errors, []);
eq('انواع بلوک به ترتیب', g.blocks.map((b) => b.type), ['text', 'text', 'faq', 'media']);
eq('مقدمه بی‌عنوان', g.blocks[0].heading, '');
eq('برچسب ناوبری از {nav}', g.blocks[1].nav_label, 'پیش‌نیازها');
eq('عنوان بدون {nav}', g.blocks[1].heading, 'پیش‌نیازهای جفت کردن ریموت ساگا');
eq('کادر هشدار با کلاس سایت', /<div class="cy-callout cy-callout--warning"><strong>هشدار<\/strong>/.test(g.blocks[1].body), true);
eq('ستون کناری جدا', g.blocks[1].aside, '<p>نکته‌ی کناری.</p>');
eq('FAQ دو پرسش', g.blocks[2].faqs.length, 2);
eq('ویدیو', g.blocks[3].media[0], { kind: 'video', video_url: 'https://www.aparat.com/v/inl6nb2', alt: 'ویدیوی جفت کردن', caption: '' });
eq('تصویر خط جدا ← figure با نشانگر رسانه', /<figure><img src="\{\{asset:images\/pair\.jpg\}\}" alt="مراحل جفت کردن فرستنده با گیرنده"><figcaption>مراحل<\/figcaption><\/figure>/.test(g.blocks[0].body), true);
eq('دارایی ثبت شد', g.assets, [{ file: 'images/pair.jpg', alt: 'مراحل جفت کردن فرستنده با گیرنده', role: 'inline' }]);
eq('parseHeading', parseHeading('عنوان بلند {nav="کوتاه"}'), { heading: 'عنوان بلند', nav: 'کوتاه' });
eq('parseFaq پاسخ چندخطی', parseFaq('### الف؟\nیک\nدو'), [{ q: 'الف؟', a: 'یک دو' }]);
eq('parseParts', parseParts('- شستی | control-switch | فرسودگی'), [{ name: 'شستی', category: 'control-switch', reason: 'فرسودگی' }]);
eq('دستور بسته‌نشده خطا می‌دهد', extractDirectives(':::faq\n### q?').directives[0].error !== undefined, true);
eq('دستور بلوکی داخل متن خطا', compileContent('---\nkind: article\n---\n## الف\nمتن\n:::faq\n### q؟\nا\n:::').errors.length > 0, true);
eq('H1 در متن خطا', compileContent('---\nkind: article\n---\n# عنوان\n## ب\nمتن').errors.some((e) => /سطح ۱/.test(e)), true);
eq('norm یکسان‌سازی ی/ک/نیم‌فاصله/رقم', norm('ريموت‌ كنترل  ۱۲'), 'ریموت کنترل 12');

eq('جدول با کلاس سایت', /<table class="cy-compare">/.test(compileContent('---\nkind: article\n---\n|a|b|\n|-|-|\n|1|2|').blocks[0].body), true);
const png = Buffer.alloc(32); png.writeUInt32BE(0x89504e47, 0); png.writeUInt32BE(1600, 16); png.writeUInt32BE(900, 20);
eq('ابعاد PNG', imageSize(png), { width: 1600, height: 900 });
const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0x03, 0x84, 0x06, 0x40, 3, 0, 0, 0]);
eq('ابعاد JPEG (SOF0)', imageSize(jpg), { width: 1600, height: 900 });
eq('فایل خراب ← null', imageSize(Buffer.from('not an image')), null);

console.log('── lint روی ورودی سالم');
const ok = lintDoc(g, { registry: [], routes: new Set(['/products/saga-saga1-l12/', '/categories/control-safety/remote-control/', '/blog/saga-troubleshooting/']) });
eq('بی خطا', ok.filter((i) => i.level === 'error'), []);

console.log('── lint روی ورودی خراب');
const bad = (patch) => lintDoc(compileContent(GOOD.replace(...patch), { file: 'a.md' }), { registry: [] });
has('کلیدواژه نه در عنوان', bad(['title: جفت کردن ریموت ساگا با گیرنده', 'title: راهنمای گیرنده']), 'keyword-title');
has('کلیدواژه نه در ابتدای متن', bad(['برای **جفت کردن ریموت ساگا** با', 'برای اتصال با']), 'keyword-intro');
has('excerpt بلند', bad([/excerpt: .*/, `excerpt: ${'الف '.repeat(60)}`]), 'excerpt-length');
has('بی منبع (قاعده‌ی ۲)', bad([/sources:\n.*\n/, '']), 'sources');
has('ادعای نمایندگی رسمی (قاعده‌ی ۳)', bad(['هم‌مدل و هم‌کانال.', 'نمایندگی رسمی ساگا در ایران.']), 'dealer-claim');
has('نشان 🔶 مانده', bad(['هم‌مدل و هم‌کانال.', 'ولتاژ 🔶']), 'unverified');
has('لینک بی «/» پایانی', bad(['(/products/saga-saga1-l12/)', '(/products/saga-saga1-l12)']), 'link-slash');
has('مقاله با کمتر از ۳ لینک داخلی', bad(['و [راهنمای عیب‌یابی](/blog/saga-troubleshooting/)', '']), 'internal-links');
has('تصویر بی alt', bad(['![مراحل جفت کردن فرستنده با گیرنده]', '![]']), 'alt');
has('FAQ بی‌پاسخ', bad(['بی‌اثر است.', '']), 'faq');
has('عنوان تکراری', bad(['## ویدیو', '## پرسش‌های متداول']), 'heading-dup');
has('ویدیو از دامنه‌ی ناشناخته', bad(['https://www.aparat.com/v/inl6nb2', 'https://evil.example/v/x']), 'video');
has('بی intent', bad(['intent: informational\n', '']), 'intent');
has('بی عنصر بصری', lintDoc(compileContent('---\nkind: article\nslug: a\ntitle: الف ب\nprimaryKeyword: الف\nintent: informational\nexcerpt: x\nsources: [1]\n---\nالف متن\n## ب\nمتن'), {}), 'visual');
const reg = [{ file: 'other.md', kind: 'product', slug: 'x', primaryKeyword: 'جفت‌کردن ريموت ساگا' }];
has('هم‌نوع‌خواری: همان کلیدواژه با املای دیگر', lintDoc(g, { registry: reg }), 'cannibalization');
hasNot('خود فایل با خودش مقایسه نمی‌شود', lintDoc(g, { registry: [{ file: 'a.md', kind: 'article', slug: 'saga-remote-pairing', primaryKeyword: 'جفت کردن ریموت ساگا' }] }), 'cannibalization');
const prod = compileContent(GOOD.replace('kind: article', 'kind: product'), { file: 'p.md' });
has('محصول بی گالری', lintDoc(prod, {}), 'gallery');
has('محصول بی برند', lintDoc(prod, {}), 'product');
has('محصول بی جدول داخل متن (درس L10) = خطا', lintDoc(prod, {}), 'product-visual');
has('محصول بی برچسب اصالت = هشدار', lintDoc(prod, {}), 'authenticity', 'warn');
has('محصول بی aka (قاعده‌ی ۱۱) = خطا', lintDoc(prod, {}), 'variants');
has('مدل L10 در عنوان بی «ال ۱۰» در aka = خطا', lintDoc(compileContent(GOOD.replace('kind: article', 'kind: product\naka: [SAGA L10, ریموت ساگا L10]').replace(/title: .*/, 'title: ریموت ساگا L10'), { file: 'p.md' }), {}), 'variants');
hasNot('aka با «ال ۱۰» = بی خطای variants', lintDoc(compileContent(GOOD.replace('kind: article', 'kind: product\naka: [ریموت ساگا ال ۱۰, SAGA L10]').replace(/title: .*/, 'title: ریموت ساگا L10'), { file: 'p.md' }), {}), 'variants');
has('برچسب اصالت ناشناخته = خطا', lintDoc(compileContent(GOOD.replace('kind: article', 'kind: product\nauthenticity: genuine'), { file: 'p.md' }), {}), 'authenticity');

console.log('── هرگز تکرار (کارفرما، ۲۹ آبان ۱۴۰۵)');
{
  const asset = (file, role) => ({ file, abs: `/nope/${file}`, alt: 'تصویر آزمون قطعه', role, width: 800, height: 800 });
  const base = compileContent(GOOD.replace('kind: article', 'kind: product'), { file: 'p.md' });
  const withAssets = (assets) => ({ ...base, assets });
  has('همان تصویر در گالری و متن = خطا (همان باگ صفحه‌ی L12)', lintDoc(withAssets([asset('images/a.jpg', 'gallery'), asset('images/a.jpg', 'inline')]), {}), 'image-dup');
  has('همان تصویر دو بار در گالری = خطا', lintDoc(withAssets([asset('images/a.jpg', 'gallery'), asset('images/a.jpg', 'gallery')]), {}), 'image-dup');
  hasNot('تصویرهای متفاوت = سالم', lintDoc(withAssets([asset('images/a.jpg', 'gallery'), asset('images/b.jpg', 'inline')]), {}), 'image-dup');
  const other = { file: 'o.md', kind: 'product', slug: 'o', primaryKeyword: 'دیگر', cover: 'name:images/a.jpg', shingles: new Set() };
  has('تصویر اول گالری مشترک با محصول دیگر = خطا', lintDoc(withAssets([asset('images/a.jpg', 'gallery')]), { registry: [other] }), 'cover-dup');
  const copy = { ...other, cover: null, shingles: shingles(lintText(base)) };
  has('متن کپی‌شده در صفحه‌ی دیگر = خطا', lintDoc(base, { registry: [copy] }), 'text-dup');
  hasNot('متن مستقل = سالم', lintDoc(base, { registry: [{ ...copy, shingles: shingles('متنی کاملاً دیگر درباره‌ی گیرنده با واژه‌های خودش که هیچ جمله‌ی مشترکی ندارد و فقط برای آزمون نوشته شده است') }] }), 'text-dup');
}

if (failed) {
  console.error(`\n❌ ${failed} مورد ناموفق`);
  process.exit(1);
}
console.log('\n✅ همه‌ی آزمون‌های سیستم محتوا گذشت.');
