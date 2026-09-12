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

/**
 * ⚠️ فیلد `select` در ACF حتی وقتی `multiple = 0` است، از WPGraphQL به شکل
 * **آرایه** برمی‌گردد: `"blockType": ["text"]`.
 *
 * این یک تفاوت کوچک نبود. `str()` برای آرایه رشته‌ی خالی برمی‌گرداند، پس
 * `TYPES.includes('')` رد می‌شد و **هر بلوکی** به `text` تنزل پیدا می‌کرد.
 * بعد `hasContent` از بلوک متنی «بدنه» می‌خواست، و جدول و قطعات و پرسش‌ها
 * بدنه ندارند — پس بی‌صدا دور ریخته می‌شدند.
 *
 * نتیجه روی سایت دماگ: از ۷ بلوک فقط ۳ تا رندر شد و هیچ خطایی نبود. داده
 * در وردپرس کامل و سالم بود؛ فقط یک جفت براکت آن را نامرئی کرده بود.
 *
 * پس هر مقدار تک‌عضویِ آرایه‌ای، همان عضوش خوانده می‌شود. این برای
 * `blockType`، `tone` و `kind` لازم است و برای بقیه بی‌ضرر.
 */
const str = (v: unknown): string => {
  if (Array.isArray(v)) return v.length ? str(v[0]) : '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  return '';
};
const bool = (v: unknown) => v === true || v === 1 || v === '1';
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(str(v));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** فیلد Image در ACF: v2 پوسته‌ی `node` دارد، v1 ندارد. */
const unwrap = (v: unknown): Record<string, unknown> | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  return o.node && typeof o.node === 'object' ? (o.node as Record<string, unknown>) : o;
};

/** فیلد Taxonomy: گاهی connection، گاهی شیء مستقیم. */
function firstTerm(v: unknown): { slug: string | null; name: string | null } {
  const list = Array.isArray(v)
    ? v
    : v && typeof v === 'object' && Array.isArray((v as { nodes?: unknown[] }).nodes)
      ? (v as { nodes: unknown[] }).nodes
      : v && typeof v === 'object'
        ? [v]
        : [];
  const t = list.find((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object');
  return { slug: t ? str(t.slug) || null : null, name: t ? str(t.name) || null : null };
}

const arr = (v: unknown): Record<string, unknown>[] =>
  (Array.isArray(v) ? v : []).filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object');

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
