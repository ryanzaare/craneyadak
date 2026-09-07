// src/lib/categories.ts
// ---------------------------------------------------------------------------
// نام و توضیح دسته‌ها از وردپرس — با تاکسونومی به‌عنوان ساختار پایه.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا این فایل ساخته شد
// ═══════════════════════════════════════════════════════════════════════════
// درخواست روشن بود: «فرانت‌اند باید داده را از بک‌اند بخواند.» تا این
// لحظه نام و توضیح هر دسته فقط از `src/data/taxonomy.ts` می‌آمد. یعنی
// مدیر سایت می‌توانست نام دسته را در وردپرس عوض کند و هیچ اتفاقی روی
// سایت نیفتد — دقیقاً همان خرابی بی‌صدایی که در برندها هم رخ داد.
//
// حالا وردپرس مرجع محتوا است: هر ترمی که در وردپرس نام یا توضیح داشته
// باشد، همان روی سایت می‌نشیند.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا تاکسونومی حذف نشد
// ═══════════════════════════════════════════════════════════════════════════
// همان استدلال brands.ts، و اینجا حتی محکم‌تر است:
//
//   • `slug`، `silo` و `icon` ساختار هستند نه محتوا. مسیر
//     `/categories/[silo]/[category]` در زمان build ساخته می‌شود. اگر
//     ساختار از شبکه بیاید، یک قطعی وردپرس یعنی سایتی بدون هیچ صفحه‌ی
//     دسته — و ۳۱ آدرسِ ایندکس‌شده که یک‌شبه ۴۰۴ می‌شوند. برای سئو این
//     فاجعه است.
//   • `keyword` عبارت هدف سئو است و عمداً در کد می‌ماند: تصمیم
//     استراتژیک درباره‌ی هم‌نوع‌خواری کلمات کلیدی، نه متنی که هر روز
//     ویرایش شود.
//
// پس: ساختار و عبارت هدف از کد، محتوای قابل ویرایش از وردپرس.
// ---------------------------------------------------------------------------

import { wpQueryPublic } from './wp';
import { ALL_CATEGORIES } from '../data/taxonomy';

export interface CategoryTerm {
  /** نام نمایشی — از وردپرس اگر ثبت شده باشد. */
  name: string;
  /** توضیح کوتاه زیر عنوان — از وردپرس اگر ثبت شده باشد. */
  blurb: string;
  /** آیا این دسته واقعاً در وردپرس وجود دارد؟ */
  inWordPress: boolean;
}

const TERMS_QUERY = `
  query CraneCategoryTerms($first: Int!) {
    craneCategories(first: $first) {
      nodes {
        slug
        name
        description
        count
      }
    }
  }
`;

interface RawTerm {
  slug?: string | null;
  name?: string | null;
  description?: string | null;
  count?: number | null;
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** توضیحی که ابزار همگام‌سازی خودش نوشته، محتوای واقعی نیست. */
const SYNC_DESCRIPTION = /^گروه فنی:/;

/** همان نرمال‌سازی wp.ts — نیم‌فاصله و ی/ک عربی. */
function normalizeFa(value: string): string {
  return value
    .replace(/‌/g, ' ')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

let termsPromise: Promise<Map<string, CategoryTerm>> | null = null;

async function fetchTerms(): Promise<Map<string, CategoryTerm>> {
  const out = new Map<string, CategoryTerm>();
  let raw: RawTerm[] = [];

  try {
    const data = await wpQueryPublic<{ craneCategories?: { nodes?: RawTerm[] } }>(TERMS_QUERY, {
      first: 200,
    });
    raw = data?.craneCategories?.nodes ?? [];
  } catch (error) {
    // الگوی «غنی‌سازی اختیاری» — نبود این کوئری نباید بیلد را بخواباند،
    // اما ساکت هم نمی‌ماند.
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `\n📁 نام و توضیح دسته‌ها از وردپرس خوانده نشد — از تاکسونومی محلی استفاده می‌شود.\n` +
        `   جزئیات: ${message.slice(0, 200)}\n`
    );
    return out;
  }

  // نگاشت نام فارسی → اسلاگ تاکسونومی، برای ترم‌هایی که اسلاگ لاتین ندارند.
  const byName = new Map<string, string>();
  for (const category of ALL_CATEGORIES) {
    byName.set(normalizeFa(category.name), category.slug);
    byName.set(normalizeFa(category.keyword), category.slug);
  }

  const known = new Set(ALL_CATEGORIES.map((c) => c.slug));

  for (const node of raw) {
    const slug = clean(node?.slug);
    const name = clean(node?.name);

    // همان تطبیق چندکلیدی wp.ts: اسلاگ، بعد نام.
    let key: string | undefined;
    if (slug && known.has(slug)) {
      key = slug;
    } else if (name) {
      key = byName.get(normalizeFa(name));
    }
    if (!key) continue;

    const description = clean(node?.description);
    out.set(key, {
      name: name ?? '',
      // توضیحی که خودِ ابزار همگام‌سازی نوشته، محتوای انسانی نیست و نباید
      // جای متن تاکسونومی را بگیرد.
      blurb: description && !SYNC_DESCRIPTION.test(description) ? description : '',
      inWordPress: true,
    });
  }

  const missing = ALL_CATEGORIES.filter((c) => !out.has(c.slug));
  if (missing.length > 0) {
    console.warn(
      `\n⚠️  ${missing.length} از ${ALL_CATEGORIES.length} دسته در وردپرس وجود ندارد:\n` +
        missing.slice(0, 8).map((c) => `    • ${c.name} (${c.slug})`).join('\n') +
        (missing.length > 8 ? `\n    … و ${missing.length - 8} مورد دیگر` : '') +
        `\n\n  این صفحات با متن تاکسونومی رندر می‌شوند و هیچ محصولی نخواهند داشت.\n` +
        `  در پنل: محصولات کرین یدک ← «همگام‌سازی دسته‌بندی‌ها».\n`
    );
  } else {
    console.log(`[wp] ✓ هر ${ALL_CATEGORIES.length} دسته در وردپرس موجود است.`);
  }

  return out;
}

export function getCategoryTerms(): Promise<Map<string, CategoryTerm>> {
  termsPromise ??= fetchTerms();
  return termsPromise;
}

/**
 * محتوای نمایشی یک دسته: وردپرس اول، تاکسونومی به‌عنوان تور ایمنی.
 *
 * ⚠️ فالبک اینجا *بی‌صدا نیست* — `inWordPress` می‌گوید داده واقعاً از
 * کجا آمد. فالبک بی‌صدا همان چیزی بود که باگ برندها را هفته‌ها پنهان کرد.
 */
export async function resolveCategoryTerm(
  slug: string,
  fallbackName: string,
  fallbackBlurb: string
): Promise<CategoryTerm> {
  const term = (await getCategoryTerms()).get(slug);
  return {
    name: term?.name || fallbackName,
    blurb: term?.blurb || fallbackBlurb,
    inWordPress: Boolean(term),
  };
}
