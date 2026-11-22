// npm run test:catalogs — نگاشت کاتالوگ؛ ورودی خراب (بی فایل، غیر PDF، http) حذف می‌شود.
import { normalizeCatalog, formatSize } from './catalog-shape.ts';
let failed = 0;
const t = (n: string, ok: boolean) => { console.log(`  ${ok ? '✓' : '✗'} ${n}`); if (!ok) failed++; };
const good = { slug: 'saga-l12', title: ' دفترچه SAGA1-L12 ', catalogFields: { file: { node: { mediaItemUrl: 'https://admin.craneyadak.com/wp-content/uploads/2026/11/l12.pdf', fileSize: 2516582, mimeType: 'application/pdf' } }, docType: ['manual'], language: 'en', brand: { nodes: [{ slug: 'saga', title: 'ساگا' }] }, products: { nodes: [{ slug: 'saga-saga1-l12' }, {}] } } };
const c = normalizeCatalog(good);
t('سند سالم نگاشت می‌شود', !!c && c.title === 'دفترچه SAGA1-L12' && c.docType === 'manual' && c.brandSlug === 'saga' && c.productSlugs.join() === 'saga-saga1-l12');
t('بی فایل = حذف (درس datasheet ساختگی)', normalizeCatalog({ ...good, catalogFields: { ...good.catalogFields, file: null } }) === null);
t('فایل غیر PDF = حذف', normalizeCatalog({ ...good, catalogFields: { ...good.catalogFields, file: { node: { mediaItemUrl: 'https://x/y.jpg', mimeType: 'image/jpeg' } } } }) === null);
t('نشانی http (نه https) = حذف', normalizeCatalog({ ...good, catalogFields: { ...good.catalogFields, file: { node: { mediaItemUrl: 'http://x/y.pdf' } } } }) === null);
t('بی عنوان ← «نوع + برند» (اولین کاتالوگ زنده بی عنوان ذخیره شد)', normalizeCatalog({ ...good, title: null })?.title === 'دفترچه‌ی راهنما ساگا');
t('نوع ناشناخته ← کاتالوگ', normalizeCatalog({ ...good, catalogFields: { ...good.catalogFields, docType: 'weird' } })?.docType === 'catalog');
t('حجم', formatSize(2516582) === `${(2.4).toLocaleString('fa-IR')} مگابایت` && formatSize(null) === null);
if (failed) { console.error(`\n❌ ${failed}`); process.exit(1); }
console.log('\n✅ کاتالوگ سالم.');
