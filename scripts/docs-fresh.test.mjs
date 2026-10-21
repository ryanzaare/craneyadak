// scripts/docs-fresh.test.mjs — node scripts/docs-fresh.test.mjs
// ورودی خراب شناخته‌شده عمداً هست (قاعده‌ی ۶): همان سه دروغی که نگهبان قدیمی ندید، این‌جا باید قرمز شوند.
import { liveSymbolProblems, acfLiveSets, mayNameMissing, stripPhpComments } from './docs-fresh-lib.mjs';

let failed = 0;
const t = (name, ok, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → ${extra}`}`);
  if (!ok) failed++;
};

const php = `function cyh_hub_import_handler() {}  add_action('admin_post_cyh_hub_import', 'x');
  acf_add_local_field_group([ 'key' => 'group_cyh_category_meta', 'graphql_field_name' => 'categoryMeta' ]);`;
const { acfNames, acfKeys } = acfLiveSets(
  ['{"key":"group_cyh_product_fields","graphql_field_name":"productFields"}', '{"key":"group_cyh_content_blocks","graphql_field_name":"contentBlocks"}', 'خراب'],
  php,
);
const live = { php, acfNames, acfKeys, npmScripts: { check: 'x', build: 'y' } };
const run = (md) => liveSymbolProblems('doc.md', md, live);

console.log('── مجموعه‌ی زنده‌ی ACF');
t('JSON + PHP خوانده می‌شود؛ JSON خراب بی‌خطا رد می‌شود', acfNames.has('productFields') && acfNames.has('contentBlocks') && acfNames.has('categoryMeta') && acfKeys.has('group_cyh_category_meta') && acfNames.size === 3);

console.log('── دروغ‌های واقعیِ دیده‌نشده (ورودی خراب)');
t('جدول گروه‌های ACF با categoryContent', run('| محتوای سئوی دسته‌بندی | `categoryContent` | ترم |').some((p) => p.includes('categoryContent')));
t('دکمه‌ی حذف‌شده با زمان آینده، حتی زیر تیتر «فهرست حذف»', run('## فهرست حذف\n| `cyh_repair_slugs` | حذف پس از آخرین اجرا |').some((p) => p.includes('cyh_repair_slugs')));
t('تابع ناموجود در متن عادی', run('دکمه‌ی `cyh_build_hierarchy` را بزنید').length === 1);
t('گروه ACF ناموجود', run('گروه `group_cyh_category_content` فعال است').length === 1);
t('دستور npm ناموجود', run('اجرا: `npm run check:docs`').some((p) => p.includes('check:docs')));

console.log('── ذکر مجاز (نباید خطا بدهد)');
t('نام زنده', run('`cyh_hub_import` و `productFields` و `contentBlocks` و `categoryMeta` و `group_cyh_category_meta`').length === 0);
t('خط‌خورده', run('| ~~`cyh_blocks_migrate`~~ | |').length === 0);
t('«حذف شد» در همان خط', run('| `categoryContent` | حذف شد — بلوک جایگزین شد |').length === 0);
t('✅ در همان خط', run('| `cyh_repair_slugs` | ✅ پس از اجرا پاک شد |').length === 0);
t('بخش تاریخی بدون زمان آینده', run('## فهرست حذف — اجرا شد\n| `brandProfile` | بلوک‌ها |').length === 0);
t('دستور npm موجود', run('`npm run build` و npm run check').length === 0);
t('بک‌تیک‌نشده بررسی نمی‌شود (نثر آزاد)', run('cyh_whatever در نثر').length === 0);

console.log('── کامنت PHP «وجود» نیست');
const phpWithComments = stripPhpComments(`/* دکمه‌ی cyh_repair_slugs حذف شد */\n// cyh_build_hierarchy هم\n# cyh_old_hash\n$u = 'https://x.y/cyh_url_kept'; function cyh_real() {}`);
t('نام فقط-در-کامنت حذف می‌شود؛ کد و رشته‌ی URL می‌ماند', !phpWithComments.includes('cyh_repair_slugs') && !phpWithComments.includes('cyh_build_hierarchy') && !phpWithComments.includes('cyh_old_hash') && phpWithComments.includes('cyh_real') && phpWithComments.includes('cyh_url_kept'));
t('سند با نامی که فقط در کامنت PHP است خطا می‌دهد', liveSymbolProblems('d.md', '`cyh_repair_slugs` را بزنید', { ...live, php: phpWithComments }).length === 1);
t('بخش «تاریخچه» تاریخی است', run('## تاریخچه‌ی تغییر پالت\n| ۱.۰ | `categoryContent` |').length === 0);

console.log('── قاعده‌ی زمان آینده');
t('آینده هرگز معاف نیست', !mayNameMissing('حذف می‌شود', true) && !mayNameMissing('~~x~~ حذف پس از آخرین اجرا', true));
t('گذشته معاف است', mayNameMissing('این دکمه حذف شد', false));
t('متن عادی خارج از بخش تاریخی معاف نیست', !mayNameMissing('بزنید', false));

if (failed) {
  console.error(`\n❌ ${failed} مورد ناموفق`);
  process.exit(1);
}
console.log('\nهمه‌ی آزمون‌های نگهبان مستندات گذشت.');
