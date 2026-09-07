// src/lib/brand-profile.ts
// ---------------------------------------------------------------------------
// محتوای عمیق صفحه‌ی برند — از وردپرس، گروه ACF «پروفایل تخصصی برند».
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا این ماژول جدا از `brands.ts` است
// ═══════════════════════════════════════════════════════════════════════════
// `brands.ts` داده‌ی *ساختاری* برند را می‌دهد (نام، رنگ، کلاس) و در ده‌ها
// جای سایت استفاده می‌شود: هدر، فوتر، فیلترها، کارت محصول. آن کوئری باید
// سبک و مطمئن بماند.
//
// این ماژول داده‌ی *تحریریه‌ای* را می‌دهد که فقط یک صفحه لازمش دارد. اگر
// در همان کوئری ادغام می‌شد، هر بار که هدر رندر می‌شود، چند کیلوبایت متن
// راهنما هم بی‌مصرف واکشی می‌شد.
//
// همان تفکیکی که بین `categories.ts` و `category-content.ts` داریم.
// ---------------------------------------------------------------------------

import { isWpConfigured, wpQueryPublic } from './wp';
import { SHAPES } from './brand-queries.mjs';

/** مقادیر کنترل‌شده‌ی «وضعیت تأمین» — با choices در ACF یکی است. */
export type SupplyStatus = 'current' | 'supported' | 'equivalent' | null;

export interface BrandSeries {
  seriesName: string;
  equipmentType: string;
  capacityNote: string;
  /**
   * مهم‌ترین چیزی که خریدار می‌خواهد بداند: «هنوز می‌توانم قطعه بگیرم؟»
   * تا پیش از این، همین اطلاعات داخل متن آزادِ `notes` دفن بود.
   */
  supplyStatus: SupplyStatus;
  commonInIran: boolean;
  notes: string;
  needsReview: boolean;
}

export interface BrandPart {
  partName: string;
  /** اسلاگ دسته‌ی واقعی سایت — برای لینک داخلی. */
  categorySlug: string | null;
  categoryName: string | null;
  failureReason: string;
  needsReview: boolean;
}

export interface BrandTech {
  name: string;
  summary: string;
  whyItMatters: string;
  needsReview: boolean;
}

export interface BrandMedia {
  kind: 'image' | 'diagram' | 'video';
  url: string | null;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
  videoUrl: string | null;
}

export interface BrandFaq {
  question: string;
  answer: string;
  needsReview: boolean;
}

export interface BrandSource {
  title: string;
  url: string;
}

export interface BrandProfile {
  heroClaim: string | null;
  introHtml: string | null;
  foundedYear: string | null;
  headquarters: string | null;
  series: BrandSeries[];
  identificationHtml: string | null;
  iranPresenceHtml: string | null;
  commonParts: BrandPart[];
  technologies: BrandTech[];
  media: BrandMedia[];
  faqs: BrandFaq[];
  sources: BrandSource[];
  hasContent: boolean;
  pendingReview: number;
}

const EMPTY: BrandProfile = {
  heroClaim: null,
  introHtml: null,
  foundedYear: null,
  headquarters: null,
  series: [],
  identificationHtml: null,
  iranPresenceHtml: null,
  commonParts: [],
  technologies: [],
  media: [],
  faqs: [],
  sources: [],
  hasContent: false,
  pendingReview: 0,
};

// نردبان کوئری در `./brand-queries.mjs` است، نه اینجا — بالای همان فایل
// توضیح داده شده که چرا.

const str = (v: unknown): string => {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.length ? str(v[0]) : '';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['value', 'label', 'name']) if (k in o) return str(o[k]);
  }
  return '';
};

const bool = (v: unknown): boolean => v === true || v === 1 || v === '1';

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(str(v));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const rows = <T>(list: unknown, map: (r: Record<string, unknown>) => T, key: (t: T) => string): T[] =>
  (Array.isArray(list) ? list : [])
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
    .map(map)
    .filter((t) => key(t).length > 0);

/**
 * فیلد select ای‌سی‌اف → یکی از سه مقدار مجاز، یا null.
 *
 * ⚠️ هر چیز ناشناخته null می‌شود، نه «حدسِ نزدیک». اگر کسی در وردپرس
 * choices را عوض کند، نتیجه باید *نبودِ نشان* باشد نه نشانِ اشتباه —
 * «در تولید» نشان دادن برای سری‌ای که تولیدش متوقف شده، خریدار را به
 * سفارش اشتباه می‌برد.
 */
function supply(v: unknown): SupplyStatus {
  const s = str(v);
  return s === 'current' || s === 'supported' || s === 'equivalent' ? s : null;
}

/** شیء را از پوسته‌ی `{ node: … }` بیرون می‌کشد؛ اگر پوسته‌ای نبود، خودش. */
function unwrapNode(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  return o.node && typeof o.node === 'object' ? (o.node as Record<string, unknown>) : o;
}

/** فیلد taxonomy ACF — هر دو شکل connection و شیء مستقیم را می‌پذیرد. */
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

function normalize(raw: Record<string, unknown> | null): BrandProfile {
  if (!raw) return EMPTY;

  const p: BrandProfile = {
    heroClaim: str(raw.heroClaim) || null,
    introHtml: str(raw.intro) || null,
    foundedYear: str(raw.foundedYear) || null,
    headquarters: str(raw.headquarters) || null,

    series: rows(raw.series, (r) => ({
      seriesName: str(r.seriesName),
      equipmentType: str(r.equipmentType),
      capacityNote: str(r.capacityNote),
      supplyStatus: supply(r.supplyStatus),
      commonInIran: bool(r.commonInIran),
      notes: str(r.notes),
      needsReview: bool(r.needsReview),
    }), (t) => t.seriesName),

    identificationHtml: str(raw.identificationGuide) || null,
    iranPresenceHtml: str(raw.iranPresence) || null,

    commonParts: rows(raw.commonParts, (r) => {
      const term = firstTerm(r.category);
      return {
        partName: str(r.partName),
        categorySlug: term.slug,
        categoryName: term.name,
        failureReason: str(r.failureReason),
        needsReview: bool(r.needsReview),
      };
    }, (t) => t.partName),

    technologies: rows(raw.technologies, (r) => ({
      name: str(r.name),
      summary: str(r.summary),
      whyItMatters: str(r.whyItMatters),
      needsReview: bool(r.needsReview),
    }), (t) => t.name),

    media: rows(raw.media, (r) => {
      // فیلد Image در WPGraphQL-for-ACF v2 یک connection edge است
      // (`asset { node { … } }`) و در v1 خودِ MediaItem. نردبان کوئری هر دو
      // را امتحان می‌کند، پس اینجا هم باید هر دو شکل خوانده شود.
      const asset = unwrapNode(r.asset);
      const details = unwrapNode(asset?.mediaDetails);
      const kind = str(r.kind);
      return {
        kind: (kind === 'video' || kind === 'diagram' ? kind : 'image') as BrandMedia['kind'],
        url: asset ? str(asset.sourceUrl) || null : null,
        width: num(details?.width),
        height: num(details?.height),
        // alt صریح مقدم است؛ اگر نبود، alt خودِ فایل رسانه.
        alt: str(r.altText) || (asset ? str(asset.altText) : ''),
        caption: str(r.caption),
        videoUrl: str(r.videoUrl) || null,
      };
    // ویدیو بدون آدرس و تصویر بدون فایل، هر دو بی‌معنا هستند.
    }, (m) => (m.kind === 'video' ? m.videoUrl ?? '' : m.url ?? '')),

    faqs: rows(raw.faqs, (r) => ({
      question: str(r.question),
      answer: str(r.answer),
      needsReview: bool(r.needsReview),
    }), (t) => t.question),

    sources: rows(raw.sources, (r) => ({ title: str(r.title), url: str(r.url) }), (t) => t.url),

    hasContent: false,
    pendingReview: 0,
  };

  p.hasContent = Boolean(
    p.introHtml || p.identificationHtml || p.iranPresenceHtml ||
    p.series.length || p.commonParts.length || p.technologies.length || p.faqs.length
  );

  p.pendingReview =
    [...p.series, ...p.commonParts, ...p.technologies, ...p.faqs].filter((r) => r.needsReview).length;

  return p;
}

let cache: Promise<Map<string, BrandProfile>> | null = null;

async function fetchAll(): Promise<Map<string, BrandProfile>> {
  const map = new Map<string, BrandProfile>();
  if (!isWpConfigured()) return map;

  type Payload = {
    craneBrands: { nodes: { slug: string | null; brandProfile: Record<string, unknown> | null }[] } | null;
  };

  let data: Payload | null = null;
  let used: (typeof SHAPES)[number] | null = null;
  const failures: string[] = [];

  for (const shape of SHAPES) {
    try {
      data = await wpQueryPublic<Payload>(shape.query, { first: 100 });
      used = shape;
      break;
    } catch (error) {
      failures.push(`${shape.name}: ${(error instanceof Error ? error.message : String(error)).slice(0, 160)}`);
    }
  }

  // ⚠️ تنزل باید *بلند* باشد.
  //
  // نسخه‌ی قبل فقط نام شکل را چاپ می‌کرد و علت شکست را دور می‌ریخت مگر
  // اینکه *همه‌ی* شکل‌ها می‌افتادند. نتیجه: یک بار build روی «بدون رسانه»
  // فرود آمد، ۵ لینک داخلی از صفحه‌ی دماگ حذف شد، و هیچ‌کس تا هفته‌ها
  // نفهمید — چون لاگ فقط می‌گفت کدام شکل استفاده شد، نه اینکه چه چیزی
  // شکست و چه چیزی از دست رفت.
  if (used && used !== SHAPES[0]) {
    console.warn(
      `[brand] ⚠ کوئری کامل کار نکرد؛ «${used.name}» استفاده شد. شکل‌های شکست‌خورده:\n` +
        failures.map((f) => `     • ${f}`).join('\n'),
    );
  }

  if (!data) {
    // غنی‌سازی اختیاری: صفحه‌ی برند بدون این هم ساخته می‌شود، ولی ساکت نمی‌مانیم.
    console.warn(
      `\n🏷️  پروفایل برندها از وردپرس خوانده نشد — صفحات برند بدون محتوای عمیق ساخته می‌شوند.\n` +
        failures.map((f) => `     • ${f}`).join('\n') +
        `\n   بررسی کنید: افزونه‌ی کرین یدک ۱.۵.۰ فعال است و گروه «پروفایل تخصصی برند» در ACF دیده می‌شود.\n`
    );
    return map;
  }

  for (const node of data.craneBrands?.nodes ?? []) {
    if (node.slug) map.set(node.slug, normalize(node.brandProfile));
  }

  const withContent = [...map.values()].filter((p) => p.hasContent).length;
  const pending = [...map.entries()].filter(([, p]) => p.pendingReview > 0);

  console.info(`[brand] ${withContent} از ${map.size} برند پروفایل تخصصی دارند.`);

  // از دست رفتن لینک داخلی، «تنزل ملایم» نیست — ضرر سئویی مستقیم است و
  // باید عدد داشته باشد، نه یک جمله‌ی مبهم.
  if (used && !used.hasCategoryLink) {
    const lost = [...map.values()].reduce((n, p) => n + p.commonParts.length, 0);
    if (lost > 0) {
      console.warn(
        `[brand] 🔴 لینک دسته واکشی نشد — ${lost} لینک داخلی «برند ← دسته» روی صفحات برند وجود ندارد.\n` +
          `        کارت‌های «قطعات پرتقاضا» ساخته می‌شوند ولی به هیچ صفحه‌ای لینک نمی‌دهند.`,
      );
    }
  }

  if (pending.length) {
    console.warn(
      `[brand] ⚠ ${pending.reduce((n, [, p]) => n + p.pendingReview, 0)} ردیف «نیاز به بازبینی» دارد: ` +
        pending.map(([slug, p]) => `${slug}(${p.pendingReview})`).join('، ')
    );
  }

  return map;
}

export function getAllBrandProfiles(): Promise<Map<string, BrandProfile>> {
  cache ??= fetchAll();
  return cache;
}

export async function getBrandProfile(slug: string): Promise<BrandProfile> {
  return (await getAllBrandProfiles()).get(slug) ?? EMPTY;
}

export { EMPTY as EMPTY_BRAND_PROFILE };
