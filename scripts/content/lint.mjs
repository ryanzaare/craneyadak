// scripts/content/lint.mjs
// ---------------------------------------------------------------------------
// سیستم محتوا — مرحله‌ی ۲: هر فایل محتوا پیش از انتشار سنجیده می‌شود. خطا = انتشار نمی‌شود.
//
// قواعد از چهار منبع می‌آیند و هر کدام کنار قاعده نوشته شده:
//   • CLAUDE.md: قاعده‌ی ۲ (هیچ عدد/ادعای بی‌منبع)، قاعده‌ی ۳ (هرگز «نمایندگی رسمی»)، نشانی با «/» پایانی.
//   • src/lib/seo-meta.ts: سقف عنوان ۶۰ و توضیح ۱۵۸ نویسه — همان سقفی که Layout می‌برد.
//   • خواسته‌های کارفرما (۲۷ آبان ۱۴۰۵): عناصر بصری، ساختار بلوکی، پرهیز از هم‌نوع‌خواری (cannibalization)،
//     مقاله‌های آموزشی با لینک داخلی.
//   • پیامدهای دیده‌شده: ⚠️ تصویر بی alt، عنوان H1 تکراری در متن، Ni-MH/ادعای بی‌منبع در متن قبلی SAGA1-L12.
//
// ⚠️ «هم‌نوع‌خواری» این‌جا فقط یک چیز را می‌سنجد که از فایل قابل‌سنجش است: دو صفحه با یک کلیدواژه‌ی اصلی. هم‌پوشانی
// معنایی بین نیت‌ها (مثلاً «قیمت» و «خرید») را ماشین نمی‌فهمد — آن تصمیم نویسنده است و در frontmatter (`intent`) ثبت می‌شود.
// ---------------------------------------------------------------------------
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { KINDS, plainText } from './compile.mjs';

/* ───────── «هرگز تکرار» (کارفرما، ۲۹ آبان ۱۴۰۵) ─────────
   «هیچ چیز تکرار نشود؛ عکس‌هایی که داخل متن آمده‌اند از گالری محصول بروند» و «اگر تضمین کنی تکراری نباشد، ریموت،
   فرستنده و گیرنده را جدا می‌فروشم». تضمین = آزمون، نه قول. سه قاعده (هر سه خطا):
   ۱) image-dup: یک تصویر (همان فایل یا همان بایت‌ها) دو بار در یک صفحه — گالری + متن، یا دو بار در متن.
   ۲) cover-dup: تصویر اول گالری (og:image و تنها image در JSON-LD) دو محصول یکی است — گوگل دو صفحه را یک کالا می‌بیند.
   ۳) text-dup: ≥ ۱۵٪ از عبارت‌های ۸ واژه‌ای یک صفحه عیناً در صفحه‌ی دیگر — محتوای تکراری بین فرستنده/گیرنده/ست.
      ⚠️ چرا ۸ واژه و ۱۵٪: عبارت کوتاه («ریموت کنترل ساگا L12») ناگزیر تکرار می‌شود؛ ۸ واژه‌ی پشت سر هم یعنی جمله‌ی
      کپی‌شده. آستانه روی دو متن مستقل واقعی (محصول L12 و مقاله‌ی جفت کردن) صفر است. */
export function shingles(text, n = 8) {
  const w = norm(text).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
}
/** سهم عبارت‌های مشترک نسبت به متن کوتاه‌تر (۰ تا ۱). */
export function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let n = 0;
  for (const s of small) if (big.has(s)) n++;
  return n / small.size;
}
export const TEXT_DUP_MAX = 0.15;
/** اثر انگشت فایل تصویر (یا نام، اگر فایل نیست — نبودش را قاعده‌ی asset-missing جدا می‌گیرد). */
export function assetKey(a) {
  return a.abs && existsSync(a.abs) ? createHash('sha256').update(readFileSync(a.abs)).digest('hex') : `name:${a.file}`;
}

export const SITE_SUFFIX = ' | کرین یدک';
export const TITLE_MAX = 60;
export const DESC_MIN = 70;
export const DESC_MAX = 158;
const INTENTS = ['transactional', 'informational', 'commercial', 'navigational'];
const FORBIDDEN = [/نمایند(?:گی|ه|ه‌ی)\s*(?:رسمی|مجاز|انحصاری)/, /official\s+(?:dealer|distributor|representative)/i];

/** یکسان‌سازی برای مقایسه: ی/ک عربی، نیم‌فاصله، فاصله‌ی چندگانه، حروف لاتین کوچک، ارقام فارسی ← لاتین. */
export function norm(s) {
  return String(s ?? '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[‌‏‎]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const includesKw = (hay, kw) => norm(hay).includes(norm(kw));

/**
 * @param {ReturnType<import('./compile.mjs').compileContent>} doc
 * @param {{ registry?: {slug:string, kind:string, primaryKeyword:string, file:string}[], routes?: Set<string> }} [ctx]
 * @returns {{ level: 'error'|'warn', rule: string, msg: string }[]}
 */
export function lintDoc(doc, ctx = {}) {
  const out = [];
  const err = (rule, msg) => out.push({ level: 'error', rule, msg });
  const warn = (rule, msg) => out.push({ level: 'warn', rule, msg });
  const m = doc.meta ?? {};

  for (const e of doc.errors ?? []) err('syntax', e);

  // ── هویت ──
  if (!KINDS.includes(m.kind)) err('kind', `kind باید یکی از ${KINDS.join('، ')} باشد (است: «${m.kind ?? ''}»)`);
  if (!m.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(m.slug)) err('slug', `slug لاتین کوچک با خط تیره لازم است (است: «${m.slug ?? ''}»)`);
  if (!m.title) err('title', 'title ندارد');
  if (m.intent && !INTENTS.includes(m.intent)) err('intent', `intent باید یکی از ${INTENTS.join('، ')} باشد`);
  if (!m.intent) err('intent', 'intent (نیت جستجو) ثبت نشده — بدون آن هم‌نوع‌خواری قابل‌بررسی نیست');

  // ── عنوان و توضیح (seo-meta.ts) ──
  const fullTitle = `${m.title ?? ''}${SITE_SUFFIX}`;
  if (m.title && fullTitle.length > TITLE_MAX) warn('title-length', `عنوان با «${SITE_SUFFIX.trim()}» ${fullTitle.length} نویسه است (> ${TITLE_MAX}) — نام سایت از نتیجه‌ی گوگل حذف می‌شود`);
  const desc = m.excerpt ?? '';
  if (!desc) err('excerpt', 'excerpt (توضیح متا) ندارد');
  else if (desc.length > DESC_MAX) err('excerpt-length', `excerpt ${desc.length} نویسه است (> ${DESC_MAX}) — گوگل می‌بُرد`);
  else if (desc.length < DESC_MIN) warn('excerpt-length', `excerpt ${desc.length} نویسه است (< ${DESC_MIN}) — فضای نتیجه‌ی جستجو هدر می‌رود`);

  // ── کلیدواژه ──
  const kw = m.primaryKeyword;
  if (!kw) err('keyword', 'primaryKeyword ندارد');
  else {
    if (m.title && !includesKw(m.title, kw)) err('keyword-title', `کلیدواژه‌ی اصلی «${kw}» در title نیست`);
    if (desc && !includesKw(desc, kw)) warn('keyword-excerpt', `کلیدواژه‌ی اصلی «${kw}» در excerpt نیست`);
    const firstText = doc.blocks.find((b) => b.type === 'text' && b.body)?.body.replace(/<[^>]+>/g, ' ') ?? '';
    const first100 = firstText.split(/\s+/).filter(Boolean).slice(0, 100).join(' ');
    if (!includesKw(first100, kw)) err('keyword-intro', `کلیدواژه‌ی اصلی «${kw}» در ۱۰۰ واژه‌ی اول متن نیست`);
    if (!doc.blocks.some((b) => b.heading && includesKw(b.heading, kw))) warn('keyword-heading', `کلیدواژه‌ی اصلی در هیچ عنوان ## نیامده`);
  }

  // ── هم‌نوع‌خواری ──
  for (const other of ctx.registry ?? []) {
    if (other.file === doc.file || !kw || !other.primaryKeyword) continue;
    if (norm(other.primaryKeyword) === norm(kw)) err('cannibalization', `کلیدواژه‌ی اصلی «${kw}» از قبل مال ${other.kind}:${other.slug} است — دو صفحه برای یک جستجو با هم رقابت می‌کنند`);
  }
  if (m.slug && (ctx.registry ?? []).some((o) => o.file !== doc.file && o.slug === m.slug && o.kind === m.kind)) err('slug-dup', `slug «${m.slug}» تکراری است`);

  // ── عنوان‌ها ──
  const heads = doc.blocks.map((b) => b.heading).filter(Boolean);
  const seen = new Set();
  for (const h of heads) {
    if (seen.has(norm(h))) err('heading-dup', `عنوان «${h}» تکراری است`);
    seen.add(norm(h));
    if (h.length > 80) warn('heading-length', `عنوان «${h.slice(0, 30)}…» ${h.length} نویسه است — برای ناوبری {nav="…"} بدهید`);
  }
  if (heads.length < 2) warn('structure', 'کمتر از ۲ بخش ## — ساختار بلوکی ندارد');

  // ── بلوک‌ها ──
  doc.blocks.forEach((b, i) => {
    const where = `بلوک ${i + 1}${b.heading ? ` «${b.heading}»` : ''}`;
    if (b.type === 'text' && !b.body) err('empty-block', `${where} خالی است`);
    if (b.type === 'faq') {
      if (!b.faqs.length) err('faq', `${where}: هیچ پرسشی ندارد`);
      for (const f of b.faqs) {
        if (!f.a) err('faq', `${where}: پرسش «${f.q}» پاسخ ندارد (FAQ بی‌پاسخ نقض راهنمای گوگل است)`);
        if (!/[؟?]$/.test(f.q)) warn('faq', `${where}: پرسش «${f.q}» با علامت سؤال تمام نمی‌شود`);
      }
    }
    if (b.type === 'media') {
      for (const md of b.media) if (md.kind === 'video' && !/^https:\/\/(www\.)?(aparat\.com|youtube\.com|youtu\.be)\//.test(md.video_url)) err('video', `${where}: نشانی ویدیو باید آپارات یا یوتیوب با https باشد`);
    }
    if (b.type === 'parts' && !b.parts.length) err('parts', `${where}: قطعه‌ای ندارد`);
  });

  // ── تصاویر ──
  const inline = doc.assets.filter((a) => a.role === 'inline');
  const gallery = doc.assets.filter((a) => a.role === 'gallery');
  for (const a of doc.assets) {
    if (!a.alt) err('alt', `تصویر ${a.file} متن جایگزین (alt) ندارد`);
    else if (norm(a.alt) === norm(a.file.split('/').pop().replace(/\.\w+$/, ''))) err('alt', `alt تصویر ${a.file} همان نام فایل است`);
    else if (a.alt.length > 125) warn('alt', `alt تصویر ${a.file} بیش از ۱۲۵ نویسه است`);
    if (!/\.(jpe?g|png|webp|avif)$/i.test(a.file)) err('asset-type', `${a.file}: فقط jpg/png/webp/avif`);
    // visual-identity-guide.md §1: ضلع بلند حداکثر ۱۶۰۰px پیش از بارگذاری (build خودش AVIF می‌سازد).
    if (a.width && Math.max(a.width, a.height) > 1600) warn('asset-size', `${a.file} ${a.width}×${a.height} — ضلع بلند بیش از ۱۶۰۰px`);
  }
  for (const f of doc.missingAssets ?? []) err('asset-missing', `فایل تصویر ${f} کنار محتوا نیست`);
  {
    const seen = new Map();
    for (const a of doc.assets) {
      const k = assetKey(a);
      const prev = seen.get(k);
      if (prev)
        err('image-dup', `تصویر ${a.file} (${a.role === 'gallery' ? 'گالری' : 'متن'}) تکرار ${prev.file} (${prev.role === 'gallery' ? 'گالری' : 'متن'}) است — هر تصویر یک بار در صفحه؛ تصویر داخل متن از گالری برود`);
      else seen.set(k, a);
    }
  }
  const hasTable = doc.blocks.some((b) => /<table/.test(b.body ?? '') || b.type === 'table');
  if (!inline.length && !hasTable && !doc.blocks.some((b) => b.type === 'media')) err('visual', 'هیچ تصویر، جدول یا ویدیویی در متن نیست (قاعده‌ی کارفرما: عناصر بصری)');

  // ── لینک‌های داخلی ──
  const html = doc.blocks.map((b) => `${b.body ?? ''}${b.aside ?? ''}`).join('');
  const internal = [...html.matchAll(/href="(\/[^"]*)"/g)].map((x) => x[1]);
  for (const href of internal) {
    const p = href.split(/[?#]/)[0];
    if (!p.endsWith('/')) err('link-slash', `لینک ${href} «/» پایانی ندارد (CLAUDE.md: همه‌ی نشانی‌ها با «/»)`);
    else if (ctx.routes && !ctx.routes.has(p)) warn('link-target', `لینک ${href} به صفحه‌ای که در سایت یا مخزن محتوا نیست`);
  }
  if (m.kind === 'article') {
    if (internal.length < 3) err('internal-links', `مقاله ${internal.length} لینک داخلی دارد — دست‌کم ۳ (به محصول، دسته یا مقاله‌ی دیگر)`);
    if (!internal.some((h) => /^\/(products|categories)\//.test(h))) err('internal-links', 'مقاله به هیچ محصول یا دسته‌ای لینک نمی‌دهد');
  }

  // ── راستی (قاعده‌ی ۲ و ۳) ──
  const text = plainText(doc);
  if (/🔶/.test(text)) err('unverified', 'نشان 🔶 (مورد تأییدنشده) در متن مانده — پیش از انتشار تأیید یا حذف شود');
  for (const re of FORBIDDEN) if (re.test(text) || re.test(m.title ?? '') || re.test(desc)) err('dealer-claim', 'ادعای نمایندگی رسمی/مجاز (CLAUDE.md قاعده‌ی ۳)');
  if (['product', 'article'].includes(m.kind) && !(Array.isArray(m.sources) && m.sources.length)) err('sources', 'sources (منبع اعداد و ادعاها) خالی است — قاعده‌ی ۲');

  // ── محصول ──
  if (m.kind === 'product') {
    if (!m.sku) warn('product', 'sku ندارد');
    // برچسب اصالت (۲۹ آبان ۱۴۰۵): ادعای تجاری کارفرما؛ فقط دو مقدار افزونه (cyh_authenticity_choices). نبودش = هشدار، چون
    // کارت و صفحه‌ی محصول بی برچسب «اصلی» منتشر می‌شود (فرستنده و گیرنده‌ی L12).
    if (m.authenticity === undefined) warn('authenticity', 'authenticity (original یا non_original) ندارد — برچسب «اصلی» نمایش داده نمی‌شود');
    else if (!['original', 'non_original'].includes(m.authenticity)) err('authenticity', `authenticity «${m.authenticity}» مجاز نیست — original یا non_original`);
    if (!m.brand) err('product', 'brand (اسلاگ برند) ندارد');
    if (!Array.isArray(m.categories) || !m.categories.length) err('product', 'categories (اسلاگ دسته) ندارد');
    if (!gallery.length) err('gallery', 'gallery خالی است — محصول بی‌تصویر noindex می‌ماند');
    // ⚠️ کارفرما (۲ آذر ۱۴۰۵): «گفته بودم هر محصول باید عکس، نمودار و جدول داخل متن داشته باشد؛ چرا برای L10 نه؟». L10
    // با چند جدول ولی بی هیچ تصویر داخل متن منتشر شد — قاعده فقط «یک عنصر بصری» می‌خواست. حالا محصول هر دو را لازم دارد.
    if (!inline.length) err('product-visual', 'محصول هیچ تصویر یا نمودار داخل متن ندارد — دست‌کم یکی کنار بخش مربوط');
    if (!hasTable) err('product-visual', 'محصول هیچ جدولی در متن ندارد — دست‌کم یک جدول (مقایسه، سازگاری، ترمینال…)');
    for (const s of m.specs ?? []) if (!s?.label || !s?.value) err('specs', `ردیف مشخصه‌ی ناقص: ${JSON.stringify(s)}`);
  }

  // ── تکرار بین صفحه‌ها ──
  const mine = shingles(text);
  const cover = m.kind === 'product' ? gallery[0] && assetKey(gallery[0]) : null;
  for (const o of ctx.registry ?? []) {
    if (o.file === doc.file) continue;
    if (o.shingles) {
      const r = overlap(mine, o.shingles);
      if (r >= TEXT_DUP_MAX) err('text-dup', `${Math.round(r * 100)}٪ عبارت‌های ۸ واژه‌ای با ${o.file} یکی است (سقف ${TEXT_DUP_MAX * 100}٪) — متن هر صفحه باید خودش باشد`);
    }
    if (cover && o.cover && o.cover === cover) err('cover-dup', `تصویر اول گالری با ${o.file} یکی است — og:image و image در JSON-LD هر محصول باید یکتا باشد`);
  }

  const words = text.split(/\s+/).filter(Boolean).length;
  if (m.kind === 'article' && words < 600) warn('length', `مقاله ${words} واژه است — برای راهنمای آموزشی کوتاه است`);

  return out;
}
