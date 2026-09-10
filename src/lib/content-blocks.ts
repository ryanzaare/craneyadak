// src/lib/content-blocks.ts
// ---------------------------------------------------------------------------
// پالت بلوک محتوا — یک مدل برای برند، محصول و دسته.
//
// ═══════════════════════════════════════════════════════════════════════════
// اشتباه معماری‌ای که این ماژول جبرانش می‌کند
// ═══════════════════════════════════════════════════════════════════════════
// مدل قبلی برای هر موجودیت فیلد *اختصاصی* داشت. دماگ سری محصول دارد، پس
// فیلد «سری‌ها» ساخته شد. برند بعدی سری ندارد و چیز دیگری دارد، پس فیلد
// دیگری لازم می‌شد. و بعدی هم همین‌طور.
//
// نتیجه‌ی اجتناب‌ناپذیر: **هر محتوای تازه، یک تغییر در بک‌اند.** این پنل
// حرفه‌ای نیست؛ زنجیره‌ای از تک‌موردهاست که هر حلقه‌اش باگ تازه می‌آورد و
// سبک پنل را ناهمگون‌تر می‌کند.
//
// مدل درست وارونه‌ی آن است: یک **پالت ثابت از بلوک‌ها** که هر موجودیتی از
// آن استفاده می‌کند. «سری‌های دماگ» دیگر یک فیلد ویژه نیست — یک بلوکِ
// *جدول* است که کسی پرش کرده. برندی که سری ندارد، آن بلوک را اضافه
// نمی‌کند. برندی که ساختار تازه‌ای دارد، از همین پالت استفاده می‌کند.
//
// از این پس، افزودن محتوا هرگز نیازمند تغییر کد نیست.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا ریپیتر + منطق شرطی، و نه Flexible Content
// ═══════════════════════════════════════════════════════════════════════════
// Flexible Content در ACF دقیقاً «بلوک» است و در پنل زیباتر هم هست. اما در
// گراف‌کیوال به یک **union** با نام‌های تولیدشده تبدیل می‌شود
// (`...on BrandContentBlocksTextLayout`) که بین نسخه‌های افزونه تغییر
// می‌کند. در این پروژه، شکنندگی نام تایپ گراف‌کیوال سه بار صفحه را خالی
// کرده است.
//
// یک ریپیتر با فیلد `blockType` و منطق شرطی، در پنل همان تجربه را می‌دهد
// (فقط فیلدهای همان نوع دیده می‌شوند) ولی در گراف‌کیوال یک ساختار **تخت
// و پایدار** است. زیبایی کمتر، شکنندگی بسیار کمتر.
// ---------------------------------------------------------------------------

import { isWpConfigured, wpQueryPublic } from './wp';

export type BlockType = 'text' | 'table' | 'faq' | 'parts' | 'media';

export interface BlockTableRow {
  cells: string[];
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
}

const str = (v: unknown): string => {
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

const TYPES: BlockType[] = ['text', 'table', 'faq', 'parts', 'media'];

export function normalizeBlocks(raw: unknown): ContentBlock[] {
  return arr(raw)
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
      };
    })
    // بلوکی که هیچ محتوایی ندارد، یک ردیف فراموش‌شده است.
    .filter((b) => hasContent(b));
}

export function hasContent(b: ContentBlock): boolean {
  switch (b.type) {
    case 'text':  return b.bodyHtml !== '';
    case 'table': return b.rows.length > 0 && b.columns.length > 0;
    case 'faq':   return b.faqs.length > 0;
    case 'parts': return b.parts.length > 0;
    case 'media': return b.media.length > 0;
    default:      return false;
  }
}

/** قطعه‌ی مشترک کوئری — یک بار نوشته، همه‌جا استفاده. */
export const BLOCK_FIELDS = `
  contentBlocks {
    blockType heading needsReview
    body
    intro col1 col2 col3 col4 col5
    rows { c1 c2 c3 c4 c5 }
    faqs { question answer }
    parts { partName failureReason category { nodes { ... on CraneCategory { slug name } } } }
    media { kind videoUrl caption altText asset { node { sourceUrl altText mediaDetails { width height } } } }
  }
`;

/** همان قطعه، بدون فیلدهایی که بین نسخه‌های افزونه شکل‌شان فرق می‌کند. */
export const BLOCK_FIELDS_SAFE = `
  contentBlocks {
    blockType heading needsReview
    body
    intro col1 col2 col3 col4 col5
    rows { c1 c2 c3 c4 c5 }
    faqs { question answer }
    parts { partName failureReason }
  }
`;

type BrandPayload = {
  craneBrands: { nodes: { slug: string | null; contentBlocks: unknown }[] } | null;
};

let brandCache: Promise<Map<string, ContentBlock[]>> | null = null;

async function fetchBrandBlocks(): Promise<Map<string, ContentBlock[]>> {
  const map = new Map<string, ContentBlock[]>();
  if (!isWpConfigured()) return map;

  // نردبان دو پله‌ای: کامل، بعد امن. غنی‌سازی اختیاری — هرگز throw نمی‌کند.
  for (const fields of [BLOCK_FIELDS, BLOCK_FIELDS_SAFE]) {
    try {
      const data = await wpQueryPublic<BrandPayload>(
        `query BrandBlocks($first: Int!) { craneBrands(first: $first) { nodes { slug ${fields} } } }`,
        { first: 100 },
      );
      for (const node of data?.craneBrands?.nodes ?? []) {
        if (!node.slug) continue;
        const blocks = normalizeBlocks(node.contentBlocks);
        if (blocks.length) map.set(node.slug, blocks);
      }
      const total = [...map.values()].reduce((n, b) => n + b.length, 0);
      if (total > 0) console.info(`[blocks] ${total} بلوک روی ${map.size} برند.`);
      return map;
    } catch {
      // پله‌ی بعد
    }
  }
  return map;
}

export function getBrandBlocks(slug: string): Promise<ContentBlock[]> {
  brandCache ??= fetchBrandBlocks();
  return brandCache.then((m) => m.get(slug) ?? []);
}
