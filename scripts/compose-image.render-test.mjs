// scripts/compose-image.render-test.mjs — رندر واقعی با Chrome (npm run test:compose-render). جدا از `check` چون Chrome می‌خواهد.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { composeAll } from './compose-image.mjs';

let failed = 0;
const t = (name, ok, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → ${extra}`}`);
  if (!ok) failed++;
};
const rejects = async (fn, needle) => {
  try { await fn(); return false; } catch (e) { return String(e.message).includes(needle); }
};
const dir = mkdtempSync(path.join(tmpdir(), 'cmp-render-'));
const svg = (body, w = 1400, h = 900) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`);
const cutout = path.join(dir, 'cutout.png');
await sharp(svg('<rect x="100" y="150" width="1200" height="600" rx="60" fill="#f5c400"/><circle cx="450" cy="450" r="170" fill="#222"/><rect x="560" y="600" width="280" height="60" fill="#fff"/>')).png().toFile(cutout);
const opaque = path.join(dir, 'opaque.jpg');
await sharp({ create: { width: 800, height: 800, channels: 3, background: '#888' } }).jpeg().toFile(opaque);
const full = path.join(dir, 'full.png');
await sharp(svg('<rect width="1400" height="900" fill="#f5c400"/>')).png().toFile(full);
const empty = path.join(dir, 'empty.png');
await sharp({ create: { width: 800, height: 800, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toFile(empty);

console.log('── ورودی خراب');
t('عکس مات بدون شیء (خاکستری یکدست): حذف خودکار پس‌زمینه شیئی نمی‌یابد و رد می‌شود', await rejects(() => composeAll([{ photo: opaque, out: path.join(dir, 'x.jpg') }]), process.platform === 'darwin' ? 'هیچ شیئی' : 'کانال شفافیت ندارد'));
t('PNG کاملاً پر (بدون شفافیت واقعی) رد می‌شود', await rejects(() => composeAll([{ photo: full, out: path.join(dir, 'x.jpg') }]), 'شفافیتی دیده نمی‌شود'));
t('PNG کاملاً شفاف رد می‌شود', await rejects(() => composeAll([{ photo: empty, out: path.join(dir, 'x.jpg') }]), 'شفاف است'));
t('کار دوم خراب: کل دسته پیش از رندر رد می‌شود', await rejects(() => composeAll([{ photo: cutout, out: path.join(dir, 'ok.jpg') }, { photo: cutout, out: path.join(dir, 'bad.jpg'), variant: 'card' }]), 'کار 2'));

if (process.platform === 'darwin') {
  console.log('── حذف پس‌زمینه (Vision) پیکسل‌های قطعه را دست نمی‌زند');
  const { spawnSync } = await import('node:child_process');
  const raw = path.join(dir, 'raw.jpg');
  await sharp(svg('<rect width="1400" height="900" fill="#ffffff"/><rect x="400" y="200" width="600" height="500" rx="40" fill="#f2b705"/><circle cx="700" cy="450" r="120" fill="#202020"/><rect x="560" y="620" width="280" height="40" fill="#c4161c"/>')).jpeg({ quality: 95 }).toFile(raw);
  const cut = path.join(dir, 'raw-cut.png');
  const r = spawnSync('swift', ['scripts/cutout.swift', raw, cut], { encoding: 'utf8' });
  t('cutout.swift اجرا شد', r.status === 0, r.stderr);
  if (r.status === 0) {
    const at = async (f, x, y) => [...(await sharp(f).ensureAlpha().extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer())];
    const same = async (x, y) => { const a = await at(raw, x, y), b = await at(cut, x, y); return a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) <= 2) && b[3] > 240; };
    t('درون قطعه: رنگ عیناً همان عکس اصلی و کدر', (await same(450, 260)) && (await same(700, 450)) && (await same(700, 640)));
    t('پس‌زمینه شفاف شد', (await at(cut, 50, 50))[3] < 10 && (await at(cut, 1350, 850))[3] < 10);
  }
}

console.log('── رندر واقعی');
const outHero = path.join(dir, 'hero.jpg');
const outCard = path.join(dir, 'card.png');
const outWide = path.join(dir, 'wide.jpg');
const outStory = path.join(dir, 'story.jpg');
await composeAll([
  { photo: cutout, out: outHero },
  { photo: cutout, out: outCard, variant: 'spec', name: 'ریموت کنترل ساگا SAGA1-L12', chips: ['۱۲ کلید', 'دو سرعته'], specs: [{ k: 'کانال', v: '۱۲' }], callouts: [{ text: 'برچسب', x: 30, y: 60 }] },
  { photo: cutout, out: outWide, variant: 'spec', ratio: '16:9', name: 'ریموت کنترل ساگا', scale: 0.8, dx: 3 },
  { photo: cutout, out: outStory, variant: 'hero', ratio: '9:16', ghost: 'SAGA1-L12', badge: 'original', theme: 'dark', trust: true },
  { photo: cutout, out: path.join(dir, 'anatomy.jpg'), variant: 'anatomy', ratio: '16:9', name: 'اجزا', callouts: [{ text: 'الف', x: 20, y: 20 }, { text: 'ب', x: 80, y: 60 }] },
]);
for (const [f, W, H] of [[outHero, 1600, 1600], [outCard, 1600, 1600], [outWide, 1600, 900], [outStory, 900, 1600]]) {
  const m = await sharp(f).metadata();
  t(`${path.basename(f)} ${W}×${H}`, m.width === W && m.height === H, `${m.width}×${m.height}`);
  const { channels } = await sharp(f).stats();
  t(`${path.basename(f)} تک‌رنگ نیست`, Math.max(...channels.map((c) => c.stdev)) > 20);
}
// نوار نارنجی بالای فوتر: ردیف y = 1600 - footer(176) + 2
const px = async (f, x, y) => (await sharp(f).extract({ left: x, top: y, width: 1, height: 1 }).raw().toBuffer());
const rule = await px(outCard, 800, 1600 - 176 + 3); // footerHeightPct 11% از ۱۶۰۰
t('نوار نارنجی فوتر (#EA580C ± JPEG/PNG)', Math.abs(rule[0] - 234) < 8 && Math.abs(rule[1] - 88) < 8 && Math.abs(rule[2] - 12) < 8, [...rule].join(','));
// هدر card: متن روشن (steel-50) باید در نیمه‌ی بالا باشد، در hero نباشد.
const brightIn = async (f, top, h) => {
  const { data } = await sharp(f).extract({ left: 150, top, width: 1300, height: h }).greyscale().raw().toBuffer({ resolveWithObject: true });
  return [...data].filter((v) => v > 200).length;
};
// تم روشن پیش‌فرض: متن نام تیره روی سطح روشن → پیکسل‌های تیره در نوار هدر.
const darkIn = async (f, top, h) => {
  const { data } = await sharp(f).extract({ left: 150, top, width: 1300, height: h }).greyscale().raw().toBuffer({ resolveWithObject: true });
  return [...data].filter((v) => v < 80).length;
};
t('spec (روشن): متن نام در هدر دیده می‌شود', (await darkIn(outCard, 90, 160)) > 2000);
t('hero (روشن): هدر خالی است', (await darkIn(outHero, 90, 60)) < 50);

if (failed) {
  console.error(`\n❌ ${failed} مورد ناموفق`);
  process.exit(1);
}
console.log('\nهمه‌ی آزمون‌های رندر compositor گذشت.');
