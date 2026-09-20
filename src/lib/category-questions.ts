// src/lib/category-questions.ts
// ---------------------------------------------------------------------------
// پرسش و پاسخ کاربران روی صفحه‌ی دسته — از CPT «cyh_question».
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا مسیرش با پرسشِ محصول فرق دارد
// ═══════════════════════════════════════════════════════════════════════════
// پرسشِ محصول روی *دیدگاه* وردپرس ذخیره می‌شود و دیدگاه فقط به نوشته
// می‌چسبد. دسته‌ها ترم تاکسونومی‌اند، پس یک CPT جدا لازم شد
// (`class-category-questions.php` دلیل کامل را دارد).
//
// این یک بدهی شناخته‌شده است، نه یک طراحی: دو مسیر برای یک مفهوم. CPT از
// روز اول `cyh_entity_type` دارد تا اگر کارفرما تأیید کرد، پرسشِ محصول هم
// به همین‌جا بیاید و مسیر دیدگاه حذف شود.
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

const SHAPES = [
  {
    name: 'کامل',
    query: `query CraneQuestions($first: Int!) {
      craneQuestions(first: $first, where: { status: PUBLISH }) {
        nodes { ${CORE} askerName craneModel }
      }
    }`,
  },
  {
    name: 'بدون فیلدهای پرسشگر',
    query: `query CraneQuestions($first: Int!) {
      craneQuestions(first: $first, where: { status: PUBLISH }) {
        nodes { ${CORE} }
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
  craneCategories?: { nodes?: { slug?: string | null }[] } | null;
}

let cache: Promise<Map<string, CategoryQuestion[]>> | null = null;

async function fetchQuestions(): Promise<Map<string, CategoryQuestion[]>> {
  const map = new Map<string, CategoryQuestion[]>();
  if (!isWpConfigured()) return map;

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

        for (const cat of node.craneCategories?.nodes ?? []) {
          const slug = acfString(cat?.slug);
          if (!slug) continue;
          map.set(slug, [...(map.get(slug) ?? []), entry]);
        }
      }

      const total = [...map.values()].reduce((n, q) => n + q.length, 0);
      if (total > 0) {
        console.info(`[qa] ${total} پرسش پاسخ‌داده‌شده روی ${map.size} دسته (پله‌ی ${shape.name}).`);
      }
      if (dropped > 0) {
        console.warn(
          `[qa] ⚠ ${dropped} پرسش منتشرشده پاسخ ندارد و نمایش داده نمی‌شود. ` +
            'در پنل، ستون «پاسخ» آن‌ها را قرمز نشان می‌دهد.',
        );
      }
      return map;
    } catch (err) {
      failures.push(`پله‌ی «${shape.name}» → ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /* ⚠️ اینجا عمداً `throw` نمی‌کند، برخلاف بلوک‌های محتوا.
     بلوک‌ها **کل محتوای** صفحه‌اند و نبودنشان یعنی انتشار صفحه‌ی خالی.
     پرسش و پاسخ افزوده است: صفحه بدون آن هم کامل است. شکستن build به
     خاطرش یعنی یک افزونه‌ی قدیمی جلوی کل انتشار را بگیرد. */
  console.warn(
    '[qa] ⚠ خواندن پرسش‌ها شکست خورد؛ صفحه‌های دسته بدون بخش پرسش ساخته می‌شوند.\n' +
      '      (اگر افزونه زیر ۳.۵.۰ است، CPT «cyh_question» هنوز وجود ندارد — طبیعی است.)\n' +
      failures.map((f) => `        • ${f}`).join('\n'),
  );
  return map;
}

/** پرسش‌های پاسخ‌داده‌شده‌ی یک دسته. */
export async function getCategoryQuestions(slug: string): Promise<CategoryQuestion[]> {
  cache ??= fetchQuestions();
  return (await cache).get(slug) ?? [];
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
