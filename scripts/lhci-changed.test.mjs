// scripts/lhci-changed.test.mjs — node scripts/lhci-changed.test.mjs
// ورودی خراب شناخته‌شده (قاعده‌ی ۶): هر حالتی که در آن نمی‌دانیم صفحه سالم است، باید «همه» را برگرداند، نه «هیچ».
import { pickChangedUrls } from './lhci-changed.mjs';

let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};
const U = ['/index.html', '/products/a/index.html', '/about/index.html'];
const H = { '/index.html': 'h1', '/products/a/index.html': 'h2', '/about/index.html': 'h3' };
const prev = { configHash: 'c', pages: { ...H } };

eq('هیچ تغییری = هیچ صفحه', pickChangedUrls(U, H, prev, 'c').urls, []);
eq('فقط صفحه‌ی تغییرکرده', pickChangedUrls(U, { ...H, '/products/a/index.html': 'X' }, prev, 'c').urls, ['/products/a/index.html']);
eq('مانیفست نیست = همه', pickChangedUrls(U, H, null, 'c').urls, U);
eq('مانیفست خراب (رشته) = همه', pickChangedUrls(U, H, 'garbage', 'c').urls, U);
eq('مانیفست بی pages = همه', pickChangedUrls(U, H, { configHash: 'c' }, 'c').urls, U);
eq('آستانه عوض شد = همه', pickChangedUrls(U, H, prev, 'c2').urls, U);
eq('صفحه‌ی تازه در فهرست = سنجیده می‌شود', pickChangedUrls([...U, '/blog/index.html'], { ...H, '/blog/index.html': 'h4' }, prev, 'c').urls, ['/blog/index.html']);
eq('صفحه‌ای که در dist نیست (هش ندارد) = سنجیده می‌شود (lhci خطا می‌دهد، نه سکوت)', pickChangedUrls(U, { '/index.html': 'h1', '/about/index.html': 'h3' }, prev, 'c').urls, ['/products/a/index.html']);

if (failed) {
  console.error(`\n❌ ${failed} مورد ناموفق`);
  process.exit(1);
}
console.log('\nهمه‌ی آزمون‌های lhci-changed گذشت.');
