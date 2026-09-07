// src/lib/category-content.ts
// ---------------------------------------------------------------------------
// واکشی محتوای سئوی دسته‌بندی از وردپرس (ترم‌های `crane_category`).
//
// ⚠️ اصلاح یک اشتباه معماری: نسخه‌ی اول این محتوا به‌صورت هاردکد داخل مخزن
// Astro نوشته شده بود. این دقیقاً ناقض دلیل انتخاب Headless WordPress بود —
// اگر مدیر محتوا برای اصلاح یک جمله به مخزن کد و یک بیلد دستی نیاز داشته
// باشد، عملاً CMS وجود ندارد. حالا کل ساختار (مقدمه، جدول نشانه‌ها، علت‌ها،
// چک‌لیست، جدول جنس، بازرسی، پرسش‌ها، استانداردها) فیلد ACF روی خود ترم
// دسته‌بندی است و از پنل وردپرس ویرایش می‌شود. فرانت‌اند فقط می‌خواند.
// ---------------------------------------------------------------------------
import { wpQueryPublic, isWpConfigured } from './wp';

export interface ReviewFlagged {
  /** تا وقتی true باشد، در حالت CONTENT_REVIEW با نشان زرد رندر می‌شود. */
  needsReview: boolean;
}

export interface SymptomRow extends ReviewFlagged {
  symptom: string;
  cause: string;
  urgency: string;
}

export interface MaterialRow extends ReviewFlagged {
  name: string;
  advantage: string;
  limitation: string;
  suitableFor: string;
}

export interface InspectionRow extends ReviewFlagged {
  type: string;
  interval: string;
  checks: string;
}

export interface FaqRow extends ReviewFlagged {
  question: string;
  answer: string;
}

export interface TextRow extends ReviewFlagged {
  text: string;
}

export interface StandardRow {
  code: string;
  title: string;
}

/** برند شاخص یک دسته — از فیلد Relationship روی ترم. */
export interface TopBrand {
  title: string;
  slug: string;
}

export interface CategoryContent {
  introHtml: string | null;
  /** راهنمای محاسبات و ظرفیت‌سنجی — HTML. */
  engineeringGuideHtml: string | null;
  /** ۲ تا ۴ برند شاخصِ همین دسته. */
  topBrands: TopBrand[];
  /** صنایعی که این دسته بیشترین کاربرد را در آن‌ها دارد. */
  targetIndustries: string[];
  symptoms: SymptomRow[];
  causes: TextRow[];
  selectionChecklist: TextRow[];
  materials: MaterialRow[];
  inspection: InspectionRow[];
  faqs: FaqRow[];
  standards: StandardRow[];
  /** آیا اصلاً محتوایی برای این دسته ثبت شده است؟ */
  hasContent: boolean;
  /** تعداد ردیف‌هایی که هنوز نیاز به بازبینی دارند. */
  pendingReview: number;
}

const EMPTY: CategoryContent = {
  introHtml: null,
  engineeringGuideHtml: null,
  topBrands: [],
  targetIndustries: [],
  symptoms: [],
  causes: [],
  selectionChecklist: [],
  materials: [],
  inspection: [],
  faqs: [],
  standards: [],
  hasContent: false,
  pendingReview: 0,
};

/**
 * فیلدهای مشترک هر دو شکل کوئری.
 *
 * `topBrands` عمداً اینجا نیست — شکل خروجی فیلد Relationship بین نسخه‌های
 * «WPGraphQL for ACF» فرق می‌کند و باید جداگانه امتحان شود.
 */
const COMMON_FIELDS = `
  seoIntro
  engineeringGuide
  targetIndustries
  symptoms { symptom cause urgency needsReview }
  causes { text needsReview }
  selectionChecklist { text needsReview }
  materials { name advantage limitation suitableFor needsReview }
  inspection { type interval checks needsReview }
  faqs { question answer needsReview }
  standards { code title }
`;

/**
 * ⚠️ چرا کوئری چندشکلی است
 *
 * فیلد Relationship در «WPGraphQL for ACF» نسخه‌ی ۲ به‌صورت یک connection
 * برمی‌گردد (`topBrands { nodes { … } }`) اما در نسخه‌های قدیمی‌تر یک
 * فهرست مستقیم است (`topBrands { … on CraneBrand { … } }`). اگر شکل اشتباه
 * را بفرستیم، کل کوئری خطا می‌دهد و **همه‌ی** محتوای دسته‌ها از دست می‌رود،
 * نه فقط برندها.
 *
 * دقیقاً همین الگو یک‌بار در `site-options.ts` لازم شد. پس همان درس:
 * شکل‌ها را به‌ترتیب امتحان کن، و اگر همه شکست خوردند بدون برند ادامه بده.
 */
const QUERY_SHAPES = [
  {
    name: 'topBrands.nodes',
    query: `query CategoryContent($first: Int!) {
      craneCategories(first: $first) { nodes { slug categoryContent {
        ${COMMON_FIELDS}
        topBrands { nodes { ... on CraneBrand { title slug } } }
      } } }
    }`,
  },
  {
    name: 'topBrands inline',
    query: `query CategoryContent($first: Int!) {
      craneCategories(first: $first) { nodes { slug categoryContent {
        ${COMMON_FIELDS}
        topBrands { ... on CraneBrand { title slug } }
      } } }
    }`,
  },
  {
    // آخرین پناهگاه: بدون برند. محتوای دسته مهم‌تر از یک فهرست برند است.
    name: 'no topBrands',
    query: `query CategoryContent($first: Int!) {
      craneCategories(first: $first) { nodes { slug categoryContent {
        ${COMMON_FIELDS}
      } } }
    }`,
  },
];

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

// ACF true_false از طریق GraphQL گاهی boolean و گاهی 0/1 برمی‌گردد.
const bool = (v: unknown): boolean => v === true || v === 1 || v === '1';

/** ردیف‌های خالی (که ادمین اضافه کرده و پر نکرده) نباید رندر شوند. */
const rows = <T>(list: unknown, map: (r: Record<string, unknown>) => T, key: (t: T) => string): T[] =>
  (Array.isArray(list) ? list : [])
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
    .map(map)
    .filter((t) => key(t).length > 0);

/** فهرست رشته‌ای — چک‌باکس ACF آرایه برمی‌گرداند، ولی گاهی رشته‌ی تکی. */
const strList = (v: unknown): string[] => {
  if (typeof v === 'string') return v.trim() ? [v.trim()] : [];
  if (!Array.isArray(v)) return [];
  return v.map(str).filter(Boolean);
};

/**
 * برندهای شاخص — هر دو شکل خروجی Relationship را می‌پذیرد.
 * `{ nodes: [...] }` (نسخه‌ی ۲) یا آرایه‌ی مستقیم (نسخه‌های قدیمی).
 */
const brandList = (v: unknown): TopBrand[] => {
  const list = Array.isArray(v)
    ? v
    : v && typeof v === 'object' && Array.isArray((v as { nodes?: unknown[] }).nodes)
      ? (v as { nodes: unknown[] }).nodes
      : [];

  return list
    .filter((b): b is Record<string, unknown> => Boolean(b) && typeof b === 'object')
    .map((b) => ({ title: str(b.title), slug: str(b.slug) }))
    .filter((b) => b.title && b.slug);
};

function normalize(raw: Record<string, unknown> | null): CategoryContent {
  if (!raw) return EMPTY;

  const introHtml = str(raw.seoIntro) || null;

  const content: CategoryContent = {
    introHtml,
    engineeringGuideHtml: str(raw.engineeringGuide) || null,
    topBrands: brandList(raw.topBrands),
    targetIndustries: strList(raw.targetIndustries),
    symptoms: rows(raw.symptoms, (r) => ({
      symptom: str(r.symptom), cause: str(r.cause), urgency: str(r.urgency), needsReview: bool(r.needsReview),
    }), (t) => t.symptom),
    causes: rows(raw.causes, (r) => ({ text: str(r.text), needsReview: bool(r.needsReview) }), (t) => t.text),
    selectionChecklist: rows(raw.selectionChecklist, (r) => ({ text: str(r.text), needsReview: bool(r.needsReview) }), (t) => t.text),
    materials: rows(raw.materials, (r) => ({
      name: str(r.name), advantage: str(r.advantage), limitation: str(r.limitation),
      suitableFor: str(r.suitableFor), needsReview: bool(r.needsReview),
    }), (t) => t.name),
    inspection: rows(raw.inspection, (r) => ({
      type: str(r.type), interval: str(r.interval), checks: str(r.checks), needsReview: bool(r.needsReview),
    }), (t) => t.type),
    faqs: rows(raw.faqs, (r) => ({
      question: str(r.question), answer: str(r.answer), needsReview: bool(r.needsReview),
    }), (t) => t.question),
    standards: rows(raw.standards, (r) => ({ code: str(r.code), title: str(r.title) }), (t) => t.code),
    hasContent: false,
    pendingReview: 0,
  };

  content.hasContent = Boolean(
    introHtml || content.engineeringGuideHtml || content.topBrands.length ||
    content.targetIndustries.length ||
    content.symptoms.length || content.causes.length || content.selectionChecklist.length ||
    content.materials.length || content.inspection.length || content.faqs.length
  );

  content.pendingReview =
    [...content.symptoms, ...content.causes, ...content.selectionChecklist,
     ...content.materials, ...content.inspection, ...content.faqs].filter((r) => r.needsReview).length;

  return content;
}

let cache: Promise<Map<string, CategoryContent>> | null = null;

async function fetchAll(): Promise<Map<string, CategoryContent>> {
  const map = new Map<string, CategoryContent>();
  if (!isWpConfigured()) return map;

  type Payload = {
    craneCategories: { nodes: { slug: string | null; categoryContent: Record<string, unknown> | null }[] } | null;
  };

  let data: Payload | null = null;
  const failures: string[] = [];

  for (const shape of QUERY_SHAPES) {
    try {
      data = await wpQueryPublic<Payload>(shape.query, { first: 200 });
      if (shape !== QUERY_SHAPES[0]) {
        console.info(`[content] شکل کوئری «${shape.name}» استفاده شد.`);
      }
      break;
    } catch (error) {
      failures.push(`${shape.name}: ${(error instanceof Error ? error.message : String(error)).slice(0, 100)}`);
    }
  }

  if (!data) {
    // هر سه شکل شکست خورد — یعنی مشکل از فیلد Relationship نیست، از خودِ
    // اتصال یا گروه ACF است. اینجا سکوت نمی‌کنیم.
    console.warn(
      `\n📄 محتوای سئوی دسته‌ها از وردپرس خوانده نشد — صفحات دسته بدون راهنما ساخته می‌شوند.\n` +
        failures.map((f) => `     • ${f}`).join('\n') +
        `\n   بررسی کنید: افزونه‌ی کرین یدک نسخه‌ی ۱.۳.۳ فعال است و گروه «محتوای سئوی دسته‌بندی» در ACF دیده می‌شود.\n`
    );
    return map;
  }

  for (const node of data?.craneCategories?.nodes ?? []) {
    if (node.slug) map.set(node.slug, normalize(node.categoryContent));
  }

  // گزارش بیلد: کدام دسته‌ها هنوز محتوا ندارند و کدام ردیف‌ها بازبینی‌نشده‌اند.
  const withContent = [...map.values()].filter((c) => c.hasContent).length;
  const pending = [...map.entries()].filter(([, c]) => c.pendingReview > 0);

  console.info(`[content] ${withContent} از ${map.size} دسته محتوای سئو دارند.`);
  if (pending.length) {
    console.warn(
      `[content] ⚠ ${pending.reduce((n, [, c]) => n + c.pendingReview, 0)} ردیف هنوز «نیاز به بازبینی» دارد: ` +
        pending.map(([slug, c]) => `${slug}(${c.pendingReview})`).join('، ') +
        `\n           برای دیدن روی صفحه: CONTENT_REVIEW=1 npm run dev`
    );
  }

  return map;
}

export function getAllCategoryContent(): Promise<Map<string, CategoryContent>> {
  cache ??= fetchAll();
  return cache;
}

export async function getCategoryContent(slug: string): Promise<CategoryContent> {
  return (await getAllCategoryContent()).get(slug) ?? EMPTY;
}

/** حالت بازبینی — `CONTENT_REVIEW=1 npm run dev` */
export function isReviewMode(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.CONTENT_REVIEW === '1';
}
