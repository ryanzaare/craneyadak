// src/data/warranty.test.mts — node --experimental-strip-types --no-warnings src/data/warranty.test.mts
import { readFileSync } from 'node:fs';
import { WARRANTY_BY_CATEGORY, warrantyFor } from './warranty.ts';

let failed = 0;
const t = (name: string, ok: boolean, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → ${extra}`}`);
  if (!ok) failed++;
};

// taxonomy.generated.ts خروجی build از وردپرس است؛ اسلاگ‌ها را از متنش می‌خوانیم (ایمپورت taxonomy.ts در node بدون پسوند نمی‌شود).
const taxonomy = readFileSync(new URL('./taxonomy.generated.ts', import.meta.url), 'utf8');
for (const [slug, w] of Object.entries(WARRANTY_BY_CATEGORY)) {
  t(`اسلاگ «${slug}» در تاکسونومی هست`, taxonomy.includes(`slug: '${slug}'`), 'اسلاگ ضمانت با هیچ دسته‌ای نمی‌خواند');
  t(`«${slug}»: عنوان و دست‌کم یک استثنا`, w.headline.trim().length > 10 && w.exclusions.length > 0 && w.exclusions.every((e) => e.trim()));
  t(`«${slug}»: مدت عددیِ مشخص یا شرط روشن`, /[۰-۹0-9]/.test(w.headline), 'ضمانت بی‌مدت مبهم است');
}
t('دسته‌ی بدون متن ضمانت → null (بدون ادعا)', warrantyFor(['brake-wheel-disc']) === null);
t('بدون دسته → null', warrantyFor([]) === null && warrantyFor(null) === null && warrantyFor(undefined) === null);
t('اولین دسته‌ی دارای متن برنده است', warrantyFor(['brake-wheel-disc', 'remote-control'])?.headline.includes('۱۸') === true);

if (failed) {
  console.error(`\n❌ ${failed} مورد ناموفق`);
  process.exit(1);
}
console.log('\nهمه‌ی آزمون‌های ضمانت گذشت.');
