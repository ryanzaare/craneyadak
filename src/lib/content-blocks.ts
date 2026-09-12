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

import { isWpConfigured, wpQueryPublic, WpGraphQLError } from './wp';

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

/** ⚠️ این آرایه باید با choices در ACF و شاخه‌های ContentBlocks.astro یکی
 *  بماند. `check-architecture.mjs` واگرایی هر سه را می‌شکند. */
const TYPES: BlockType[] = ['text', 'table', 'faq', 'parts', 'media', 'specs', 'callout'];
const TONES: CalloutTone[] = ['danger', 'note', 'tip'];

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

        specs: arr(r.specs)
          .map((x) => ({ label: str(x.label), value: str(x.value), unit: str(x.unit) }))
          // مشخصه‌ی بدون مقدار، یک ردیف نیمه‌کاره است؛ روی صفحه «—» نشان
          // دادن بدتر از نبودنش است.
          .filter((x) => x.label !== '' && x.value !== ''),

        tone: (TONES.includes(str(r.tone) as CalloutTone) ? str(r.tone) : 'note') as CalloutTone,
        calloutBody: str(r.calloutBody),
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
    case 'specs': return b.specs.length > 0;
    case 'callout': return b.calloutBody !== '';
    default:      return false;
  }
}

/** قطعه‌ی مشترک کوئری — یک بار نوشته، همه‌جا استفاده. */
/*
 * قطعه‌ی مشترک کوئری.
 *
 * ⚠️ **دو سطح، نه یک سطح.** بیرونی نام *گروه* فیلد است، درونی نام
 * *ریپیتر* داخل آن.
 *
 * این تفاوت یک بار کل مدل محتوا را قطع کرد. گروه `brandFields` دوازده فیلد
 * مستقیم دارد، پس کوئری‌اش تک‌سطحی است:
 *
 *     brandFields { foundedYear headquarters ... }
 *
 * ولی گروه `contentBlocks` فقط **یک** فیلد دارد — ریپیتری به نام
 * `content_blocks`. پس:
 *
 *     contentBlocks { contentBlocks { blockType heading ... } }
 *     └── گروه       └── ریپیتر
 *
 * الگوی تک‌سطحی از گروه همسایه کپی شده بود و خطایش این بود:
 * «Cannot query field "blockType" on type "ContentBlocks"» — یعنی گروه پیدا
 * شده بود ولی فیلدها یک سطح پایین‌تر بودند.
 */
export const BLOCK_FIELDS = `
  contentBlocks {
    contentBlocks {
      blockType heading needsReview
      body
      intro col1 col2 col3 col4 col5
      rows { c1 c2 c3 c4 c5 }
      faqs { question answer }
      specs { label value unit }
      tone calloutBody
      parts { partName failureReason category { nodes { ... on CraneCategory { slug name } } } }
      media { kind videoUrl caption altText asset { node { sourceUrl altText mediaDetails { width height } } } }
    }
  }
`;

/** همان قطعه، بدون فیلدهایی که بین نسخه‌های افزونه شکل‌شان فرق می‌کند. */
export const BLOCK_FIELDS_SAFE = `
  contentBlocks {
    contentBlocks {
      blockType heading needsReview
      body
      intro col1 col2 col3 col4 col5
      rows { c1 c2 c3 c4 c5 }
      faqs { question answer }
      parts { partName failureReason }
    }
  }
`;

/*
 * یک واکشی‌کننده برای هر سه نوع موجودیت.
 *
 * ⚠️ عمداً *یک* تابع، نه سه تا. مدل قبلی دقیقاً به این دلیل از هم پاشید که
 * برای هر موجودیت مسیر جدا ساخته شد و آن مسیرها آرام‌آرام واگرا شدند.
 * اینجا فقط نام کوئری ریشه فرق می‌کند.
 */
type EntityPayload = { [k: string]: { nodes: { slug: string | null; contentBlocks: unknown }[] } | null };

const ROOTS = {
  brand: 'craneBrands',
  product: 'craneProducts',
  category: 'craneCategories',
} as const;

export type BlockEntity = keyof typeof ROOTS;

const caches: Partial<Record<BlockEntity, Promise<Map<string, ContentBlock[]>>>> = {};

async function fetchBlocks(entity: BlockEntity): Promise<Map<string, ContentBlock[]>> {
  const map = new Map<string, ContentBlock[]>();
  if (!isWpConfigured()) return map;
  const root = ROOTS[entity];

  /*
   * ⚠️ این تابع قبلاً «غنی‌سازی اختیاری» بود و در سکوت شکست می‌خورد. آن
   * الگو برای داده‌ی واقعاً اختیاری درست است — ولی بلوک‌ها دیگر اختیاری
   * نیستند، **کل مدل محتوا** هستند. وقتی این کوئری می‌افتاد، هر صفحه‌ی
   * برند و دسته بدون محتوای اصلی‌اش build می‌شد و build سبز می‌ماند.
   * یعنی راهی وجود داشت که ۷۲ صفحه‌ی «محتوای نازک» بی‌سروصدا منتشر شود.
   *
   * دو تفکیک لازم است و هیچ‌کدام قبلاً نبود:
   *
   *   • «کوئری موفق شد ولی محتوایی نیست» → طبیعی است (سایت تازه). هشدار.
   *   • «کوئری شکست خورد» → پیکربندی خراب است. باید build را بیندازد،
   *     چون بدیلش انتشار یک سایت بی‌محتواست.
   *
   * ⚠️ و نکته‌ی مهم‌تر: هر دو پله‌ی این «نردبان» ریشه‌ی یکسان
   * `contentBlocks` را می‌خواهند. اگر آن نام در اسکیما نباشد، هر دو پله
   * یکسان می‌افتند — یعنی نردبانی که برای این حالت هیچ محافظتی ندارد.
   * پس خطای هر پله جداگانه چاپ می‌شود تا معلوم باشد کدام فرض شکسته.
   */
  const failures: string[] = [];
  let schemaBroken = false;

  const rungs: [string, string][] = [
    ['کامل', BLOCK_FIELDS],
    ['امن', BLOCK_FIELDS_SAFE],
  ];

  for (const [rung, fields] of rungs) {
    try {
      const data = await wpQueryPublic<EntityPayload>(
        `query EntityBlocks($first: Int!) { ${root}(first: $first) { nodes { slug ${fields} } } }`,
        { first: 200 },
      );

      const nodes = data?.[root]?.nodes ?? [];
      for (const node of nodes) {
        if (!node.slug) continue;
        // ⚠️ `contentBlocks` بیرونی گروه است، درونی ریپیتر. اگر روزی ساختار
        //    گروه عوض شود و فیلدها مستقیم بیایند، این هر دو را می‌پذیرد
        //    به‌جای اینکه بی‌صدا خالی برگردد.
        const wrapper = node.contentBlocks as { contentBlocks?: unknown } | unknown[] | null;
        const raw = Array.isArray(wrapper) ? wrapper : (wrapper?.contentBlocks ?? null);
        const blocks = normalizeBlocks(raw);
        if (blocks.length) map.set(node.slug, blocks);
      }

      const total = [...map.values()].reduce((n, b) => n + b.length, 0);

      // همیشه گزارش می‌دهد — سکوت همان چیزی بود که اجازه داد این خرابی
      // یک build کامل را سبز رد کند.
      if (total > 0) {
        console.info(`[blocks] ${entity}: ${total} بلوک روی ${map.size} مورد (پله‌ی ${rung}).`);
      } else {
        console.warn(
          `[blocks] ⚠ ${entity}: کوئری جواب داد ولی هیچ بلوکی برنگشت ` +
            `(${nodes.length} ${root} خوانده شد). یا محتوایی وارد نشده، ` +
            `یا فیلد ACF «contentBlocks» روی این نوع محتوا فعال نیست.`,
        );
      }
      return map;
    } catch (err) {
      if (err instanceof WpGraphQLError) schemaBroken = true;
      failures.push(`پله‌ی «${rung}» → ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const detail = failures.map((f) => `        • ${f}`).join('\n');

  if (schemaBroken) {
    // شکست اسکیما یعنی پیکربندی، نه شبکه. اجازه نمی‌دهیم سایتِ بی‌محتوا
    // ساخته شود؛ خالی منتشر کردن از نساختن بدتر است.
    throw new Error(
      `[blocks] ❌ «${entity}»: هیچ پله‌ای از نردبان جواب نداد و خطا از نوع اسکیماست.\n` +
        `        هر صفحه‌ی ${entity} بدون محتوای اصلی‌اش build می‌شد، پس build عمداً متوقف شد.\n` +
        `${detail}\n` +
        `        بررسی کنید: گروه ACF «contentBlocks» روی این نوع محتوا فعال است و ` +
        `«Show in GraphQL» روشن است.`,
    );
  }

  console.warn(
    `[blocks] ⚠ «${entity}»: واکشی نشد (خطای شبکه یا وردپرس در دسترس نبود).\n${detail}`,
  );
  return map;
}

export function getBlocks(entity: BlockEntity, slug: string): Promise<ContentBlock[]> {
  caches[entity] ??= fetchBlocks(entity);
  return caches[entity]!.then((m) => m.get(slug) ?? []);
}

/** مشخصات فنیِ همه‌ی بلوک‌های `specs` → `additionalProperty` در اسکیمای محصول. */
export function specsToJsonLd(blocks: readonly ContentBlock[]): Record<string, string>[] {
  return blocks
    .filter((b) => b.type === 'specs')
    .flatMap((b) => b.specs)
    .map((sp) => ({
      '@type': 'PropertyValue',
      name: sp.label,
      value: sp.unit ? `${sp.value} ${sp.unit}` : sp.value,
    }));
}
