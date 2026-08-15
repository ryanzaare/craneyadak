// src/lib/authors.ts
// ---------------------------------------------------------------------------
// نویسندگان از خودِ وردپرس — جایگزین فهرست ثابت در src/data/trust.ts.
//
// چرا این تغییر لازم بود: نام و بیوگرافی کارشناس فنی، محتوای ویرایشی است
// نه پیکربندی کد. تا وقتی در یک فایل TypeScript بود، هر تغییر کوچک —
// استخدام یک کارشناس جدید، اصلاح یک عنوان شغلی — نیازمند ویرایش کد و
// یک دیپلوی کامل بود. مدیر سایت باید بتواند این‌ها را از پنل وردپرس
// مدیریت کند، دقیقاً مثل بقیه‌ی محتوا.
//
// ⚠️ نکته‌ی حیاتی WPGraphQL:
// کاربران وردپرس به‌صورت پیش‌فرض در گراف‌کیوال عمومی دیده نمی‌شوند مگر
// این‌که حداقل یک پست *منتشرشده* داشته باشند. این یک تصمیم امنیتی آگاهانه
// در خود WPGraphQL است (جلوگیری از شمارش کاربران توسط مهاجم) و ما آن را
// دور نمی‌زنیم. نتیجه‌ی عملی: کارشناسی که هنوز چیزی ننوشته، در فهرست
// نمی‌آید — که رفتار درستی هم هست.
//
// اگر هیچ نویسنده‌ای برنگردد (وردپرس تنظیم نشده یا هنوز محتوایی نیست)،
// به نویسنده‌ی جای‌گذارِ trust.ts برمی‌گردیم تا صفحه نشکند — اما آن
// جای‌گذار همچنان برچسب دارد و وارد JSON-LD نمی‌شود.
// ---------------------------------------------------------------------------

import { wpQueryPublic } from './wp';
import { DEFAULT_AUTHOR, type Author } from '../data/trust';

// عمداً ساده و بدون فیلتر `hasPublishedPosts`.
//
// آن فیلتر یک enum از نوع محتوا می‌خواهد و نام enum نوع پست سفارشی ما
// («product») در نسخه‌های مختلف WPGraphQL یکسان نیست. یک enum نامعتبر،
// خطای سطح اسکیما می‌دهد — و در این پروژه خطای گراف‌کیوال عمداً بیلد را
// متوقف می‌کند. یعنی یک حدس اشتباه درباره‌ی نام enum، کل سایت را از کار
// می‌انداخت. WPGraphQL خودش کاربران بدون پست منتشرشده را از پاسخ عمومی
// حذف می‌کند، پس این فیلتر عملاً اضافه بود.
const AUTHORS_QUERY = `
  query CraneAuthors($first: Int!) {
    users(first: $first) {
      nodes {
        slug
        name
        description
        avatar(size: 128) { url }
      }
    }
  }
`;

interface RawUser {
  slug?: string | null;
  name?: string | null;
  description?: string | null;
  avatar?: { url?: string | null } | null;
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

let authorsPromise: Promise<Author[]> | null = null;

async function fetchAuthors(): Promise<Author[]> {
  try {
    const data = await wpQueryPublic<{ users?: { nodes?: RawUser[] } }>(AUTHORS_QUERY, { first: 20 });
    const nodes = data?.users?.nodes ?? [];

    return nodes
      .filter((u) => clean(u.slug) && clean(u.name))
      .map((u) => ({
        slug: clean(u.slug),
        name: clean(u.name),
        // وردپرس فیلد «عنوان شغلی» ندارد. قرارداد: خط اول بیوگرافی، اگر
        // با «—» جدا شده باشد، عنوان شغلی است. ساده، بدون نیاز به افزونه.
        jobTitle: splitBio(clean(u.description)).jobTitle,
        bio: splitBio(clean(u.description)).bio,
        expertise: [],
        image: clean(u.avatar?.url),
        sameAs: [],
        // نویسنده‌ی واقعیِ وردپرس تاییدشده است: یک انسان واقعی با حساب
        // کاربری، نه یک نام جای‌گذار که ما نوشته‌ایم.
        verified: true,
      }));
  } catch {
    // شکست در واکشی نویسنده نباید کل بیلد را متوقف کند — برخلاف کاتالوگ
    // محصولات، نبودِ جعبه‌ی نویسنده صفحه را بی‌معنا نمی‌کند.
    return [];
  }
}

/**
 * قرارداد ساده برای عنوان شغلی:
 *   «کارشناس ارشد فنی — ۱۲ سال سابقه در تعمیر بالابر…»
 * خط اول تا اولین «—» عنوان شغلی، باقی بیوگرافی.
 */
function splitBio(description: string): { jobTitle: string; bio: string } {
  if (!description) return { jobTitle: 'کارشناس فنی', bio: '' };
  const idx = description.indexOf('—');
  if (idx === -1) return { jobTitle: 'کارشناس فنی', bio: description };
  return {
    jobTitle: description.slice(0, idx).trim() || 'کارشناس فنی',
    bio: description.slice(idx + 1).trim(),
  };
}

export function getAuthors(): Promise<Author[]> {
  authorsPromise ??= fetchAuthors();
  return authorsPromise;
}

/**
 * نویسنده‌ی پیش‌فرض برای صفحات راهنما.
 * اولویت با نویسنده‌ی واقعی وردپرس؛ در نبودش، جای‌گذارِ برچسب‌دار.
 */
export async function getPrimaryAuthor(): Promise<Author> {
  const authors = await getAuthors();
  return authors[0] ?? DEFAULT_AUTHOR;
}

/** یافتن نویسنده با اسلاگ — برای صفحات اختصاصی نویسنده در آینده. */
export async function findAuthor(slug: string): Promise<Author | undefined> {
  return (await getAuthors()).find((a) => a.slug === slug);
}
