// scripts/plugin-release.test.mjs — node scripts/plugin-release.test.mjs
import { parseVersion, isNewer, bumpSource } from './plugin-release.mjs';

let failed = 0;
const t = (name, ok, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → ${extra}`}`);
  if (!ok) failed++;
};
t('parse سالم', JSON.stringify(parseVersion('3.25.0')) === '[3,25,0]');
for (const bad of ['3.25', 'v3.25.0', '3.25.0-beta', '', null, '3.a.0']) t(`parse خراب: ${bad}`, parseVersion(bad) === null);
t('بزرگ‌تر (minor)', isNewer('3.25.0', '3.24.0'));
t('بزرگ‌تر (numeric نه رشته‌ای)', isNewer('3.10.0', '3.9.0'));
t('برابر نیست', !isNewer('3.24.0', '3.24.0'));
t('کوچک‌تر نیست', !isNewer('3.23.0', '3.24.0'));
const src = "/*\n * Version:           3.24.0\n */\ndefine( 'CYH_VERSION', '3.24.0' );\n";
const b = bumpSource(src, '3.25.0');
t('هر دو عوض می‌شود', b && b.current === '3.24.0' && b.out.includes('Version:           3.25.0') && b.out.includes("'CYH_VERSION', '3.25.0'") && !b.out.includes('3.24.0'), JSON.stringify(b));
t('هدر و ثابت ناهمخوان = null', bumpSource(src.replace("'3.24.0' )", "'3.23.0' )"), '3.25.0') === null);
t('بدون ثابت = null', bumpSource('/*\n * Version: 3.24.0\n */', '3.25.0') === null);
t('بدون هدر = null', bumpSource("define( 'CYH_VERSION', '3.24.0' );", '3.25.0') === null);
if (failed) { console.error(`\n❌ ${failed} مورد ناموفق`); process.exit(1); }
console.log('\nهمه‌ی آزمون‌های plugin-release گذشت.');
