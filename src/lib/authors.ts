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
import { type Author } from '../data/trust';

// عمداً ساده و بدون فیلتر `hasPublishedPosts`.
//
// آن فیلتر یک enum از نوع محتوا می‌خواهد و نام enum نوع پست سفارشی ما
// («product») در نسخه‌های مختلف WPGraphQL یکسان نیست. یک enum نامعتبر،
// خطای سطح اسکیما می‌دهد — و در این پروژه خطای گراف‌کیوال عمداً بیلد را
// متوقف می‌کند. یعنی یک حدس اشتباه درباره‌ی نام enum، کل سایت را از کار
// می‌انداخت. WPGraphQL خودش کاربران بدون پست منتشرشده را از پاسخ عمومی
// حذف می‌کند، پس این فیلتر عملاً اضافه بود.
/*
 * ⚠️ دو شکل، چون `authorProfile` یک گروه ACF **تازه** است.
 *
 * اگر تک‌شکلی می‌بود، تا لحظه‌ی نصب افزونه‌ی جدید کوئری می‌افتاد و جعبه‌ی
 * نویسنده از همه‌ی صفحات راهنما محو می‌شد. همان درسی که با `media` و
 * `supplyStatus` گرفتیم: فیلد تازه، پله‌ی تنزل خودش را می‌خواهد.
 */
const USER_CORE = `slug name description avatar(size: 128) { url }`;

const AUTHOR_SHAPES = [
  {
    name: 'با پروفایل کارشناس',
    query: `query CraneAuthors($first: Int!) {
      users(first: $first) { nodes {
        ${USER_CORE}
        authorProfile { jobTitle yearsExperience profileUrl credentials { title } }
      } }
    }`,
  },
  {
    name: 'فقط کاربر وردپرس',
    query: `query CraneAuthors($first: Int!) { users(first: $first) { nodes { ${USER_CORE} } } }`,
  },
];


interface RawUser {
  slug?: string | null;
  name?: string | null;
  description?: string | null;
  avatar?: { url?: string | null } | null;
  authorProfile?: {
    jobTitle?: string | null;
    yearsExperience?: number | string | null;
    profileUrl?: string | null;
    credentials?: { title?: string | null }[] | null;
  } | null;
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

let authorsPromise: Promise<Author[]> | null = null;

async function fetchAuthors(): Promise<Author[]> {
  let nodes: RawUser[] = [];

  for (const shape of AUTHOR_SHAPES) {
    try {
      const data = await wpQueryPublic<{ users?: { nodes?: RawUser[] } }>(shape.query, { first: 20 });
      nodes = data?.users?.nodes ?? [];
      if (shape !== AUTHOR_SHAPES[0]) {
        console.info('[author] گروه ACF «پروفایل کارشناس» در اسکیما نیست — عنوان شغلی از زندگی‌نامه خوانده می‌شود.');
      }
      break;
    } catch {
      // شکل بعدی امتحان می‌شود.
    }
  }

  const authors = nodes
    .filter((u) => clean(u.slug) && clean(u.name))
    .map((u) => {
      const p = u.authorProfile ?? null;
      const fallback = splitBio(clean(u.description));

      // فیلد صریح مقدم است؛ قرارداد «—» فقط پشتیبان است.
      const jobTitle = clean(p?.jobTitle) || fallback.jobTitle;
      const bio = clean(p?.jobTitle) ? clean(u.description) : fallback.bio;

      const years = Number(p?.yearsExperience ?? NaN);
      const expertise = (p?.credentials ?? [])
        .map((c) => clean(c?.title))
        .filter((t) => t.length > 0);

      return {
        slug: clean(u.slug),
        name: clean(u.name),
        jobTitle,
        bio,
        expertise: Number.isFinite(years) && years > 0 ? [...expertise, `${years} سال سابقه`] : expertise,
        image: clean(u.avatar?.url),
        // ⚠️ فقط آدرس عمومی. اگر مدیر به‌اشتباه آدرس پنل را گذاشته باشد،
        // منتشر نمی‌شود — آن آدرس نباید در JSON-LD عمومی بیاید.
        sameAs: (() => {
          const url = clean(p?.profileUrl);
          return url && !/admin\.|\/wp-admin/i.test(url) ? [url] : [];
        })(),
        verified: true,
      };
    });

  if (authors.length === 0) {
    console.warn(
      '[author] هیچ نویسنده‌ای از وردپرس برنگشت — جعبه‌ی نویسنده و داده‌ی Person رندر نمی‌شود.\n' +
        '         علت رایج: WPGraphQL کاربرِ بدون نوشته‌ی *منتشرشده* را عمداً پنهان می‌کند.',
    );
  }

  return authors;
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
 * نویسنده‌ی اصلی صفحات راهنما — فقط اگر واقعی باشد.
 *
 * ⚠️ چرا `null` برمی‌گرداند و دیگر جای‌گذار نمی‌دهد:
 * نسخه‌ی قبل در نبودِ نویسنده‌ی وردپرس، `DEFAULT_AUTHOR` را برمی‌گرداند
 * — یعنی «میلاد مظفری، کارشناس ارشد فنی جرثقیل‌های سقفی»، شخصی که وجود
 * خارجی ندارد و من اسمش را ساخته بودم. این روی صفحه با برچسب «جای‌گذار»
 * نمایش داده می‌شد، اما یک نام و عنوان شغلی ساختگی روی محتوای فنی،
 * دقیقاً همان چیزی است که گوگل در ارزیابی E-E-A-T دنبالش می‌گردد و
 * سنگین‌ترین جریمه را دارد: جعل هویت نویسنده.
 *
 * حالا اگر نویسنده‌ی واقعی در وردپرس نباشد، جعبه‌ی نویسنده اصلاً رندر
 * نمی‌شود. صفحه بدون نویسنده بهتر از صفحه با نویسنده‌ی جعلی است.
 *
 * برای فعال شدن: در وردپرس یک کاربر واقعی با نقش «کارشناس فنی» بسازید،
 * نام و بیوگرافی واقعی‌اش را پر کنید.
 */
export async function getPrimaryAuthor(): Promise<Author | null> {
  const authors = await getAuthors();
  return authors[0] ?? null;
}

/** یافتن نویسنده با اسلاگ — برای صفحات اختصاصی نویسنده در آینده. */

/**
 * نویسنده بر اساس نامی که وردپرس روی نوشته گذاشته.
 *
 * ⚠️ تطبیق روی **نام** است نه اسلاگ، چون چیزی که `posts` برمی‌گرداند نام
 * نمایشی است. اگر پیدا نشد `null` می‌دهد و صفحه بدون جعبه‌ی نویسنده رندر
 * می‌شود — بهتر از نسبت‌دادن مقاله به آدم اشتباه.
 */
export async function getAuthorByName(name: string | null): Promise<Author | null> {
  if (!name) return null;
  const needle = name.trim();
  if (!needle) return null;
  return (await getAuthors()).find((a) => a.name.trim() === needle) ?? null;
}
