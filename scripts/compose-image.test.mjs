// scripts/compose-image.test.mjs — node scripts/compose-image.test.mjs   (بدون Chrome؛ رندر واقعی: compose-image.render-test.mjs)
// ورودی خراب شناخته‌شده عمداً هست (قاعده‌ی ۶).
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canvasSize, layoutFor, nameSizeFor, expandSpecFile, formatPhone, toFaDigits, readCssTokens, loadBrand, validateInput, buildHtml, recolorLogoPixels, escapeHtml } from './compose-image.mjs';

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
const throwsIn = (i, needle) => throws(() => validateInput(i), needle);
t('hero ساده', validateInput({}).variant === 'hero' && validateInput({ variant: 'card', name: 'x' }).variant === 'spec');
t('نام در hero ممنوع', throwsIn({ name: 'x' }, 'فقط در حالت spec'));
t('spec بدون نام', throwsIn({ variant: 'spec' }, 'name'));
t('نام بلند', throwsIn({ variant: 'spec', name: 'ا'.repeat(65) }, '۶۴') || throwsIn({ variant: 'spec', name: 'ا'.repeat(65) }, '64'));
t('پنج چیپ / چیپ بلند', throwsIn({ variant: 'spec', name: 'x', chips: ['1', '2', '3', '4', '5'] }, '۴ چیپ') && throwsIn({ variant: 'spec', name: 'x', chips: ['ا'.repeat(27)] }, '۲۶'));
t('variant و ratio ناشناخته', throwsIn({ variant: 'poster' }, 'نامعتبر') && throwsIn({ ratio: '3:2' }, 'نامعتبر'));
t('مشخصات: ۶ ردیف، ردیف ناقص', throwsIn({ variant: 'spec', name: 'x', specs: Array(6).fill({ k: 'a', v: 'b' }) }, '۵ ردیف') && throwsIn({ variant: 'spec', name: 'x', specs: [{ k: 'a', v: '' }] }, 'k و هم v'));
t('callout: ۵ تا، خارج از ۰..۱۰۰، بدون متن', throwsIn({ callouts: Array(5).fill({ text: 'a', x: 1, y: 1 }) }, '۴ callout') && throwsIn({ callouts: [{ text: 'a', x: 101, y: 5 }] }, 'callout.x') && throwsIn({ callouts: [{ text: '', x: 1, y: 1 }] }, 'بدون متن'));
t('scale/dx/dy خارج از بازه', throwsIn({ scale: 3 }, 'scale') && throwsIn({ dx: 99 }, 'dx') && throwsIn({ dy: 'abc' }, 'dy'));
t('badge فقط original', throwsIn({ badge: 'best' }, 'original') && validateInput({ badge: 'original' }).badge === 'original');

console.log('── ابعاد و چیدمان');
const cs = (r) => canvasSize(real.cfg, r);
t('نسبت‌ها: ۱۶۰۰² ، ۱۲۸۰×۱۶۰۰ ، ۱۶۰۰×۹۰۰ ، ۹۰۰×۱۶۰۰', JSON.stringify([cs('1:1'), cs('4:5'), cs('16:9'), cs('9:16')]) === JSON.stringify([{ w: 1600, h: 1600 }, { w: 1280, h: 1600 }, { w: 1600, h: 900 }, { w: 900, h: 1600 }]), JSON.stringify([cs('1:1'), cs('4:5'), cs('16:9'), cs('9:16')]));
const spec = (o) => validateInput({ variant: 'spec', name: 'ریموت کنترل ساگا SAGA1-L12', chips: ['الف'], specs: [{ k: 'a', v: 'b' }, { k: 'c', v: 'd' }, { k: 'e', v: 'f' }], ...o });
for (const r of ['1:1', '4:5', '16:9', '9:16']) {
  const L = layoutFor(real.cfg, spec({ ratio: r, callouts: [{ text: 'x', x: 20, y: 20 }, { text: 'y', x: 80, y: 20 }] }));
  const inside = (b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= L.w && b.y + b.h <= L.h - L.footerH + 1;
  t(`${r}: قطعه، هدر و پنل درون بوم و روی هم نمی‌افتند`, inside(L.part) && inside(L.head) && inside(L.panel) && L.part.w > 100 && L.part.h > 100
    && (L.landscape ? L.panel.y >= L.head.y + L.head.h : L.head.y + L.head.h <= L.part.y + 1 && L.part.y + L.part.h <= L.panel.y), JSON.stringify([L.part, L.head, L.panel]));
}
t('نام بلند → فونت کوچک‌تر و هدر بلندتر یا برابر', nameSizeFor(60) < nameSizeFor(31) && nameSizeFor(31) < nameSizeFor(10)
  && layoutFor(real.cfg, spec({ name: 'ا'.repeat(60) })).head.h >= layoutFor(real.cfg, spec({ name: 'ا' })).head.h);
t('callout سمت چپ و راست از عرض قطعه کم می‌کند', layoutFor(real.cfg, spec({ callouts: [{ text: 'x', x: 10, y: 5 }] })).part.w < layoutFor(real.cfg, spec({})).part.w);

console.log('── فایل مشخصات');
const jobs = expandSpecFile({ photo: 'c.png', outDir: 'out', name: 'N', variant: 'spec', outputs: [{ file: 'a.jpg' }, { file: 'b.jpg', ratio: '16:9', name: 'M' }] }, '/base');
t('مسیرها نسبت به فایل؛ فیلد مشترک و بازنویسی', jobs.length === 2 && jobs[0].photo === '/base/c.png' && jobs[0].out === '/base/out/a.jpg' && jobs[1].ratio === '16:9' && jobs[1].name === 'M' && jobs[0].name === 'N');
t('مسیر مطلق دست‌نخورده', expandSpecFile({ photo: '/x/c.png', outDir: '/y', outputs: [{ file: 'a.jpg' }] })[0].out === '/y/a.jpg');
t('ورودی خراب: آرایه، بدون photo، بدون outputs، output بدون file', [[], { outputs: [{}] }, { photo: 'a' }, { photo: 'a', outputs: [{}] }].every((x) => throws(() => expandSpecFile(x), '')));

console.log('── HTML');
const assets = { part: 'data:image/png;base64,AAAA', logo: 'data:image/png;base64,BBBB', font: 'file:///f.woff2', partW: 800, partH: 500 };
const card = buildHtml(real, { variant: 'spec', name: 'ریموت <b>"ساگا"</b>', chips: ['۱۲ کلید'], specs: [{ k: '<i>k</i>', v: 'v' }], callouts: [{ text: '<u>x</u>', x: 30, y: 30 }] }, assets);
t('همه‌ی متن‌ها escape می‌شوند (نام، مشخصات، callout)', !card.includes('<b>"ساگا"') && card.includes('&lt;') && !card.includes('<b>') && !card.includes('<i>k</i>') && !card.includes('<u>x</u>'));
t('تلفن و سایت قالبی روی تصویر', card.includes('۰۲۱-۴۶۸۷۶۹۸۰') && card.includes('craneyadak.com'));
t('رنگ‌ها فقط از توکن‌ها', !/#[0-9a-f]{6}/i.test(card.replace(/#(EA580C|0E1113|171B1F|232830|CBD2D9|F7F8FA)/gi, '').replace(/stroke-opacity/g, '')), 'رنگ هاردکد پیدا شد');
const hero = buildHtml(real, {}, assets);
t('hero عنوان ندارد، spec دارد', !hero.includes('<h1') && card.includes('<h1'));
t('کد مدل لاتین نشکن (nowrap)', buildHtml(real, { variant: 'spec', name: 'ریموت SAGA1-L12' }, assets).includes('<bdi style="white-space:nowrap">SAGA1-L12</bdi>'));
t('برچسب‌ها فقط با گزینه‌شان', !hero.includes('class="illus"') && buildHtml(real, { illustration: true }, assets).includes('class="illus"') && !hero.includes('class="orig"') && buildHtml(real, { badge: 'original' }, assets).includes('class="orig"')
  && !hero.includes('class="ghost"') && buildHtml(real, { ghost: 'F24-60' }, assets).includes('F24-60'));
const endLogo = buildHtml({ ...real, cfg: { ...real.cfg, logo: { ...real.cfg.logo, placement: 'footer-end' } } }, {}, assets);
t('جای لوگو قابل‌تغییر با پیکربندی', hero.indexOf('class="brand"') < hero.indexOf('class="contact"') && endLogo.indexOf('class="contact"') < endLogo.indexOf('class="brand"'));
const big = buildHtml(real, { scale: 1.4 }, assets), small = buildHtml(real, { scale: 0.5 }, assets);
const wOf = (h) => Number(/\.part\{[^}]*width:(\d+)px/.exec(h)[1]);
t('scale اندازه‌ی قطعه را واقعاً عوض می‌کند', wOf(big) > wOf(hero) && wOf(hero) > wOf(small), [wOf(big), wOf(hero), wOf(small)].join('/'));
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
