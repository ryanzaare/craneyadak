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
t('عکس مات (برش‌نخورده) رد می‌شود', await rejects(() => composeAll([{ photo: opaque, out: path.join(dir, 'x.jpg') }]), 'کانال شفافیت ندارد'));
t('PNG کاملاً پر (بدون شفافیت واقعی) رد می‌شود', await rejects(() => composeAll([{ photo: full, out: path.join(dir, 'x.jpg') }]), 'شفافیتی دیده نمی‌شود'));
t('PNG کاملاً شفاف رد می‌شود', await rejects(() => composeAll([{ photo: empty, out: path.join(dir, 'x.jpg') }]), 'شفاف است'));
t('کار دوم خراب: کل دسته پیش از رندر رد می‌شود', await rejects(() => composeAll([{ photo: cutout, out: path.join(dir, 'ok.jpg') }, { photo: cutout, out: path.join(dir, 'bad.jpg'), variant: 'card' }]), 'کار 2'));

console.log('── رندر واقعی');
const outHero = path.join(dir, 'hero.jpg');
const outCard = path.join(dir, 'card.png');
const outWide = path.join(dir, 'wide.jpg');
const outStory = path.join(dir, 'story.jpg');
await composeAll([
  { photo: cutout, out: outHero },
  { photo: cutout, out: outCard, variant: 'spec', name: 'ریموت کنترل ساگا SAGA1-L12', chips: ['۱۲ کلید', 'دو سرعته'], specs: [{ k: 'کانال', v: '۱۲' }], callouts: [{ text: 'برچسب', x: 30, y: 60 }] },
  { photo: cutout, out: outWide, variant: 'spec', ratio: '16:9', name: 'ریموت کنترل ساگا', scale: 0.8, dx: 3 },
  { photo: cutout, out: outStory, variant: 'hero', ratio: '9:16', ghost: 'SAGA1-L12', badge: 'original' },
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
t('card: متن نام در هدر دیده می‌شود', (await brightIn(outCard, 130, 120)) > 2000);
t('hero: هدر خالی است', (await brightIn(outHero, 130, 120)) < 50);

if (failed) {
  console.error(`\n❌ ${failed} مورد ناموفق`);
  process.exit(1);
}
console.log('\nهمه‌ی آزمون‌های رندر compositor گذشت.');
