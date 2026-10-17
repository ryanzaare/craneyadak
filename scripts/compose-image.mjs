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

export const RATIOS = { '1:1': [1, 1], '4:5': [4, 5], '16:9': [16, 9], '9:16': [9, 16] };
/** ابعاد بوم: ضلع بلند = cfg.canvas. */
export function canvasSize(cfg, ratio = '1:1') {
  const r = RATIOS[ratio];
  if (!r) throw new Error(`ratio «${ratio}» نامعتبر است (${Object.keys(RATIOS).join(' | ')})`);
  const k = cfg.canvas / Math.max(r[0], r[1]);
  return { w: Math.round(r[0] * k), h: Math.round(r[1] * k) };
}

const num = (v, name, lo, hi, def) => {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) throw new Error(`${name} باید عددی بین ${lo} و ${hi} باشد (فعلی: ${v})`);
  return n;
};
const text = (v, name, max) => {
  const t = String(v ?? '').trim();
  if (t.length > max) throw new Error(`${name} ${t.length} کاراکتر است؛ حداکثر ${max} (برای خوانایی روی تصویر)`);
  return t;
};

/** ورودی هر تصویر؛ هر خطا قبل از رندر، با پیام روشن. `card` نام قدیمی `spec` است. */
export function validateInput(i) {
  let variant = i.variant ?? 'hero';
  if (variant === 'card') variant = 'spec';
  if (!['hero', 'spec'].includes(variant)) throw new Error(`variant «${variant}» نامعتبر است (hero | spec)`);
  const ratio = i.ratio ?? '1:1';
  if (!RATIOS[ratio]) throw new Error(`ratio «${ratio}» نامعتبر است (${Object.keys(RATIOS).join(' | ')})`);
  const out = {
    variant, ratio,
    name: text(i.name, 'نام', 64),
    tag: text(i.tag, 'برچسب دسته (tag)', 30),
    subtitle: text(i.subtitle, 'زیرعنوان', 70),
    ghost: text(i.ghost, 'ghost (مدل پس‌زمینه)', 14),
    chips: (i.chips ?? []).map((c) => String(c).trim()).filter(Boolean),
    specs: (i.specs ?? []).map((r) => ({ k: text(r.k, 'برچسب مشخصه', 18), v: text(r.v, 'مقدار مشخصه', 30) })),
    callouts: (i.callouts ?? []).map((c) => ({ text: text(c.text, 'متن callout', 26), x: num(c.x, 'callout.x', 0, 100), y: num(c.y, 'callout.y', 0, 100) })),
    badge: i.badge ?? '',
    illustration: Boolean(i.illustration),
    scale: num(i.scale, 'scale', 0.4, 1.4, 1),
    dx: num(i.dx, 'dx', -30, 30, 0),
    dy: num(i.dy, 'dy', -30, 30, 0),
  };
  if (out.badge && out.badge !== 'original') throw new Error(`badge «${out.badge}» نامعتبر است (فقط original = «اصلی»؛ فقط برای محصولِ دارای برچسب اصلی روی سایت)`);
  if (out.chips.length > 4) throw new Error('حداکثر ۴ چیپ');
  for (const c of out.chips) if (c.length > 26) throw new Error(`چیپ «${c}» بلندتر از ۲۶ کاراکتر است`);
  if (out.specs.length > 5) throw new Error('حداکثر ۵ ردیف مشخصات');
  for (const r of out.specs) if (!r.k || !r.v) throw new Error('هر ردیف مشخصات هم k و هم v می‌خواهد');
  if (out.callouts.length > 4) throw new Error('حداکثر ۴ callout');
  for (const c of out.callouts) if (!c.text) throw new Error('callout بدون متن');
  if (variant === 'spec') {
    if (!out.name) throw new Error('حالت spec بدون name ممکن نیست');
  } else if (out.name || out.tag || out.subtitle || out.chips.length || out.specs.length) {
    throw new Error('name/tag/subtitle/chips/specs فقط در حالت spec معنی دارند (variant: "spec")');
  }
  return out;
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

/** توکن‌های لاتین/عددی (کد مدل) هرگز وسط خط نشکنند: «SAGA1-L12» یک واحد است. ⚠️ روی متن *خام* کار می‌کند و خودش escape می‌کند — اجرا روی HTML escape‌شده موجودیت‌ها (&lt;) را خراب می‌کرد. */
const nowrapLatin = (raw) =>
  String(raw)
    .split(/([A-Za-z0-9][A-Za-z0-9\-_.\/]*)/)
    .map((part, i) => (i % 2 ? `<bdi style="white-space:nowrap">${escapeHtml(part)}</bdi>` : escapeHtml(part)))
    .join('');
const hexAlpha = (hex, a) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;

/** اندازه‌ی فونت نام (کسری از u) بر اساس طول — بلندتر، کوچک‌تر. */
export const nameSizeFor = (len) => (len > 44 ? 0.04 : len > 30 ? 0.047 : 0.056);

/** مناطق چیدمان (px) — تابعی خالص، قابل آزمون. ارتفاع هدر از تعداد خط‌های تخمینی نام می‌آید تا چیپ/پنل را نپوشاند. */
export function layoutFor(cfg, v) {
  const { w, h } = canvasSize(cfg, v.ratio);
  const u = Math.min(w, h);
  const L = cfg.layout;
  const p = (k) => Math.round(u * k);
  const pad = Math.round((u * L.marginPct) / 100);
  const footerH = Math.round((u * L.footerHeightPct) / 100);
  const rows = v.specs.length;
  const rowH = p(0.058);
  const landscape = w > h * 1.3;
  // ⚠️ بوم‌های پهن‌تر از ۱۲۰۰px (۱:۱ و ۴:۵) با ≥۳ ردیف: مشخصات دو ستونه — پنل کوتاه‌تر یعنی قطعه بزرگ‌تر.
  const cols = !landscape && rows >= 3 && w >= 1200 ? 2 : 1;
  const panelH = rows ? Math.ceil(rows / cols) * rowH + p(0.05) : 0;
  const headW = v.variant === 'spec' ? (landscape ? w - Math.round(w * 0.5) - pad : w - 2 * pad) : 0;
  const fontPx = p(nameSizeFor(v.name.length));
  const lines = v.name ? Math.max(1, Math.ceil((v.name.length * 0.56 * fontPx) / Math.max(headW, 1))) : 0;
  const headH =
    v.variant === 'spec'
      ? p(0.03) + (v.tag ? p(0.05) : 0) + lines * Math.round(fontPx * 1.32) + (v.subtitle ? p(0.055) : 0) + (v.chips.length ? p(0.075) : 0) + p(0.02)
      : 0;
  let head = null, panel = null, part;
  if (v.variant === 'spec' && landscape) {
    const colX = Math.round(w * 0.5);
    head = { x: colX, y: pad, w: headW, h: headH };
    panel = rows ? { x: colX, y: pad + headH + p(0.03), w: headW, h: panelH } : null;
    part = { x: pad, y: pad, w: colX - pad * 1.5, h: h - footerH - pad * 1.6 };
  } else if (v.variant === 'spec') {
    head = { x: pad, y: pad, w: headW, h: headH };
    panel = rows ? { x: pad, y: h - footerH - panelH - p(0.03), w: headW, h: panelH } : null;
    const top = pad + headH;
    const bottom = (panel ? panel.y : h - footerH) - p(0.02);
    part = { x: pad, y: top, w: w - 2 * pad, h: bottom - top };
  } else {
    part = { x: pad, y: Math.round(pad * 0.9), w: w - 2 * pad, h: h - footerH - Math.round(pad * 1.7) };
  }
  const outer = { ...part }; // لبه‌های برچسب‌ها (callout) روی همین منطقه می‌نشینند، نه لبه‌ی بوم
  if (v.callouts.length) {
    const lw = p(0.165);
    const left = v.callouts.some((c) => c.x < 50), right = v.callouts.some((c) => c.x >= 50);
    if (left) { part.x += lw; part.w -= lw; }
    if (right) { part.w -= lw; }
  }
  return { w, h, u, pad, footerH, head, panel, part, outer, rowH, landscape, fontPx, cols };
}

/** HTML کامل (خالص — بدون Chrome قابل آزمون). `assets`: font، logo، part (data URI) و partW/partH (px پیکسل برش‌خورده). */
export function buildHtml(brand, input, assets) {
  const { cfg, colors: c, phone } = brand;
  const v = validateInput(input);
  const Lay = layoutFor(cfg, v);
  const { w: W, h: H, u, pad, footerH, head, panel, part, outer, rowH, fontPx, cols } = Lay;
  const L = cfg.layout;
  const rule = L.footerRulePx;
  const logoH = Math.round((footerH - rule) * (L.logoHeightPct / 100));
  const bs = Math.round((u * L.bracketSizePct) / 100), bi = Math.round((u * L.bracketInsetPct) / 100), bt = L.bracketThicknessPx;
  const p = (k) => Math.round(u * k); // k = کسری از ضلع کوتاه

  // قطعه: برازش در منطقه، سپس scale/dx/dy
  const fit = Math.min(part.w / assets.partW, part.h / assets.partH) * v.scale;
  const iw = Math.round(assets.partW * fit), ih = Math.round(assets.partH * fit);
  const ix = Math.round(part.x + (part.w - iw) / 2 + (W * v.dx) / 100);
  const iy = Math.round(part.y + (part.h - ih) / 2 + (H * v.dy) / 100);
  const cx = ix + iw / 2, cy = iy + ih / 2;
  const ring = Math.round(Math.min(part.w, part.h) * 0.92);

  // callouts: برچسب در لبه‌ی چپ/راست، خط با زانو
  const sides = { l: [], r: [] };
  v.callouts.forEach((co) => sides[co.x < 50 ? 'l' : 'r'].push({ ...co, ax: ix + (iw * co.x) / 100, ay: iy + (ih * co.y) / 100 }));
  const gap = p(0.075);
  let svg = '', labels = '';
  for (const [side, list] of Object.entries(sides)) {
    list.sort((a, b) => a.ay - b.ay);
    let last = -Infinity;
    for (const co of list) {
      co.ly = Math.max(co.ay, last + gap);
      last = co.ly;
      const lx = side === 'l' ? outer.x : outer.x + outer.w;
      const edge = side === 'l' ? lx + p(0.15) : lx - p(0.15);
      svg += `<polyline points="${Math.round(co.ax)},${Math.round(co.ay)} ${Math.round(side === 'l' ? edge + p(0.03) : edge - p(0.03))},${Math.round(co.ly)} ${Math.round(edge)},${Math.round(co.ly)}" fill="none" stroke="${c.accent}" stroke-width="2.5"/><circle cx="${Math.round(co.ax)}" cy="${Math.round(co.ay)}" r="${p(0.011)}" fill="${c.accent}" stroke="${c.text}" stroke-width="2"/>`;
      labels += `<div class="co" style="${side === 'l' ? `left:${Math.round(lx)}px` : `left:${Math.round(lx - p(0.15))}px`};top:${Math.round(co.ly - p(0.028))}px;width:${p(0.15)}px">${escapeHtml(co.text)}</div>`;
    }
  }

  const brandBlock = `<div class="brand"><img src="${assets.logo}" height="${logoH}" alt=""><span class="wordmark">${escapeHtml(cfg.brandName)}</span></div>`;
  const contactBlock = `<div class="contact"><span class="site" dir="ltr">${escapeHtml(cfg.contact.site)}</span><span class="phone" dir="ltr">${escapeHtml(phone)}</span></div>`;
  const footer = cfg.logo.placement === 'footer-start' ? brandBlock + contactBlock : contactBlock + brandBlock;

  let header = '';
  if (head) {
    header = `<div class="head" style="left:${head.x}px;top:${head.y}px;width:${head.w}px;height:${head.h}px">
${v.tag ? `<span class="tag">${escapeHtml(v.tag)}</span>` : ''}<h1 style="font-size:${fontPx}px">${nowrapLatin(v.name)}</h1>
${v.subtitle ? `<p class="sub">${escapeHtml(v.subtitle)}</p>` : ''}
${v.chips.length ? `<ul>${v.chips.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` : ''}</div>`;
  }
  const panelHtml = panel
    ? `<div class="panel" style="left:${panel.x}px;top:${panel.y}px;width:${panel.w}px;height:${panel.h}px;grid-template-columns:repeat(${cols},1fr)">${v.specs
        .map((r) => `<div class="row" style="height:${rowH}px"><span class="k">${escapeHtml(r.k)}</span><i></i><span class="val">${escapeHtml(r.v)}</span></div>`)
        .join('')}</div>`
    : '';
  const badge = v.badge === 'original' ? `<div class="orig">محصول اصلی</div>` : '';
  const illus = v.illustration ? `<div class="illus">تصویرسازی</div>` : '';
  const ghost = v.ghost ? `<div class="ghost" dir="ltr" style="left:${Math.round(cx)}px;top:${Math.round(cy)}px">${escapeHtml(v.ghost)}</div>` : '';
  const hex = `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${p(0.1)}' height='${Math.round(p(0.1) * 1.732)}' viewBox='0 0 56 98'><path d='M28 2 54 17v30L28 62 2 47V17Z M28 62v34 M2 47-24 62 M54 47l26 15' fill='none' stroke='${c.grid}' stroke-opacity='0.07' stroke-width='1.2'/></svg>`)}")`;

  return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:"${cfg.font.family}";src:url("${assets.font}") format("woff2");font-weight:100 900}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${W}px;height:${H}px;background:${c.bgEdge};font-family:"${cfg.font.family}",sans-serif;color:${c.text}}
.canvas{position:relative;width:${W}px;height:${H}px;overflow:hidden;
  background:
    radial-gradient(ellipse ${Math.round(part.w * 0.62)}px ${Math.round(part.h * 0.55)}px at ${Math.round(cx)}px ${Math.round(cy)}px, ${hexAlpha(c.accent, 0.2)} 0%, ${hexAlpha(c.accent, 0)} 72%),
    linear-gradient(115deg, ${hexAlpha(c.text, 0)} 38%, ${hexAlpha(c.text, 0.045)} 50%, ${hexAlpha(c.text, 0)} 62%),
    ${hex},
    radial-gradient(ellipse 80% 75% at 50% 42%, ${c.bgCenter} 0%, ${c.bgMid} 50%, ${c.bgEdge} 100%);
  background-size:auto,auto,${p(0.1)}px ${Math.round(p(0.1) * 1.732)}px,auto}
.ring{position:absolute;left:${Math.round(cx - ring / 2)}px;top:${Math.round(cy - ring / 2)}px;width:${ring}px;height:${ring}px;border-radius:50%;border:${Math.max(2, p(0.004))}px solid ${hexAlpha(c.grid, 0.14)};border-top-color:${c.accent};border-left-color:${hexAlpha(c.accent, 0.55)};transform:rotate(-20deg)}
.ring2{position:absolute;left:${Math.round(cx - ring * 0.58)}px;top:${Math.round(cy - ring * 0.58)}px;width:${Math.round(ring * 1.16)}px;height:${Math.round(ring * 1.16)}px;border-radius:50%;border:2px dashed ${hexAlpha(c.grid, 0.12)}}
.ghost{position:absolute;transform:translate(-50%,-50%);font-size:${p(0.36)}px;font-weight:900;letter-spacing:-0.02em;color:transparent;-webkit-text-stroke:2px ${hexAlpha(c.grid, 0.1)};white-space:nowrap;line-height:1}
.floor{position:absolute;left:${Math.round(cx - iw * 0.42)}px;top:${iy + ih - Math.round(ih * 0.03)}px;width:${Math.round(iw * 0.84)}px;height:${Math.round(ih * 0.09)}px;border-radius:50%;background:radial-gradient(ellipse at center, rgba(0,0,0,.6), rgba(0,0,0,0) 70%);filter:blur(${p(0.006)}px)}
.part{position:absolute;left:${ix}px;top:${iy}px;width:${iw}px;height:${ih}px;filter:drop-shadow(0 ${p(0.026)}px ${p(0.024)}px rgba(0,0,0,.55)) drop-shadow(0 0 ${p(0.006)}px ${hexAlpha(c.accent, 0.25)})}
.br{position:absolute;width:${bs}px;height:${bs}px;border:0 solid ${c.accent}}
.br.tl{top:${bi}px;left:${bi}px;border-top-width:${bt}px;border-left-width:${bt}px}
.br.tr{top:${bi}px;right:${bi}px;border-top-width:${bt}px;border-right-width:${bt}px}
.br.bl{bottom:${footerH + bi}px;left:${bi}px;border-bottom-width:${bt}px;border-left-width:${bt}px}
.br.brr{bottom:${footerH + bi}px;right:${bi}px;border-bottom-width:${bt}px;border-right-width:${bt}px}
.head{position:absolute;display:flex;flex-direction:column;justify-content:flex-start;gap:${p(0.014)}px;padding-top:${p(0.03)}px}
.tag{align-self:flex-start;font-size:${p(0.024)}px;font-weight:800;color:${c.bgEdge};background:${c.accent};padding:${p(0.005)}px ${p(0.016)}px;border-radius:${p(0.006)}px}
.head h1{font-weight:900;line-height:1.3;color:${c.text}}
.sub{font-size:${p(0.03)}px;font-weight:500;color:${c.muted};line-height:1.6}
.head ul{display:flex;gap:${p(0.012)}px;list-style:none;flex-wrap:wrap;margin-top:${p(0.006)}px}
.head li{font-size:${p(0.024)}px;font-weight:700;color:${c.text};border:2px solid ${c.accent};border-radius:${p(0.008)}px;padding:${p(0.005)}px ${p(0.014)}px;background:${hexAlpha(c.accent, 0.12)}}
.panel{position:absolute;padding:${p(0.022)}px ${p(0.032)}px;background:${hexAlpha(c.bgCenter, 0.78)};border:1px solid ${hexAlpha(c.grid, 0.22)};border-right:${p(0.008)}px solid ${c.accent};border-radius:${p(0.01)}px;display:grid;align-content:center;column-gap:${p(0.05)}px;backdrop-filter:blur(2px)}
.row{display:flex;align-items:center;gap:${p(0.014)}px;font-size:${p(0.027)}px}
.row .k{color:${c.muted};font-weight:500;white-space:nowrap}
.row i{flex:1;border-bottom:2px dotted ${hexAlpha(c.grid, 0.3)};transform:translateY(${p(0.004)}px)}
.row .val{color:${c.text};font-weight:800;white-space:nowrap}
.co{position:absolute;font-size:${p(0.021)}px;font-weight:700;line-height:1.5;color:${c.text};background:${hexAlpha(c.bgEdge, 0.85)};border:1px solid ${c.accent};border-radius:${p(0.007)}px;padding:${p(0.005)}px ${p(0.01)}px;text-align:center}
.orig{position:absolute;top:${p(0.045)}px;left:${p(0.07)}px;font-size:${p(0.026)}px;font-weight:900;color:${c.bgEdge};background:${c.accent};padding:${p(0.007)}px ${p(0.02)}px;border-radius:${p(0.05)}px}
.illus{position:absolute;top:${p(0.045)}px;right:${p(0.07)}px;font-size:${p(0.022)}px;font-weight:700;color:${c.muted};border:2px dashed ${c.muted};padding:${p(0.005)}px ${p(0.014)}px;border-radius:${p(0.007)}px}
.foot{position:absolute;left:0;right:0;bottom:0;height:${footerH}px;background:${c.bgEdge};border-top:${rule}px solid ${c.accent};display:flex;align-items:center;justify-content:space-between;padding:0 ${p(0.05)}px}
.brand{display:flex;align-items:center;gap:${p(0.014)}px}
.wordmark{font-size:${p(0.036)}px;font-weight:900;color:${c.text}}
.contact{display:flex;align-items:center;gap:${p(0.03)}px;font-size:${p(0.029)}px;font-weight:700;color:${c.text}}
.contact .site{color:${c.muted};font-weight:500}
</style></head><body><div class="canvas">
<div class="ring2"></div><div class="ring"></div>${ghost}
<i class="br tl"></i><i class="br tr"></i><i class="br bl"></i><i class="br brr"></i>
${header}${panelHtml}${badge}${illus}
<div class="floor"></div>
<img class="part" src="${assets.part}" alt="">
<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0" xmlns="http://www.w3.org/2000/svg">${svg}</svg>${labels}
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
  const cm = await sharp(cropped).metadata();

  const logoSrc = path.join(root, cfg.logo.file);
  const { data: ld, info: li } = await sharp(logoSrc).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const logo = await sharp(recolorLogoPixels(ld, hexRgb(colors.text)), { raw: { width: li.width, height: li.height, channels: 4 } }).trim().png().toBuffer();

  return {
    part: `data:image/png;base64,${cropped.toString('base64')}`,
    partW: cm.width,
    partH: cm.height,
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
      const { w: CW, h: CH } = canvasSize(brand.cfg, job.ratio ?? '1:1');
      await page.setViewport({ width: CW, height: CH, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      const fontOk = await page.evaluate((fam) => document.fonts.check(`16px "${fam}"`), brand.cfg.font.family);
      if (!fontOk) throw new Error(`فونت ${brand.cfg.font.family} بارگذاری نشد — متن فارسی با فونت اشتباه رندر می‌شد`);
      // ⚠️ بدون `clip`: با clip، Chrome headless تصویر خالیِ تک‌رنگ می‌داد (viewport دقیقاً هم‌اندازه‌ی بوم است).
      const png = await page.screenshot({ type: 'png' });
      await page.close();
      const { width, height } = await sharp(png).metadata();
      if (width !== CW || height !== CH) throw new Error(`اندازه‌ی رندر ${width}×${height} است، نه ${CW}×${CH}`);
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

/**
 * فایل مشخصات یک محصول → فهرست کارها. فیلدهای مشترک (name, tag, specs, callouts, scale…) برای همه‌ی خروجی‌ها؛
 * هر عضو outputs می‌تواند هر فیلد را بازنویسی کند. مسیرها نسبت به خود فایل (یا مطلق).
 * {"photo":"cutout.png","outDir":"out","name":"…","outputs":[{"file":"hero.jpg","variant":"hero"},{"file":"spec-wide.jpg","variant":"spec","ratio":"16:9"}]}
 */
export function expandSpecFile(spec, baseDir = '.') {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('فایل مشخصات باید یک شیء JSON باشد');
  if (!spec.photo) throw new Error('فایل مشخصات: photo لازم است');
  if (!Array.isArray(spec.outputs) || spec.outputs.length === 0) throw new Error('فایل مشخصات: outputs باید آرایه‌ی غیرخالی باشد');
  const { outputs, outDir = '.', photo, ...shared } = spec;
  const abs = (f) => (path.isAbsolute(f) ? f : path.join(baseDir, f));
  return outputs.map((o, n) => {
    if (!o.file) throw new Error(`outputs[${n}]: file لازم است`);
    const { file, ...rest } = o;
    return { ...shared, ...rest, photo: abs(photo), out: abs(path.join(outDir, file)) };
  });
}

function parseArgs(argv) {
  const a = { chips: [], specs: [], callouts: [] };
  const kv = (v, what) => {
    const i = String(v).indexOf('=');
    if (i < 1) throw new Error(`${what} باید «کلید=مقدار» باشد: ${v}`);
    return [v.slice(0, i), v.slice(i + 1)];
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--photo') a.photo = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--variant') a.variant = argv[++i];
    else if (k === '--ratio') a.ratio = argv[++i];
    else if (k === '--name') a.name = argv[++i];
    else if (k === '--tag') a.tag = argv[++i];
    else if (k === '--subtitle') a.subtitle = argv[++i];
    else if (k === '--ghost') a.ghost = argv[++i];
    else if (k === '--badge') a.badge = argv[++i];
    else if (k === '--scale') a.scale = argv[++i];
    else if (k === '--dx') a.dx = argv[++i];
    else if (k === '--dy') a.dy = argv[++i];
    else if (k === '--chip') a.chips.push(argv[++i]);
    else if (k === '--spec-row') { const [kk, vv] = kv(argv[++i], '--spec-row'); a.specs.push({ k: kk, v: vv }); }
    else if (k === '--callout') { const [t, xy] = kv(argv[++i], '--callout'); const [x, y] = xy.split(',').map(Number); a.callouts.push({ text: t, x, y }); }
    else if (k === '--illustration') a.illustration = true;
    else if (k === '--spec') a.spec = argv[++i];
    else throw new Error(`آرگومان ناشناخته: ${k}`);
  }
  return a;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const a = parseArgs(process.argv.slice(2));
    const jobs = a.spec ? expandSpecFile(JSON.parse(readFileSync(a.spec, 'utf8')), path.dirname(path.resolve(a.spec))) : [a];
    const written = await composeAll(jobs);
    console.log(`✅ ${written.length} تصویر ساخته شد:\n${written.map((w) => `   • ${w}`).join('\n')}`);
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
}
