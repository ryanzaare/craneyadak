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

export interface CategoryContent {
  introHtml: string | null;
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

const QUERY = `
  query CategoryContent($first: Int!) {
    craneCategories(first: $first) {
      nodes {
        slug
        categoryContent {
          seoIntro
          symptoms { symptom cause urgency needsReview }
          causes { text needsReview }
          selectionChecklist { text needsReview }
          materials { name advantage limitation suitableFor needsReview }
          inspection { type interval checks needsReview }
          faqs { question answer needsReview }
          standards { code title }
        }
      }
    }
  }
`;

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

function normalize(raw: Record<string, unknown> | null): CategoryContent {
  if (!raw) return EMPTY;

  const introHtml = str(raw.seoIntro) || null;

  const content: CategoryContent = {
    introHtml,
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
    introHtml || content.symptoms.length || content.causes.length || content.selectionChecklist.length ||
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

  const data = await wpQueryPublic<{
    craneCategories: { nodes: { slug: string | null; categoryContent: Record<string, unknown> | null }[] } | null;
  }>(QUERY, { first: 200 });

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
