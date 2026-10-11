#!/usr/bin/env node
// scripts/compose-image.mjs — «Compositor» تصویر محصول کرین یدک
// ---------------------------------------------------------------------------
// ورودی: عکس *برش‌خورده‌ی* قطعه (PNG شفاف — مرحله‌ی ۱ در Gemini: فقط حذف پس‌زمینه).
// خروجی: تصویر نهایی ۱۶۰۰×۱۶۰۰ با هویت ثابت (پس‌زمینه‌ی گرافیت، قاب نارنجی، نوار پایین با لوگو/سایت/تلفن، و در حالت card نام و چیپ‌ها).
//
// ⚠️ چرا این ابزار هست (درس مستر اول، docs/visual-identity-guide.md §7): هوش مصنوعی شماره‌ی تلفن را ساختگی نوشت، نام و مشخصات نیاورد، و
// برچسب‌های روی خود قطعه را خراب کرد. اینجا هر متن، رقم و رنگ را *قالب* می‌گذارد، و پیکسل‌های قطعه را فقط جابه‌جا/کوچک می‌کند، هرگز بازنقاشی نمی‌کند.
//
// تک منبع حقیقت:
//   • رنگ‌ها  : توکن‌های src/styles/global.css (نام توکن در brand/compositor.config.json). رنگی در این فایل هاردکد نیست؛ توکن گم‌شده = خطا، نه رنگ پیش‌فرض.
//   • چیدمان، لوگو، تلفن، فونت: brand/compositor.config.json.
//
// استفاده:
//   node scripts/compose-image.mjs --photo cutout.png --out out.jpg [--variant hero|card] [--name "…"] [--chip "…"]… [--illustration]
//   node scripts/compose-image.mjs --spec specs.json      # آرایه‌ای از {photo,out,variant,name,chips,illustration}
// رندر با Chrome headless (متن فارسی، RTL و فونت Vazirmatn درست). Chrome: CHROME_PATH یا نصب پیش‌فرض.
// ---------------------------------------------------------------------------
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const HEX = /^#[0-9a-fA-F]{6}$/;
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export const toFaDigits = (s) => String(s).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** ۰۲۱۴۶۸۷۶۹۸۰ → «021-46876980»؛ موبایل ۰۹۱۲۲۸۹۲۲۵۳ → «0912-2892253». هر چیز دیگر خطاست (رقم اشتباه روی عکس بدتر از نبودنش است). */
export function formatPhone(raw, digits = 'fa') {
  const d = String(raw ?? '').replace(/\D/g, '');
  let out;
  if (/^0\d{10}$/.test(d) && d.startsWith('09')) out = `${d.slice(0, 4)}-${d.slice(4)}`;
  else if (/^0\d{10}$/.test(d)) out = `${d.slice(0, 3)}-${d.slice(3)}`;
  else throw new Error(`تلفن «${raw}» معتبر نیست (۱۱ رقم با صفر اول لازم است)`);
  return digits === 'fa' ? toFaDigits(out) : out;
}

/** توکن‌های CSS (فقط مقدار #RRGGBB) از فایل css. */
export function readCssTokens(css) {
  const tokens = {};
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) tokens[m[1]] = m[2];
  return tokens;
}

export function loadBrand(root = ROOT, configPath = path.join(root, 'brand/compositor.config.json')) {
  const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
  const cssTokens = readCssTokens(readFileSync(path.join(root, cfg.palette.source), 'utf8'));
  const colors = {};
  for (const [role, token] of Object.entries(cfg.palette.tokens)) {
    if (!cssTokens[token]) throw new Error(`توکن ${token} (نقش «${role}») در ${cfg.palette.source} پیدا نشد — رنگ جایگزین ساخته نمی‌شود`);
    colors[role] = cssTokens[token];
  }
  for (const k of ['bgCenter', 'bgMid', 'bgEdge', 'grid', 'text', 'muted', 'accent']) if (!HEX.test(colors[k] ?? '')) throw new Error(`نقش رنگی «${k}» تعریف نشده`);
  const l = cfg.layout;
  for (const [k, [lo, hi]] of Object.entries({ marginPct: [4, 20], footerHeightPct: [6, 18], logoHeightPct: [30, 90], cardHeaderHeightPct: [12, 30], bracketSizePct: [2, 12], bracketInsetPct: [1, 8] })) {
    if (typeof l[k] !== 'number' || l[k] < lo || l[k] > hi) throw new Error(`layout.${k} باید عددی در بازه‌ی ${lo}..${hi} باشد (فعلی: ${l[k]})`);
  }
  if (!['footer-start', 'footer-end'].includes(cfg.logo.placement)) throw new Error(`logo.placement نامعتبر: «${cfg.logo.placement}» (footer-start | footer-end)`);
  if (!Number.isInteger(cfg.canvas) || cfg.canvas < 800 || cfg.canvas > 4000) throw new Error('canvas باید عدد صحیح بین ۸۰۰ و ۴۰۰۰ باشد');
  const phone = formatPhone(cfg.contact.phone, cfg.contact.digits);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cfg.contact.site)) throw new Error('contact.site نامعتبر');
  return { cfg, colors, phone, root };
}

/** ورودی هر تصویر؛ هر خطا قبل از رندر، با پیام روشن. */
export function validateInput(i) {
  const variant = i.variant ?? 'hero';
  if (!['hero', 'card'].includes(variant)) throw new Error(`variant «${variant}» نامعتبر است (hero | card)`);
  const name = String(i.name ?? '').trim();
  const chips = (i.chips ?? []).map((c) => String(c).trim()).filter(Boolean);
  if (variant === 'card') {
    if (!name) throw new Error('حالت card بدون --name ممکن نیست');
    if (name.length > 64) throw new Error(`نام ${name.length} کاراکتر است؛ حداکثر ۶۴ (برای خوانایی روی تصویر)`);
    if (chips.length > 4) throw new Error('حداکثر ۴ چیپ');
    for (const c of chips) if (c.length > 26) throw new Error(`چیپ «${c}» بلندتر از ۲۶ کاراکتر است`);
  } else if (name || chips.length) {
    throw new Error('نام و چیپ فقط در حالت card معنی دارند (--variant card)');
  }
  return { variant, name, chips, illustration: Boolean(i.illustration) };
}

/** لوگوی تیره (دور شش‌ضلعی سرمه‌ای) روی پس‌زمینه‌ی گرافیتی نمی‌دیده می‌شود؛ سرمه‌ای → روشن، سفید → شفاف، نارنجی دست‌نخورده. */
export function recolorLogoPixels(rgba, textRgb) {
  const out = Buffer.from(rgba);
  for (let p = 0; p < out.length; p += 4) {
    const r = out[p], g = out[p + 1], b = out[p + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (r - b > 80) {
      // نارنجی: رنگ ثابت، آلفا از فاصله تا سفید
      const a = Math.max(0, Math.min(1, (255 - Math.min(g, b)) / (255 - 22)));
      out[p] = 249; out[p + 1] = 115; out[p + 2] = 22; out[p + 3] = Math.round(a * 255);
    } else {
      const a = Math.max(0, Math.min(1, (255 - lum) / (255 - 30)));
      out[p] = textRgb[0]; out[p + 1] = textRgb[1]; out[p + 2] = textRgb[2]; out[p + 3] = Math.round(a * 255);
    }
  }
  return out;
}
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** HTML کامل (خالص — بدون Chrome قابل آزمون). `assets` = آدرس‌های آماده: font، logo، part (data URI یا file URL). */
export function buildHtml(brand, input, assets) {
  const { cfg, colors: c, phone } = brand;
  const v = validateInput(input);
  const S = cfg.canvas;
  const L = cfg.layout;
  const px = (pct) => Math.round((S * pct) / 100);
  const margin = px(L.marginPct), footerH = px(L.footerHeightPct), headerH = v.variant === 'card' ? px(L.cardHeaderHeightPct) : 0;
  const bs = px(L.bracketSizePct), bi = px(L.bracketInsetPct), bt = L.bracketThicknessPx;
  const logoH = Math.round((footerH - L.footerRulePx) * (L.logoHeightPct / 100));
  const partTop = headerH + (v.variant === 'card' ? 0 : 0) + Math.round(margin * 0.6);
  const partBottom = footerH + Math.round(margin * 0.6);
  const bracket = (pos) => `<i class="br ${pos}"></i>`;
  const brandBlock = `<div class="brand"><img src="${assets.logo}" height="${logoH}" alt=""><span class="wordmark">${escapeHtml(cfg.brandName)}</span></div>`;
  const contactBlock = `<div class="contact"><span class="site" dir="ltr">${escapeHtml(cfg.contact.site)}</span><span class="phone" dir="ltr">${escapeHtml(phone)}</span></div>`;
  const footer = cfg.logo.placement === 'footer-start' ? brandBlock + contactBlock : contactBlock + brandBlock;
  const header =
    v.variant === 'card'
      ? `<div class="head"><h1>${escapeHtml(v.name)}</h1>${v.chips.length ? `<ul>${v.chips.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : ''}</div>`
      : '';
  const badge = v.illustration ? `<div class="illus">تصویرسازی</div>` : '';
  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:"${cfg.font.family}";src:url("${assets.font}") format("woff2");font-weight:100 900}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${S}px;height:${S}px;background:${c.bgEdge};font-family:"${cfg.font.family}",sans-serif;color:${c.text}}
.canvas{position:relative;width:${S}px;height:${S}px;overflow:hidden;
  background:
    radial-gradient(ellipse 46% 40% at 50% ${v.variant === 'card' ? 54 : 47}%, ${c.accent}2e 0%, ${c.accent}00 70%),
    repeating-linear-gradient(0deg, ${c.grid}0d 0 1px, transparent 1px ${px(4)}px),
    repeating-linear-gradient(90deg, ${c.grid}0d 0 1px, transparent 1px ${px(4)}px),
    radial-gradient(ellipse 75% 70% at 50% 45%, ${c.bgCenter} 0%, ${c.bgMid} 48%, ${c.bgEdge} 100%)}
.part{position:absolute;left:${margin}px;right:${margin}px;top:${partTop}px;bottom:${partBottom}px;display:flex;align-items:center;justify-content:center}
.part img{max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 ${px(2.6)}px ${px(2.4)}px rgba(0,0,0,.55)) drop-shadow(0 0 ${px(0.5)}px ${c.accent}33)}
.br{position:absolute;width:${bs}px;height:${bs}px;border:0 solid ${c.accent}}
.br.tl{top:${bi}px;left:${bi}px;border-top-width:${bt}px;border-left-width:${bt}px}
.br.tr{top:${bi}px;right:${bi}px;border-top-width:${bt}px;border-right-width:${bt}px}
.br.bl{bottom:${footerH + bi}px;left:${bi}px;border-bottom-width:${bt}px;border-left-width:${bt}px}
.br.brr{bottom:${footerH + bi}px;right:${bi}px;border-bottom-width:${bt}px;border-right-width:${bt}px}
.head{position:absolute;top:${px(5)}px;right:${px(6)}px;left:${px(6)}px;height:${headerH - px(2)}px;display:flex;flex-direction:column;justify-content:center;gap:${px(1.6)}px}
.head h1{font-size:${px(4.4)}px;font-weight:900;line-height:1.35;color:${c.text}}
.head ul{display:flex;gap:${px(1.2)}px;list-style:none;flex-wrap:wrap}
.head li{font-size:${px(2.3)}px;font-weight:700;color:${c.text};border:2px solid ${c.accent};border-radius:${px(0.8)}px;padding:${px(0.5)}px ${px(1.4)}px;background:${c.accent}1f}
.illus{position:absolute;top:${px(2)}px;left:${px(3)}px;font-size:${px(2)}px;font-weight:700;color:${c.muted};border:2px dashed ${c.muted};padding:${px(0.4)}px ${px(1.2)}px;border-radius:${px(0.6)}px}
.foot{position:absolute;left:0;right:0;bottom:0;height:${footerH}px;background:${c.bgEdge};border-top:${L.footerRulePx}px solid ${c.accent};display:flex;align-items:center;justify-content:space-between;padding:0 ${px(5)}px}
.brand{display:flex;align-items:center;gap:${px(1.4)}px}
.wordmark{font-size:${px(3.6)}px;font-weight:900;color:${c.text}}
.contact{display:flex;align-items:center;gap:${px(3)}px;font-size:${px(2.9)}px;font-weight:700;color:${c.text}}
.contact .site{color:${c.muted};font-weight:500}
.contact .phone{color:${c.text}}
</style></head><body><div class="canvas">
${[bracket('tl'), bracket('tr'), bracket('bl'), '<i class="br brr"></i>'].join('')}
${header}${badge}
<div class="part"><img src="${assets.part}" alt=""></div>
<div class="foot">${footer}</div>
</div></body></html>`;
}

// ───────────────────────── دیسک / Chrome ─────────────────────────

const mimeOf = (f) => ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' })[path.extname(f).toLowerCase()];

async function prepareAssets(brand, photoPath) {
  const sharp = (await import('sharp')).default;
  const { cfg, colors, root } = brand;
  // قطعه: باید شفاف باشد. عکس مات یعنی هنوز برش نخورده → خطا (هوش مصنوعی/ما پس‌زمینه‌ی ناخواسته را در تصویر نهایی نمی‌خواهیم).
  const meta = await sharp(photoPath).metadata();
  if (!meta.hasAlpha) throw new Error(`${photoPath}: کانال شفافیت ندارد. اول در Gemini فقط «حذف پس‌زمینه» را اجرا کنید و PNG شفاف بدهید.`);
  const { data, info } = await sharp(photoPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1, solid = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 24) { solid++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (solid < info.width * info.height * 0.02) throw new Error(`${photoPath}: تقریباً تمام تصویر شفاف است — برش خراب یا خالی`);
  if (solid > info.width * info.height * 0.985) throw new Error(`${photoPath}: شفافیتی دیده نمی‌شود (تقریباً همه‌ی پیکسل‌ها پر است) — برش واقعی لازم است`);
  const cropped = await sharp(photoPath).extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .resize({ width: cfg.canvas, height: cfg.canvas, fit: 'inside', withoutEnlargement: false }).png().toBuffer();

  const logoSrc = path.join(root, cfg.logo.file);
  const { data: ld, info: li } = await sharp(logoSrc).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const logo = await sharp(recolorLogoPixels(ld, hexRgb(colors.text)), { raw: { width: li.width, height: li.height, channels: 4 } }).trim().png().toBuffer();

  return {
    part: `data:image/png;base64,${cropped.toString('base64')}`,
    logo: `data:image/png;base64,${logo.toString('base64')}`,
    font: pathToFileURL(path.join(root, cfg.font.file)).href,
  };
}

async function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const { Launcher } = await import('chrome-launcher');
  const found = Launcher.getFirstInstallation();
  if (!found) throw new Error('Chrome پیدا نشد. نصب کنید یا CHROME_PATH را بگذارید.');
  return found;
}

export async function composeAll(jobs, { root = ROOT } = {}) {
  const brand = loadBrand(root);
  const puppeteer = (await import('puppeteer-core')).default;
  const sharp = (await import('sharp')).default;
  const tmp = path.join(root, '.astro/compose');
  mkdirSync(tmp, { recursive: true });
  // اعتبارسنجی همه‌ی کارها پیش از باز کردن Chrome — یک ورودی خراب، کل دسته را بی‌صدا نیمه‌کاره نمی‌گذارد.
  jobs.forEach((j, n) => {
    try { validateInput(j); } catch (e) { throw new Error(`کار ${n + 1} (${j.out}): ${e.message}`); }
    if (!existsSync(j.photo)) throw new Error(`کار ${n + 1}: فایل ${j.photo} نیست`);
    if (!mimeOf(j.photo)) throw new Error(`کار ${n + 1}: فرمت ${j.photo} پشتیبانی نمی‌شود (png/jpg/webp)`);
    if (!j.out) throw new Error(`کار ${n + 1}: --out لازم است`);
  });
  const browser = await puppeteer.launch({ executablePath: await findChrome(), headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const written = [];
  try {
    for (const [n, job] of jobs.entries()) {
      const assets = await prepareAssets(brand, job.photo);
      const html = buildHtml(brand, job, assets);
      const file = path.join(tmp, `job-${n}.html`);
      writeFileSync(file, html);
      const page = await browser.newPage();
      await page.setViewport({ width: brand.cfg.canvas, height: brand.cfg.canvas, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const fontOk = await page.evaluate((fam) => document.fonts.check(`16px "${fam}"`), brand.cfg.font.family);
      if (!fontOk) throw new Error(`فونت ${brand.cfg.font.family} بارگذاری نشد — متن فارسی با فونت اشتباه رندر می‌شد`);
      // ⚠️ بدون `clip`: با clip، Chrome headless تصویر خالیِ تک‌رنگ می‌داد (viewport دقیقاً هم‌اندازه‌ی بوم است).
      const png = await page.screenshot({ type: 'png' });
      await page.close();
      const { width, height } = await sharp(png).metadata();
      if (width !== brand.cfg.canvas || height !== brand.cfg.canvas) throw new Error(`اندازه‌ی رندر ${width}×${height} است، نه ${brand.cfg.canvas}`);
      // ⚠️ رندر تک‌رنگ = خرابی بی‌صدا (با clip یک بار دقیقاً همین شد و فایلِ «موفق» خالی بود). انحراف معیار باید معنادار باشد.
      const { channels } = await sharp(png).stats();
      if (Math.max(...channels.map((ch) => ch.stdev)) < 8) throw new Error(`رندر ${job.out} تقریباً تک‌رنگ است — خروجی نوشته نشد`);
      mkdirSync(path.dirname(path.resolve(job.out)), { recursive: true });
      const ext = path.extname(job.out).toLowerCase();
      const img = sharp(png);
      if (ext === '.png') await img.png().toFile(job.out);
      else if (ext === '.avif') await img.avif({ quality: 70, effort: 6 }).toFile(job.out);
      else if (ext === '.webp') await img.webp({ quality: 90 }).toFile(job.out);
      else await img.jpeg({ quality: brand.cfg.jpegQuality, mozjpeg: true }).toFile(job.out);
      written.push(job.out);
    }
  } finally {
    await browser.close();
  }
  return written;
}

function parseArgs(argv) {
  const a = { chips: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--photo') a.photo = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--variant') a.variant = argv[++i];
    else if (k === '--name') a.name = argv[++i];
    else if (k === '--chip') a.chips.push(argv[++i]);
    else if (k === '--illustration') a.illustration = true;
    else if (k === '--spec') a.spec = argv[++i];
    else throw new Error(`آرگومان ناشناخته: ${k}`);
  }
  return a;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const a = parseArgs(process.argv.slice(2));
    const jobs = a.spec ? JSON.parse(readFileSync(a.spec, 'utf8')) : [a];
    if (!Array.isArray(jobs) || jobs.length === 0) throw new Error('فایل spec باید آرایه‌ی غیرخالی باشد');
    const written = await composeAll(jobs);
    console.log(`✅ ${written.length} تصویر ساخته شد:\n${written.map((w) => `   • ${w}`).join('\n')}`);
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
}
