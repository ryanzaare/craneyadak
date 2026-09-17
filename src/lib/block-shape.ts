// src/lib/block-shape.ts
// ---------------------------------------------------------------------------
// شکل بلوک محتوا و نرمال‌سازی آن — **بدون هیچ وابستگی**.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا از content-blocks.ts جدا شد
// ═══════════════════════════════════════════════════════════════════════════
// این منطق یک تبدیل خالص است: داده‌ی خام گراف‌کیوال می‌گیرد، بلوک تمیز
// می‌دهد. ولی داخل فایلی زندگی می‌کرد که کلاینت وردپرس را import می‌کرد، و
// آن هم چیزهای دیگر را. نتیجه: برای آزمودنِ یک تابع خالص، باید کل گراف
// وابستگی‌ها بارگذاری می‌شد — یعنی عملاً آزمون‌ناپذیر بود.
//
// و دقیقاً همین‌جا بود که باگی چهار بلوک از هفت بلوک صفحه‌ی دماگ را بی‌صدا
// دور ریخت: `blockType` از WPGraphQL آرایه برمی‌گردد و اینجا رشته فرض شده
// بود. یک آزمون ساده با پاسخ واقعی، همان روز اول می‌گرفتش.
//
// پس این فایل عمداً هیچ import ندارد و هرگز نباید پیدا کند.
// ---------------------------------------------------------------------------

export type BlockType = 'text' | 'table' | 'faq' | 'parts' | 'media' | 'specs' | 'callout';
export type CalloutTone = 'danger' | 'note' | 'tip';

export interface BlockTableRow {
  cells: string[];
}
export interface BlockSpec {
  label: string;
  value: string;
  unit: string;
}

export interface BlockFaq {
  question: string;
  answer: string;
}
export interface BlockPart {
  partName: string;
  categorySlug: string | null;
  categoryName: string | null;
  failureReason: string;
}
export interface BlockMedia {
  kind: 'image' | 'diagram' | 'video';
  url: string | null;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
  videoUrl: string | null;
}

export interface ContentBlock {
  type: BlockType;
  heading: string;
  needsReview: boolean;
  /** شناسه‌ی لنگر برای ناوبری درون‌صفحه‌ای — از جایگاه ساخته می‌شود. */
  anchor: string;
  // متن
  bodyHtml: string;
  // جدول
  intro: string;
  columns: string[];
  rows: BlockTableRow[];
  // بقیه
  faqs: BlockFaq[];
  parts: BlockPart[];
  media: BlockMedia[];
  // مشخصات فنی
  specs: BlockSpec[];
  // هشدار
  tone: CalloutTone;
  calloutBody: string;
}

/* ⚠️ اینجا قبلاً `str`، `bool`، `num`، `unwrap`، `firstTerm` و `arr` کپی
   شده بودند — یعنی **دومین** لایه‌ی تبدیلِ مقادیر ACF در همین مخزن.

   `src/lib/acf.ts` دقیقاً برای پایان دادن به همین ساخته شد: «هر ماژول
   تبدیل خودش را نوشت و فقط یکی از شش‌تا درست بود». بعد همان فایل ساخته
   شد و بزرگ‌ترین مصرف‌کننده‌اش — همین ماژول — روی کپی خودش ماند. اگر
   روزی رفتار `acf.ts` عوض می‌شد، بلوک‌ها از آن بی‌خبر می‌ماندند.

   `acf.ts` هم هیچ وابستگی ندارد، پس این import آزمون‌پذیریِ این فایل را
   خراب نمی‌کند — همان دلیلی که این ماژول برایش جدا شد.

   ⚠️ پسوند `.ts` عمدی است. این ماژول باید مستقیم با `node` قابل اجرا باشد
   (آزمونش همین کار را می‌کند) و node بدون پسوند resolve نمی‌کند. قاعده‌ی
   پروژه: **هر ماژولی که آزمونِ مستقیم دارد، importهایش پسوند می‌گیرند.** */
import {
  acfText as str,
  acfBool as bool,
  acfNumber as num,
  acfNode as unwrap,
  acfFirstTerm as firstTerm,
  acfRows as arr,
} from './acf.ts';

/** ⚠️ این آرایه باید با choices در ACF و شاخه‌های ContentBlocks.astro یکی
 *  بماند. `check-architecture.mjs` واگرایی هر سه را می‌شکند. */
const TYPES: BlockType[] = ['text', 'table', 'faq', 'parts', 'media', 'specs', 'callout'];
const TONES: CalloutTone[] = ['danger', 'note', 'tip'];

export function normalizeBlocks(raw: unknown, label = ''): ContentBlock[] {
  const all = arr(raw)
    .map((r, i): ContentBlock => {
      const t = str(r.blockType) as BlockType;
      const type = TYPES.includes(t) ? t : 'text';

      // ⚠️ ستون خالی اصلاً وارد مدل نمی‌شود. یک ستونِ سراسر «—» فضا
      // می‌گیرد، به بازدیدکننده حس خرابی می‌دهد و چیزی نمی‌گوید — همان
      // چیزی که یک بار در جدول سری‌های دماگ اتفاق افتاد.
      const rawCols = [r.col1, r.col2, r.col3, r.col4, r.col5].map(str);
      const keep = rawCols.map((c, n) => (c !== '' ? n : -1)).filter((n) => n >= 0);

      const rows = arr(r.rows)
        .map((row) => ({ cells: keep.map((n) => str(row[`c${n + 1}`])) }))
        .filter((row) => row.cells.some((c) => c !== ''));

      return {
        type,
        heading: str(r.heading),
        needsReview: bool(r.needsReview),
        anchor: `block-${i + 1}`,
        bodyHtml: str(r.body),
        intro: str(r.intro),
        columns: keep.map((n) => rawCols[n]),
        rows,
        faqs: arr(r.faqs)
          .map((f) => ({ question: str(f.question), answer: str(f.answer) }))
          .filter((f) => f.question !== ''),
        parts: arr(r.parts)
          .map((p) => {
            const term = firstTerm(p.category);
            return {
              partName: str(p.partName),
              categorySlug: term.slug,
              categoryName: term.name,
              failureReason: str(p.failureReason),
            };
          })
          .filter((p) => p.partName !== ''),
        media: arr(r.media)
          .map((m) => {
            const asset = unwrap(m.asset);
            const details = unwrap(asset?.mediaDetails);
            const kind = str(m.kind);
            return {
              kind: (kind === 'video' || kind === 'diagram' ? kind : 'image') as BlockMedia['kind'],
              url: asset ? str(asset.sourceUrl) || null : null,
              width: num(details?.width),
              height: num(details?.height),
              alt: str(m.altText) || (asset ? str(asset.altText) : ''),
              caption: str(m.caption),
              videoUrl: str(m.videoUrl) || null,
            };
          })
          .filter((m) => (m.kind === 'video' ? m.videoUrl : m.url)),

        specs: arr(r.specs)
          .map((x) => ({ label: str(x.label), value: str(x.value), unit: str(x.unit) }))
          // مشخصه‌ی بدون مقدار، یک ردیف نیمه‌کاره است؛ روی صفحه «—» نشان
          // دادن بدتر از نبودنش است.
          .filter((x) => x.label !== '' && x.value !== ''),

        tone: (TONES.includes(str(r.tone) as CalloutTone) ? str(r.tone) : 'note') as CalloutTone,
        calloutBody: str(r.calloutBody),
      };
    });

  /*
   * بلوکی که هیچ محتوایی ندارد، یک ردیف فراموش‌شده است و نباید رندر شود.
   *
   * ⚠️ ولی «دور ریختن در سکوت» همان چیزی بود که گذاشت ۴ بلوک از ۷ بلوک
   * دماگ ناپدید شوند و build سبز بماند. حذف درست است؛ نگفتنش نه.
   */
  const kept = all.filter((b) => hasContent(b));

  if (label && kept.length < all.length) {
    const lost = all
      .filter((b) => !hasContent(b))
      .map((b) => `${b.type}${b.heading ? ` «${b.heading}»` : ''}`);
    console.warn(
      `[blocks] ⚠ ${label}: ${all.length - kept.length} بلوک از ${all.length} بلوک ` +
        `چون خالی بودند رندر نمی‌شوند: ${lost.join('، ')}`,
    );
  }

  return kept;
}

export function hasContent(b: ContentBlock): boolean {
  switch (b.type) {
    case 'text':  return b.bodyHtml !== '';
    case 'table': return b.rows.length > 0 && b.columns.length > 0;
    case 'faq':   return b.faqs.length > 0;
    case 'parts': return b.parts.length > 0;
    case 'media': return b.media.length > 0;
    case 'specs': return b.specs.length > 0;
    case 'callout': return b.calloutBody !== '';
    default:      return false;
  }
}
