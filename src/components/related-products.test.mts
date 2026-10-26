// src/components/related-products.test.mts — node --experimental-strip-types --no-warnings src/components/related-products.test.mts
import { relatedProductsForPost } from './related-products.ts';

let failed = 0;
const t = (name: string, ok: boolean, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → ${extra}`}`);
  if (!ok) failed++;
};
const P = (slug: string, o: Partial<{ sku: string | null; brandNameFa: string; brandNameEn: string; categorySlugs: string[]; isDemo: boolean }> = {}) => ({
  slug, sku: o.sku ?? null, brandNameFa: o.brandNameFa ?? null, brandNameEn: o.brandNameEn ?? null, categorySlugs: o.categorySlugs ?? [], isDemo: o.isDemo,
});
const cats = [{ slug: 'remote-control', name: 'ریموت کنترل جرثقیل سقفی' }, { slug: 'brake-wheel-disc', name: 'فلکه و دیسک ترمز جرثقیل سقفی' }];
const saga = P('saga', { sku: 'SAGA1-L12', brandNameFa: 'ساگا', brandNameEn: 'Saga', categorySlugs: ['remote-control'] });
const demagBrake = P('db', { sku: 'DB-200', brandNameFa: 'دماگ', brandNameEn: 'Demag', categorySlugs: ['brake-wheel-disc'] });
const demagRemote = P('dr', { brandNameFa: 'دماگ', categorySlugs: ['remote-control'] });
const ids = (r: { slug: string }[]) => r.map((x) => x.slug).join(',');

t('بی‌ربط → هیچ (نه پرکردن جا)', relatedProductsForPost({ title: 'نشانه‌های فرسودگی سیم‌بکسل', bodyHtml: '<p>سیم بکسل را بررسی کنید</p>' }, [saga, demagBrake], cats).length === 0);
t('کد فنی در متن (با فاصله/حروف متفاوت)', ids(relatedProductsForPost({ title: 'x', bodyHtml: '<p>مدل saga1 l12 را ببینید</p>' }, [saga, demagBrake], cats)) === 'saga');
t('پیوند به صفحه‌ی دسته', ids(relatedProductsForPost({ title: 'x', bodyHtml: '<a href="/categories/brake/brake-wheel-disc/">دیسک</a>' }, [saga, demagBrake], cats)) === 'db');
t('برند تنها کافی نیست (دماگ در مقاله‌ی ترمز ≠ ریموت دماگ)', ids(relatedProductsForPost({ title: 'کالیبراسیون لنت ترمز دماگ', bodyHtml: '<p>فلکه و دیسک ترمز دماگ</p>' }, [demagRemote, demagBrake], cats)) === 'db');
t('ترتیب: کد فنی بر پیوند دسته مقدم', ids(relatedProductsForPost({ title: 'x', bodyHtml: '<a href="/categories/brake/brake-wheel-disc/">d</a> SAGA1-L12' }, [demagBrake, saga], cats)) === 'saga,db');
t('محصول نمایشی هرگز', relatedProductsForPost({ title: 'SAGA1-L12', bodyHtml: '' }, [{ ...saga, isDemo: true }], cats).length === 0);
t('کد فنی کوتاه/خالی نشانه نیست', relatedProductsForPost({ title: 'ab', bodyHtml: 'ab' }, [P('s', { sku: 'ab' }), P('n', { sku: null })], cats).length === 0);
t('سقف تعداد', relatedProductsForPost({ title: 'x', bodyHtml: '<a href="/categories/brake/brake-wheel-disc/">d</a>' }, Array.from({ length: 9 }, (_, i) => P(`p${i}`, { categorySlugs: ['brake-wheel-disc'] })), cats).length === 4);

if (failed) { console.error(`\n❌ ${failed} مورد ناموفق`); process.exit(1); }
console.log('\nهمه‌ی آزمون‌های محصولات مرتبط مقاله گذشت.');
