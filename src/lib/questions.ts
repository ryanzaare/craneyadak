// src/lib/questions.ts
// ---------------------------------------------------------------------------
// پرسش و پاسخ فنی — **تنها** منبع پرسش در کل سایت: CPT «cyh_question».
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا یک مسیر، نه دو تا
// ═══════════════════════════════════════════════════════════════════════════
// نسخه‌ی اول این ماژول فقط پرسشِ *دسته* را می‌خواند، چون پرسشِ *محصول*
// روی دیدگاه وردپرس بود. دلیلش فنی و واقعی بود — دیدگاه فقط به نوشته
// می‌چسبد و دسته ترم تاکسونومی است — ولی نتیجه‌اش دو سامانه برای یک
// مفهوم می‌شد، دقیقاً همان الگویی که این پروژه بارها از آن ضربه خورده.
//
// کارفرما تصمیم گرفت همان روز بسته شود، و استدلالش درست بود: وقتی هنوز
// هیچ پرسش واقعی ثبت نشده، یکی‌کردن یک *انتقال داده* هم لازم ندارد. هر
// ماه تأخیر گران‌ترش می‌کرد.
//
// «نظر خریدار» و «گزارش نصب» روی دیدگاه ماندند و این ناسازگاری نیست:
// آن‌ها تجربه‌ی یک خریدار از یک محصول مشخص‌اند، پس ذاتاً به یک نوشته
// می‌چسبند. پرسش این‌طور نیست.
//
// ⚠️ نردبان کوئری: مثل همه‌ی ماژول‌های دیگر. `askerName` و `craneModel`
// فیلدهای ثبت‌شده‌ی WPGraphQL هستند و اگر افزونه قدیمی باشد وجود ندارند —
// پس پله‌ی دوم بدون آن‌ها می‌پرسد و پرسش‌ها همچنان نمایش داده می‌شوند.
// ---------------------------------------------------------------------------

import { isWpConfigured, wpQueryPublic } from './wp';
import { acfString, acfText } from './acf';

export interface CategoryQuestion {
  /** خود پرسش — عنوان نوشته. */
  question: string;
  /** پاسخ کارشناس — بدنه. همیشه پر است؛ نگهبان افزونه انتشار بی‌پاسخ را می‌بندد. */
  answerHtml: string;
  /** نام کوچک پرسشگر، اگر داده باشد. */
  askerName: string | null;
  /** مدل جرثقیلی که پرسش درباره‌ی آن است. */
  craneModel: string | null;
  /** ISO — برای `<time>` و `dateCreated` در اسکیما. */
  isoDate: string;
}

const CORE = `
  title
  content
  date
  craneCategories { nodes { slug } }
`;

/** کدام موجودیت، پرسش را نگه می‌دارد. */
export type QuestionEntity = 'category' | 'product';

const SHAPES = [
  {
    name: 'کامل',
    query: `query CraneQuestions($first: Int!) {
      craneQuestions(first: $first, where: { status: PUBLISH }) {
        nodes { ${CORE} askerName craneModel productSlug }
      }
    }`,
  },
  {
    name: 'بدون فیلدهای پرسشگر',
    query: `query CraneQuestions($first: Int!) {
      craneQuestions(first: $first, where: { status: PUBLISH }) {
        nodes { ${CORE} productSlug }
      }
    }`,
  },
];

interface RawQuestion {
  title?: string | null;
  content?: string | null;
  date?: string | null;
  askerName?: string | null;
  craneModel?: string | null;
  productSlug?: string | null;
  craneCategories?: { nodes?: { slug?: string | null }[] } | null;
}

let cache: Promise<QuestionIndex> | null = null;

/** دو نمایه از یک واکشی: یکی بر اساس اسلاگ دسته، یکی بر اساس اسلاگ محصول. */
type QuestionIndex = Record<QuestionEntity, Map<string, CategoryQuestion[]>>;

const emptyIndex = (): QuestionIndex => ({ category: new Map(), product: new Map() });

async function fetchQuestions(): Promise<QuestionIndex> {
  const index = emptyIndex();
  if (!isWpConfigured()) return index;

  const failures: string[] = [];

  for (const shape of SHAPES) {
    try {
      const data = await wpQueryPublic<{ craneQuestions?: { nodes?: RawQuestion[] } | null }>(
        shape.query,
        { first: 300 },
      );

      let dropped = 0;
      for (const node of data?.craneQuestions?.nodes ?? []) {
        const question = acfString(node.title);
        const answerHtml = acfText(node.content).trim();

        /* ⚠️ پرسشِ بی‌پاسخ رد می‌شود — حتی اگر از فیلتر افزونه رد شده
           باشد (مثلاً با ویرایش مستقیم دیتابیس). دلیلش سئویی است: پاسخِ
           خالی در `QAPage` نقض راهنمای گوگل است و می‌تواند rich result
           کل صفحه را بردارد. دو لایه دفاع، چون هزینه‌ی خطا بالاست. */
        if (!question || !answerHtml) {
          dropped++;
          continue;
        }

        const iso = acfString(node.date) ?? '';
        const entry: CategoryQuestion = {
          question,
          answerHtml,
          askerName: acfString(node.askerName),
          craneModel: acfString(node.craneModel),
          isoDate: iso ? iso.slice(0, 10) : '',
        };

        const push = (kind: QuestionEntity, slug: string) => {
          index[kind].set(slug, [...(index[kind].get(slug) ?? []), entry]);
        };

        /* ⚠️ پرسشِ محصول به دسته‌اش **اضافه نمی‌شود**، حتی اگر وسوسه‌کننده
           باشد. یک متن روی دو آدرس با دو `QAPage` که همان پرسش را ادعا
           می‌کنند، محتوای تکراری است نه پوشش بیشتر. `productSlug` که پر
           باشد، یعنی پرسش مالِ صفحه‌ی محصول است و بس. */
        const productSlug = acfString(node.productSlug);
        if (productSlug) {
          push('product', productSlug);
          continue;
        }

        for (const cat of node.craneCategories?.nodes ?? []) {
          const slug = acfString(cat?.slug);
          if (!slug) continue;
          push('category', slug);
        }
      }

      const count = (m: Map<string, CategoryQuestion[]>) =>
        [...m.values()].reduce((n, q) => n + q.length, 0);
      const onCats = count(index.category);
      const onProds = count(index.product);

      if (onCats + onProds > 0) {
        console.info(
          `[qa] ${onCats + onProds} پرسش پاسخ‌داده‌شده ` +
            `(${onCats} روی ${index.category.size} دسته، ${onProds} روی ${index.product.size} محصول) ` +
            `— پله‌ی ${shape.name}.`,
        );
      }
      if (dropped > 0) {
        console.warn(
          `[qa] ⚠ ${dropped} پرسش منتشرشده پاسخ ندارد و نمایش داده نمی‌شود. ` +
            'در پنل، ستون «پاسخ» آن‌ها را قرمز نشان می‌دهد.',
        );
      }
      return index;
    } catch (err) {
      failures.push(`پله‌ی «${shape.name}» → ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /* ⚠️ اینجا عمداً `throw` نمی‌کند، برخلاف بلوک‌های محتوا.
     بلوک‌ها **کل محتوای** صفحه‌اند و نبودنشان یعنی انتشار صفحه‌ی خالی.
     پرسش و پاسخ افزوده است: صفحه بدون آن هم کامل است. شکستن build به
     خاطرش یعنی یک افزونه‌ی قدیمی جلوی کل انتشار را بگیرد. */
  console.warn(
    '[qa] ⚠ خواندن پرسش‌ها شکست خورد؛ صفحه‌ها بدون بخش پرسش ساخته می‌شوند.\n' +
      '      اگر خطا «Cannot query field craneCategories on type CraneQuestion» است،\n' +
      '      یعنی CPT پرسش به تاکسونومی دسته وصل نشده — افزونه‌ی ۳.۶.۰ یا بالاتر لازم است.\n' +
      failures.map((f) => `        • ${f}`).join('\n'),
  );
  return index;
}

/**
 * پرسش‌های پاسخ‌داده‌شده‌ی یک موجودیت.
 *
 * ⚠️ یک واکشی برای کل سایت، نه یکی به‌ازای هر صفحه. با ۳۱ دسته و
 * ۱۰۰۰+ محصول، کوئری به‌ازای صفحه یعنی هزار رفت‌وبرگشت در هر build.
 * `cache` همان الگوی بقیه‌ی ماژول‌های این پوشه است.
 */
export async function getQuestions(
  entity: QuestionEntity,
  slug: string,
): Promise<CategoryQuestion[]> {
  cache ??= fetchQuestions();
  return (await cache)[entity].get(slug) ?? [];
}

/**
 * داده‌ی ساختاریافته‌ی `QAPage`.
 *
 * ⚠️ چرا QAPage و نه FAQPage: تفاوت در *منشأ* است، نه در شکل. FAQPage
 * برای پرسش‌هایی است که خود سایت نوشته؛ QAPage برای پرسشی که کاربر
 * پرسیده و پاسخ گرفته. استفاده‌ی نادرست از FAQPage برای محتوای کاربر،
 * نقض راهنمای گوگل است.
 *
 * ⚠️ صفحه‌ی دسته از قبل یک `FAQPage` از بلوک پرسش‌های متداول دارد. این
 * دو با هم تداخل ندارند چون `@type` متفاوت است و هرکدام موجودیت خودش را
 * توصیف می‌کند.
 */
export function questionsJsonLd(questions: CategoryQuestion[], pageUrl: string): object | null {
  if (questions.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    url: pageUrl,
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      ...(q.isoDate ? { dateCreated: q.isoDate } : {}),
      ...(q.askerName ? { author: { '@type': 'Person', name: q.askerName } } : {}),
      answerCount: 1,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answerHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      },
    })),
  };
}
