// src/lib/indexability.ts
// ---------------------------------------------------------------------------
// «آمادگی ایندکس» — تنها منبع تصمیم noindex برای محصول، دسته و برند (تصمیم کارفرما، ۱۸ مهر ۱۴۰۵):
//   • صفحه‌ی خالی/ناقص → noindex؛ به‌محض کامل‌شدن → *خودکار* ایندکس‌پذیر (build بعدی، بدون هیچ فهرست دستی).
// خالص و بدون وابستگی تا با ورودی خراب آزمون شود (indexability.test.mts).
//
// تعریف «کامل»:
//   محصول : کد فنی + برند + دست‌کم یک دسته + دست‌کم یک تصویر + متن توضیحی (خلاصه+متن) ≥ ۱۰۰ کاراکتر؛ و نمایشی نباشد.
//   دسته  : دست‌کم یک محصول *آماده*  یا  محتوای تخصصی نهایی ≥ ۳۰۰ کلمه (بلوک‌های بدون علامت «نیاز به بازبینی»).
//   برند  : دست‌کم یک محصول *آماده*  یا  پروفایل تخصصی نهایی ≥ ۱۵۰ کلمه.
// ⚠️ «محصول آماده» می‌شمرد، نه «هر محصولی»: محصول آزمایشی/ناقص یک دسته را ایندکس‌پذیر نمی‌کند.
// آستانه‌ها اینجا و فقط اینجا عوض می‌شوند.
// ---------------------------------------------------------------------------

export const THRESHOLDS = {
  productTextChars: 100,
  categoryWords: 300,
  brandWords: 150,
} as const;

export interface ProductLike {
  name?: string | null;
  sku?: string | null;
  brandSlug?: string | null;
  categorySlugs?: readonly string[] | null;
  images?: readonly unknown[] | null;
  summary?: string | null;
  bodyHtml?: string | null;
  isDemo?: boolean;
}

export interface Readiness {
  ready: boolean;
  /** دلیل‌های ناقص‌بودن (فارسی) — در لاگ build چاپ می‌شود. */
  missing: string[];
}

const stripTags = (s: string) =>
  s
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function productReadiness(p: ProductLike): Readiness {
  const missing: string[] = [];
  if (p.isDemo) missing.push('نمونه‌ی نمایشی (DEMO-)');
  if (!p.name?.trim()) missing.push('نام');
  if (!p.sku?.trim()) missing.push('کد فنی (SKU)');
  if (!p.brandSlug?.trim()) missing.push('برند');
  if (!p.categorySlugs?.length) missing.push('دسته');
  if (!p.images?.length) missing.push('تصویر');
  const text = stripTags(`${p.summary ?? ''} ${p.bodyHtml ?? ''}`);
  if (text.length < THRESHOLDS.productTextChars) missing.push(`متن توضیحی (${text.length} از ${THRESHOLDS.productTextChars} کاراکتر)`);
  return { ready: missing.length === 0, missing };
}

/** بلوک: فقط فیلدهای متنی شناخته‌شده؛ هر چیزی با needsReview=true شمرده نمی‌شود (پیش‌نویس است). */
export interface BlockLike {
  needsReview?: boolean;
  heading?: string;
  bodyHtml?: string;
  asideHtml?: string;
  intro?: string;
  calloutBody?: string;
  rows?: readonly { cells: readonly string[] }[];
  faqs?: readonly { question: string; answer: string }[];
  parts?: readonly { partName: string; failureReason: string }[];
  specs?: readonly { label: string; value: string }[];
}

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export function blocksWordCount(blocks: readonly BlockLike[] | null | undefined): number {
  let n = 0;
  for (const b of blocks ?? []) {
    if (b.needsReview) continue;
    const parts: string[] = [b.heading ?? '', stripTags(b.bodyHtml ?? ''), stripTags(b.asideHtml ?? ''), b.intro ?? '', b.calloutBody ?? ''];
    for (const r of b.rows ?? []) parts.push(r.cells.join(' '));
    for (const f of b.faqs ?? []) parts.push(f.question, f.answer);
    for (const x of b.parts ?? []) parts.push(x.partName, x.failureReason);
    for (const s of b.specs ?? []) parts.push(s.label, s.value);
    n += words(parts.join(' '));
  }
  return n;
}

export interface PageInput {
  readyProducts: number;
  contentWords: number;
  /** بازنویسی عمدی کارفرما (INDEX_EMPTY_CATEGORIES=1 برای دسته). */
  override?: boolean;
}

function pageReadiness(input: PageInput, minWords: number): Readiness {
  if (input.override) return { ready: true, missing: [] };
  const ready = input.readyProducts > 0 || input.contentWords >= minWords;
  return {
    ready,
    missing: ready ? [] : [`بدون محصول آماده و محتوای نهایی (${input.contentWords} از ${minWords} کلمه)`],
  };
}

export const categoryReadiness = (i: PageInput) => pageReadiness(i, THRESHOLDS.categoryWords);
export const brandReadiness = (i: PageInput) => pageReadiness(i, THRESHOLDS.brandWords);
