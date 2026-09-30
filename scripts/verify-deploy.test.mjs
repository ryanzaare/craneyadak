// scripts/verify-deploy.test.mjs — node scripts/verify-deploy.test.mjs
// هر بررسی هم با پاسخ درست (باید null) و هم با پاسخ خراب شناخته‌شده (باید خطا) آزموده می‌شود
// (قاعده‌ی ۶): بررسیِ کور «سبز» می‌شود در حالی که سرور خراب است.
import { buildChecks } from './verify-deploy.mjs';
import { LEGACY_REDIRECTS } from '../src/data/legacy-redirects.mjs';

const O = 'https://craneyadak.com';
const checks = buildChecks(O);
const by = (part) => checks.filter((c) => c.name.includes(part));
let failed = 0;
const t = (name, got, wantError) => {
  const ok = wantError ? typeof got === 'string' && got.length > 0 : got === null;
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → ${JSON.stringify(got)}`}`);
  if (!ok) failed++;
};
const res = (status, location = '', body = '') => ({ status, location, body });

const home = by('صفحه‌ی اصلی')[0];
t('اصلی سالم', home.check(res(200, '', `<link rel="canonical" href="${O}/">`)), false);
t('اصلی ۵۰۰', home.check(res(500)), true);
t('اصلی با canonical بدون اسلش', home.check(res(200, '', `<link rel="canonical" href="${O}">`)), true);

for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
  const c = by(`ریدایرکت ۳۰۱ ${from}`)[0];
  t(`301 ${from}`, c.check(res(301, `${O}${to}`)), false);
  t(`meta-refresh (۲۰۰) ${from} رد می‌شود`, c.check(res(200, '', '<meta http-equiv="refresh">')), true);
}
const first = by('ریدایرکت ۳۰۱')[0];
t('۳۰۲ به‌جای ۳۰۱', first.check(res(302, `${O}/x/`)), true);
t('مقصد اشتباه', first.check(res(301, `${O}/wrong/`)), true);

const slash = by('بدون اسلش پایانی')[0];
t('اسلش سالم', slash.check(res(301, `${O}/about/`)), false);
t('اسلش: ۲۰۰ (ریدایرکت ندارد)', slash.check(res(200)), true);

const https = by('HTTP → HTTPS')[0];
t('https سالم', https.check(res(301, `${O}/about/`)), false);
t('https: زنجیره‌ی دو مرحله‌ای (www میانی)', https.check(res(301, `https://www.craneyadak.com/about/`)), true);
t('https: ریدایرکت نشد', https.check(res(200)), true);

const www = by('www →')[0];
t('www سالم', www.check(res(301, `${O}/about/`)), false);
t('www: ۲۰۰', www.check(res(200)), true);

const nf = by('مسیر ناموجود')[0];
t('۴۰۴ سالم', nf.check(res(404, '', '<html><body>404</body></html>')), false);
t('soft-404 (۲۰۰)', nf.check(res(200, '', '<html>')), true);
t('۴۰۴ با بدنه‌ی خام آپاچی', nf.check(res(404, '', 'Not Found')), true);

for (const path of ['/.htaccess', '/.ftp-deploy-sync-state.json']) {
  const c = by(path)[0];
  t(`${path} بسته`, c.check(res(403)), false);
  t(`${path} باز است`, c.check(res(200)), true);
}
for (const p of ['/robots.txt', '/sitemap-index.xml']) {
  const c = by(p)[0];
  t(`${p} ۲۰۰`, c.check(res(200)), false);
  t(`${p} ۴۰۴`, c.check(res(404)), true);
}

if (failed) {
  console.error(`\n❌ ${failed} مورد ناموفق`);
  process.exit(1);
}
console.log('\nهمه‌ی آزمون‌های verify-deploy گذشت.');
