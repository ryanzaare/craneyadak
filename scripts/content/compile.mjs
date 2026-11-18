// scripts/content/compile.mjs
// ---------------------------------------------------------------------------
// سیستم محتوا — مرحله‌ی ۱: فایل محتوا (Markdown + frontmatter) ← سند ساختاریافته‌ی بلوکی.
//
// چرا (کارفرما، ۲۷ آبان ۱۴۰۵): «کپی/پیست کند است؛ یک سیستم هوشمند و توسعه‌پذیر برای هر نوع محتوا می‌خواهیم».
// متن SAGA1-L12 به‌صورت HTML خام برای چسباندن در ویرایشگر تحویل شد و بلوک‌های محتوا (پالت ACF که خودمان ساخته بودیم)
// کنار گذاشته شد — بی FAQPage، بی ناوبری بخش‌ها، بی سبک یکسان. این ماژول همان قالب نویسنده‌ی `cyh_hub_blocks_to_acf()`
// (افزونه، class-content-import-hub.php) را از یک فایل خوانا می‌سازد؛ پس هر محتوا — محصول، دسته، برند، مقاله — از یک مسیر
// و با یک سبک به سایت می‌رسد.
//
// قرارداد نوشتن (docs/content-system.md):
//   • هر «## عنوان» یک بلوک است. متن پیش از اولین ## یک بلوک متنی بی‌عنوان (مقدمه).
//   • `## عنوان {nav="برچسب کوتاه"}` — برچسب نوار ناوبری.
//   • بخش‌هایی که فقط یک دستور بلوکی دارند به همان نوع بلوک تبدیل می‌شوند:
//       :::faq            (### پرسش + پاسخ)                    → faq
//       :::video url="…" alt="…"                               → media (video)
//       :::parts          (- نام | اسلاگ-دسته | علت تعویض)     → parts
//   • داخل متن: :::callout note|tip|danger|warning|info [عنوان] … :::  → کادر هشدار/نکته در همان بلوک متنی
//               :::aside … :::                                → ستون کناری همان بلوک
//               ![alt](images/x.jpg "زیرنویس") در خط جدا   → <figure> با تصویر AVIF
//               جدول Markdown                                → جدول (پوسته‌ی اسکرول در سایت)
// ---------------------------------------------------------------------------
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';
import YAML from 'yaml';

export const KINDS = ['product', 'category', 'brand', 'article'];
const CALLOUT_TONES = { note: 'info', info: 'info', tip: 'tip', danger: 'danger', warning: 'warning' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** frontmatter + بدنه. */
export function splitFrontmatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
  if (!m) return { meta: {}, body: src, error: 'frontmatter (بین دو خط ---) پیدا نشد' };
  try {
    return { meta: YAML.parse(m[1]) ?? {}, body: m[2] };
  } catch (e) {
    return { meta: {}, body: m[2], error: `YAML نامعتبر: ${e.message}` };
  }
}

/** دستورهای ::: را بیرون می‌کشد و جای هر کدام یک نشانگر می‌گذارد تا marked آن‌ها را دست نزند. */
export function extractDirectives(body) {
  const lines = body.split(/\r?\n/);
  const out = [];
  const directives = [];
  for (let i = 0; i < lines.length; i++) {
    const open = /^:::([a-z]+)(.*)$/.exec(lines[i].trim());
    if (!open || open[1] === '') {
      out.push(lines[i]);
      continue;
    }
    const name = open[1];
    const rest = open[2].trim();
    // دستور تک‌خطی (video) بستن ندارد.
    if (name === 'video') {
      directives.push({ name, args: parseArgs(rest), inner: '', line: i + 1 });
      out.push('', `<!--directive:${directives.length - 1}-->`, '');
      continue;
    }
    const inner = [];
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== ':::') inner.push(lines[j++]);
    if (j >= lines.length) {
      directives.push({ name, args: {}, inner: inner.join('\n'), line: i + 1, error: `دستور «:::${name}» در خط ${i + 1} بسته نشد (::: پایانی نیست)` });
    } else {
      directives.push({ name, args: parseArgs(rest), inner: inner.join('\n'), line: i + 1 });
    }
    out.push('', `<!--directive:${directives.length - 1}-->`, '');
    i = j;
  }
  return { body: out.join('\n'), directives };
}

/** `tip عنوان کادر` یا `url="…" alt="…"` → شیء آرگومان. */
export function parseArgs(rest) {
  const args = {};
  let free = rest;
  for (const m of rest.matchAll(/([a-z]+)="([^"]*)"/g)) {
    args[m[1]] = m[2];
    free = free.replace(m[0], '');
  }
  const words = free.trim().split(/\s+/).filter(Boolean);
  if (words.length) {
    args._first = words[0];
    args._rest = words.slice(1).join(' ');
  }
  return args;
}

/** ## عنوان {nav="…"} → { heading, nav }. */
export function parseHeading(text) {
  const m = /^(.*?)\s*\{nav="([^"]*)"\}\s*$/.exec(text);
  return m ? { heading: m[1].trim(), nav: m[2].trim() } : { heading: text.trim(), nav: '' };
}

function renderMarkdown(md, ctx) {
  const html = marked.parse(md, { async: false, gfm: true })
    // سبک یکسان جدول‌ها (کارفرما: «سبک ثابت و امضای یکسان») — همان کلاس cy-compare که در global.css تعریف شده.
    .replace(/<table>/g, '<table class="cy-compare">')
    .replace(/<th>/g, '<th scope="col">');
  // تصویر در پاراگراف جدا → <figure>؛ مسیر محلی → نشانگر رسانه که ناشر با نشانی وردپرس عوض می‌کند.
  return html
    .replace(/<p>\s*<img ([^>]*?)>\s*<\/p>/g, (_m, attrs) => figure(attrs, ctx))
    .replace(/<img ([^>]*?)>/g, (_m, attrs) => `<img ${imgAttrs(attrs, ctx)}>`);
}

function figure(attrs, ctx) {
  const title = /title="([^"]*)"/.exec(attrs)?.[1] ?? '';
  const clean = imgAttrs(attrs.replace(/\s*title="[^"]*"/, ''), ctx);
  return `<figure><img ${clean}>${title ? `<figcaption>${title}</figcaption>` : ''}</figure>`;
}

function imgAttrs(attrs, ctx) {
  return attrs.replace(/src="([^"]+)"/, (_m, src) => {
    // ⚠️ دوبار پردازش نشود: figure() همین تابع را صدا می‌زند و جایگزینی دوم روی همان <img> می‌گذرد.
    if (/^https?:\/\//.test(src) || src.startsWith('{{asset:')) return `src="${src}"`;
    const file = path.posix.normalize(src);
    ctx.assets.push({ file, alt: /alt="([^"]*)"/.exec(attrs)?.[1] ?? '', role: 'inline' });
    return `src="{{asset:${file}}}"`;
  });
}

function directiveToHtml(d, ctx) {
  if (d.name === 'callout') {
    const tone = CALLOUT_TONES[d.args._first] ?? null;
    if (!tone) ctx.errors.push(`کادر خط ${d.line}: نوع «${d.args._first ?? ''}» نامعتبر — note | tip | danger | warning | info`);
    const title = d.args._rest ? `<strong>${esc(d.args._rest)}</strong>` : '';
    const inner = renderMarkdown(d.inner, ctx).trim().replace(/^<p>([\s\S]*)<\/p>$/, '$1');
    return `<div class="cy-callout cy-callout--${tone ?? 'info'}">${title}${inner}</div>`;
  }
  ctx.errors.push(`دستور «:::${d.name}» (خط ${d.line}) داخل متن مجاز نیست — باید تنها محتوای یک بخش ## باشد`);
  return '';
}

/** پرسش‌های :::faq — هر «### پرسش» و پاراگراف‌های بعدش پاسخ. */
export function parseFaq(inner) {
  const faqs = [];
  let cur = null;
  for (const line of inner.split(/\r?\n/)) {
    const q = /^###\s+(.+)$/.exec(line.trim());
    if (q) {
      cur = { q: q[1].trim(), a: '' };
      faqs.push(cur);
    } else if (cur) cur.a += (cur.a ? '\n' : '') + line;
  }
  return faqs.map((f) => ({ q: f.q, a: f.a.trim().replace(/\s*\n\s*/g, ' ') })).filter((f) => f.q);
}

/** :::parts — «- نام | اسلاگ-دسته | علت تعویض». */
export function parseParts(inner) {
  return inner
    .split(/\r?\n/)
    .map((l) => /^[-*]\s+(.+)$/.exec(l.trim())?.[1])
    .filter(Boolean)
    .map((l) => {
      const [name, category = '', reason = ''] = l.split('|').map((s) => s.trim());
      return { name, category, reason };
    });
}

/**
 * Markdown کامل → سند.
 * @param {string} src متن فایل
 * @param {{ file?: string }} [opt]
 */
export function compileContent(src, opt = {}) {
  const { meta, body, error } = splitFrontmatter(src);
  const ctx = { assets: [], errors: error ? [error] : [] };
  const { body: marked1, directives } = extractDirectives(body);
  for (const d of directives) if (d.error) ctx.errors.push(d.error);

  // تقسیم به بخش‌ها روی «## »
  const sections = [];
  let cur = { heading: '', nav: '', lines: [] };
  let sawH1 = false;
  for (const line of marked1.split(/\r?\n/)) {
    if (/^#\s/.test(line)) sawH1 = true;
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      sections.push(cur);
      cur = { ...parseHeading(h2[1]), lines: [] };
    } else cur.lines.push(line);
  }
  sections.push(cur);
  if (sawH1) ctx.errors.push('عنوان سطح ۱ (# ) در متن هست — H1 صفحه همان title است؛ بخش‌ها با ## شروع شوند');

  const blocks = [];
  for (const s of sections) {
    const md = s.lines.join('\n').trim();
    if (!md && !s.heading) continue;
    const onlyDirective = /^<!--directive:(\d+)-->$/.exec(md);
    const base = { heading: s.heading, ...(s.nav ? { nav_label: s.nav } : {}) };
    if (onlyDirective) {
      const d = directives[Number(onlyDirective[1])];
      if (d.name === 'faq') {
        blocks.push({ type: 'faq', ...base, faqs: parseFaq(d.inner) });
        continue;
      }
      if (d.name === 'video') {
        blocks.push({ type: 'media', ...base, media: [{ kind: 'video', video_url: d.args.url ?? '', alt: d.args.alt ?? s.heading, caption: d.args.caption ?? '' }] });
        continue;
      }
      if (d.name === 'parts') {
        blocks.push({ type: 'parts', ...base, parts: parseParts(d.inner) });
        continue;
      }
    }
    // بخش متنی: دستورهای درون‌متنی (callout، aside) جایگزین می‌شوند.
    let aside = '';
    const html = renderMarkdown(md, ctx).replace(/<!--directive:(\d+)-->/g, (_m, n) => {
      const d = directives[Number(n)];
      if (d.name === 'aside') {
        aside = renderMarkdown(d.inner, ctx).trim();
        return '';
      }
      if (['faq', 'video', 'parts'].includes(d.name)) {
        ctx.errors.push(`«:::${d.name}» (خط ${d.line}) باید تنها محتوای بخش «${s.heading || 'مقدمه'}» باشد — بخش ## جدا بسازید`);
        return '';
      }
      return directiveToHtml(d, ctx);
    });
    blocks.push({ type: 'text', ...base, body: html.trim(), ...(aside ? { aside } : {}) });
  }

  for (const g of meta.gallery ?? []) {
    if (g && typeof g === 'object') ctx.assets.push({ file: path.posix.normalize(String(g.file ?? '')), alt: String(g.alt ?? ''), role: 'gallery' });
  }

  return { file: opt.file ?? '', meta, blocks, assets: ctx.assets, errors: ctx.errors };
}

/**
 * ابعاد تصویر از سربرگ فایل (JPEG: نشانگر SOF، PNG: IHDR) — بی وابستگی تازه.
 * ⚠️ width/height روی <img> داخل متن لازم است: بدون آن مرورگر جای تصویر را نمی‌داند و متن زیرش می‌پرد (CLS)؛
 * افزونه (cyh_import_allowed_html) این دو ویژگی را عمداً مجاز کرده و فرانت‌اند نبودشان را هشدار می‌دهد.
 * @returns {{ width: number, height: number } | null}
 */
export function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}

/** فایل از دیسک؛ مسیر تصاویر نسبت به پوشه‌ی فایل؛ ابعاد تصاویر داخل متن تزریق می‌شود. */
export function compileFile(file) {
  const doc = compileContent(readFileSync(file, 'utf8'), { file });
  const dir = path.dirname(file);
  for (const a of doc.assets) {
    a.abs = path.join(dir, a.file);
    if (existsSync(a.abs)) {
      const size = imageSize(readFileSync(a.abs));
      if (size) Object.assign(a, size);
    }
  }
  doc.missingAssets = doc.assets.filter((a) => !existsSync(a.abs)).map((a) => a.file);
  for (const b of doc.blocks) {
    if (!b.body) continue;
    b.body = b.body.replace(/src="\{\{asset:([^}]+)\}\}"/g, (m, f) => {
      const a = doc.assets.find((x) => x.file === f && x.width);
      return a ? `${m} width="${a.width}" height="${a.height}"` : m;
    });
  }
  return doc;
}

/** همه‌ی متن قابل‌خواندن سند (برای شمارش واژه و جستجوی کلیدواژه). */
export function plainText(doc) {
  const parts = [];
  for (const b of doc.blocks) {
    if (b.heading) parts.push(b.heading);
    if (b.body) parts.push(b.body);
    if (b.aside) parts.push(b.aside);
    for (const f of b.faqs ?? []) parts.push(f.q, f.a);
    for (const p of b.parts ?? []) parts.push(p.name, p.reason);
  }
  return parts.join('\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
