// src/lib/authenticity.test.mts — node --experimental-strip-types --no-warnings src/lib/authenticity.test.mts
// همگام‌بودن سه لایه: acf-json ↔ PHP ↔ این ماژول؛ و رفتار مقادیر خراب.
import { readFileSync } from 'node:fs';
import { AUTHENTICITY_LABEL, parseAuthenticity } from './authenticity.ts';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};

console.log('── parseAuthenticity');
eq('original', parseAuthenticity('original'), 'original');
eq('non_original', parseAuthenticity('non_original'), 'non_original');
eq('حروف بزرگ و فاصله', parseAuthenticity('  ORIGINAL '), 'original');
eq('آرایه‌ی ACF', parseAuthenticity(['non_original']), 'non_original');
eq('خالی', parseAuthenticity(''), null);
eq('null', parseAuthenticity(null), null);
eq('مقدار ناشناخته هرگز «اصلی» نمی‌شود', parseAuthenticity('genuine'), null);
eq('عدد', parseAuthenticity(1), null);
eq('برچسب فارسی خام قبول نیست (فقط کلید)', parseAuthenticity('اصلی'), null);

console.log('── همگامی با acf-json و PHP');
const group = JSON.parse(readFileSync(new URL('../../wordpress-plugin/crane-yadak-headless/acf-json/group_cyh_product_fields.json', import.meta.url), 'utf8'));
const field = group.fields.find((f: { name: string }) => f.name === 'authenticity');
eq('کلیدها و برچسب‌های ACF = TS', field?.choices, AUTHENTICITY_LABEL);
const php = readFileSync(new URL('../../wordpress-plugin/crane-yadak-headless/includes/class-product-authenticity.php', import.meta.url), 'utf8');
const phpChoices = Object.fromEntries([...php.matchAll(/'(original|non_original)'\s*=>\s*'([^']+)'/g)].slice(0, 2).map((m) => [m[1], m[2]]));
eq('برچسب‌های PHP = TS', phpChoices, AUTHENTICITY_LABEL);

if (failed) {
  console.error(`\n❌ ${failed} مورد ناموفق`);
  process.exit(1);
}
console.log('\nهمه‌ی آزمون‌های اصالت گذشت.');
