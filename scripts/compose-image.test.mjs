// scripts/compose-image.test.mjs — node scripts/compose-image.test.mjs   (بدون Chrome؛ رندر واقعی: compose-image.render-test.mjs)
// ورودی خراب شناخته‌شده عمداً هست (قاعده‌ی ۶).
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatPhone, toFaDigits, readCssTokens, loadBrand, validateInput, buildHtml, recolorLogoPixels, escapeHtml } from './compose-image.mjs';

let failed = 0;
const t = (name, ok, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → ${extra}`}`);
  if (!ok) failed++;
};
const throws = (fn, needle) => {
  try { fn(); return false; } catch (e) { return String(e.message).includes(needle); }
};
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const real = loadBrand(ROOT);

console.log('── تلفن و ارقام');
t('ثابت تهران', formatPhone('02146876980', 'en') === '021-46876980');
t('موبایل', formatPhone('09122892253', 'en') === '0912-2892253');
t('ارقام فارسی', formatPhone('02146876980', 'fa') === '۰۲۱-۴۶۸۷۶۹۸۰' && toFaDigits('18') === '۱۸');
t('ورودی خراب: کوتاه، بدون صفر، حروف، خالی', ['0214687698', '2146876980', 'abc', '', null].every((x) => throws(() => formatPhone(x), 'معتبر نیست')));
t('تلفن واقعی پیکربندی همان شماره‌ی کارفرماست', real.phone === '۰۲۱-۴۶۸۷۶۹۸۰', real.phone);

console.log('── پالت از توکن‌های سایت');
t('خواندن توکن', readCssTokens('--color-x: #AABBCC; --y: red; --z:#12345;')['--color-x'] === '#AABBCC' && Object.keys(readCssTokens('--y: red; --z:#12345;')).length === 0);
t('رنگ‌های واقعی از global.css', real.colors.accent === '#EA580C' && real.colors.bgEdge === '#0E1113' && real.colors.bgMid === '#171B1F', JSON.stringify(real.colors));
// پیکربندی موقت با توکن ناموجود → باید خطا بدهد، نه رنگ جایگزین.
const tmp = mkdtempSync(path.join(tmpdir(), 'cmp-'));
mkdirSync(path.join(tmp, 'brand'));
mkdirSync(path.join(tmp, 'src/styles'), { recursive: true });
const cfg = JSON.parse(JSON.stringify(real.cfg));
writeFileSync(path.join(tmp, 'src/styles/global.css'), ':root{--color-steel-800:#232830;--color-steel-900:#171B1F;--color-steel-950:#0E1113;--color-steel-300:#CBD2D9;--color-steel-50:#F7F8FA;--color-accent:#EA580C;}');
const write = (c) => writeFileSync(path.join(tmp, 'brand/compositor.config.json'), JSON.stringify(c));
write(cfg);
t('پیکربندی سالم روی CSS موقت', !throws(() => loadBrand(tmp), 'x'));
write({ ...cfg, palette: { ...cfg.palette, tokens: { ...cfg.palette.tokens, accent: '--color-accent-gone' } } });
t('توکن ناموجود = خطا (نه رنگ پیش‌فرض)', throws(() => loadBrand(tmp), '--color-accent-gone'));
write({ ...cfg, layout: { ...cfg.layout, marginPct: 60 } });
t('چیدمان خارج از بازه رد می‌شود', throws(() => loadBrand(tmp), 'layout.marginPct'));
write({ ...cfg, logo: { ...cfg.logo, placement: 'center' } });
t('جای لوگوی ناشناخته رد می‌شود', throws(() => loadBrand(tmp), 'logo.placement'));
write({ ...cfg, contact: { ...cfg.contact, phone: '12345' } });
t('تلفن خراب در پیکربندی رد می‌شود', throws(() => loadBrand(tmp), 'معتبر نیست'));

console.log('── ورودی تصویر');
t('hero ساده', validateInput({}).variant === 'hero');
t('نام در hero ممنوع', throws(() => validateInput({ name: 'x' }), 'فقط در حالت card'));
t('card بدون نام', throws(() => validateInput({ variant: 'card' }), '--name'));
t('نام بلند', throws(() => validateInput({ variant: 'card', name: 'ا'.repeat(65) }), '۶۴'));
t('پنج چیپ', throws(() => validateInput({ variant: 'card', name: 'x', chips: ['1', '2', '3', '4', '5'] }), '۴ چیپ'));
t('چیپ بلند', throws(() => validateInput({ variant: 'card', name: 'x', chips: ['ا'.repeat(27)] }), '۲۶'));
t('variant ناشناخته', throws(() => validateInput({ variant: 'poster' }), 'نامعتبر'));

console.log('── HTML');
const assets = { part: 'data:image/png;base64,AAAA', logo: 'data:image/png;base64,BBBB', font: 'file:///f.woff2' };
const card = buildHtml(real, { variant: 'card', name: 'ریموت <b>"ساگا"</b>', chips: ['۱۲ کلید'] }, assets);
t('نام escape می‌شود (تزریق HTML ممکن نیست)', !card.includes('<b>"ساگا"') && card.includes('&lt;b&gt;'));
t('تلفن و سایت قالبی روی تصویر', card.includes('۰۲۱-۴۶۸۷۶۹۸۰') && card.includes('craneyadak.com'));
t('رنگ‌ها فقط از توکن‌ها', card.includes('#EA580C') && card.includes('#0E1113') && !/#[0-9a-f]{6}/i.test(card.replace(/#(EA580C|0E1113|171B1F|232830|CBD2D9|F7F8FA)/gi, '')), 'رنگ هاردکد پیدا شد');
const hero = buildHtml(real, {}, assets);
t('hero عنوان ندارد، card دارد', !hero.includes('<h1>') && card.includes('<h1>'));
t('برچسب «تصویرسازی» فقط با --illustration', !hero.includes('class="illus"') && buildHtml(real, { illustration: true }, assets).includes('class="illus"'));
const endLogo = buildHtml({ ...real, cfg: { ...real.cfg, logo: { ...real.cfg.logo, placement: 'footer-end' } } }, {}, assets);
t('جای لوگو قابل‌تغییر با پیکربندی', hero.indexOf('class="brand"') < hero.indexOf('class="contact"') && endLogo.indexOf('class="contact"') < endLogo.indexOf('class="brand"'));
t('escapeHtml', escapeHtml(`<a href="x">&'`) === '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');

console.log('── لوگوی روی پس‌زمینه‌ی تیره');
// پیکسل‌ها: سرمه‌ای، سفید، نارنجی
const px = Buffer.from([11, 27, 51, 255, 255, 255, 255, 255, 249, 115, 22, 255]);
const rc = recolorLogoPixels(px, [247, 248, 250]);
t('سرمه‌ای → روشن و کدر', rc[0] === 247 && rc[3] > 240);
t('سفید → شفاف', rc[7] === 0);
t('نارنجی دست‌نخورده', rc[8] === 249 && rc[9] === 115 && rc[10] === 22 && rc[11] === 255);

if (failed) {
  console.error(`\n❌ ${failed} مورد ناموفق`);
  process.exit(1);
}
console.log('\nهمه‌ی آزمون‌های compositor گذشت.');
