// src/lib/community.ts
// ---------------------------------------------------------------------------
// محتوای کاربر از وردپرس + ساخت اسکیمای QAPage و AggregateRating.
//
// ⚠️ سخت‌گیرانه‌ترین قاعده‌ی این فایل:
// `AggregateRating` فقط و فقط وقتی تولید می‌شود که حداقل یک نظر *واقعیِ
// تاییدشده با امتیاز عددی* وجود داشته باشد. انتشار میانگین امتیاز بدون
// نظر واقعی، نقض مستقیم سیاست داده‌ی ساختاریافته‌ی گوگل است و جریمه‌ی
// دستی دارد — همان اشتباهی که کل این پروژه برای پرهیز از آن ساخته شده،
// فقط این‌بار در قالب یک عدد میانگین.
//
// همین منطق برای QAPage: پرسش بدون پاسخ وارد اسکیما نمی‌شود، چون
// `acceptedAnswer` در اسکیمای Question اجباری است و پرسش بی‌پاسخ یک
// داده‌ی ساختاریافته‌ی ناقص و بی‌ارزش می‌سازد.
// ---------------------------------------------------------------------------

export type CommunityType = 'question' | 'fitment' | 'review';

export interface CommunityEntry {
  id: number;
  type: CommunityType;
  author: string;
  content: string;
  date: string | null;
  craneModel: string;
  serviceMonths: number;
  rating: number;
  answer: string | null;
  answerAuthor: string | null;
  answerDate: string | null;
}

/** نگاشت نوع دیدگاه وردپرس به نوع داخلی. */
const TYPE_MAP: Record<string, CommunityType> = {
  cyh_question: 'question',
  cyh_fitment: 'fitment',
  cyh_review: 'review',
};

interface RawEntry {
  id?: number | null;
  type?: string | null;
  author?: string | null;
  content?: string | null;
  date?: string | null;
  craneModel?: string | null;
  serviceMonths?: number | null;
  rating?: number | null;
  answer?: string | null;
  answerAuthor?: string | null;
  answerDate?: string | null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** نرمال‌سازی ورودی‌های خام گراف‌کیوال. */
export function normalizeCommunity(raw: unknown): CommunityEntry[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item: RawEntry) => {
      const type = TYPE_MAP[text(item?.type)];
      const content = text(item?.content);
      const author = text(item?.author);
      if (!type || !content || !author) return null;

      return {
        id: Number(item?.id ?? 0),
        type,
        author,
        content,
        date: text(item?.date) || null,
        craneModel: text(item?.craneModel),
        serviceMonths: Math.max(0, Number(item?.serviceMonths ?? 0)),
        rating: Math.min(5, Math.max(0, Number(item?.rating ?? 0))),
        answer: text(item?.answer) || null,
        answerAuthor: text(item?.answerAuthor) || null,
        answerDate: text(item?.answerDate) || null,
      };
    })
    .filter((e): e is CommunityEntry => e !== null);
}

/**
 * اسکیمای QAPage — فقط پرسش‌های *پاسخ‌داده‌شده*.
 *
 * چرا پرسش بی‌پاسخ حذف می‌شود: در اسکیمای Question، فیلد `acceptedAnswer`
 * یا `suggestedAnswer` اجباری است. ارسال پرسش بدون پاسخ یعنی داده‌ی
 * ناقص که گوگل نادیده می‌گیرد و در بهترین حالت بی‌اثر است.
 */
export function qaPageJsonLd(
  entries: CommunityEntry[],
  pageUrl: string
): Record<string, unknown> | undefined {
  const answered = entries.filter((e) => e.type === 'question' && e.answer);
  if (answered.length === 0) return undefined;

  return {
    '@type': 'QAPage',
    '@id': `${pageUrl}#qa`,
    mainEntity: answered.map((q) => ({
      '@type': 'Question',
      name: q.content.slice(0, 300),
      text: q.content,
      answerCount: 1,
      ...(q.date ? { dateCreated: q.date } : {}),
      author: { '@type': 'Person', name: q.author },
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer!,
        ...(q.answerDate ? { dateCreated: q.answerDate } : {}),
        ...(q.answerAuthor ? { author: { '@type': 'Person', name: q.answerAuthor } } : {}),
      },
    })),
  };
}

/**
 * `AggregateRating` — فقط با نظر واقعیِ دارای امتیاز.
 *
 * برگرداندن `undefined` وقتی نظری نیست، عمدی و غیرقابل‌مذاکره است.
 */
export function aggregateRatingJsonLd(entries: CommunityEntry[]): Record<string, unknown> | undefined {
  const rated = entries.filter((e) => e.type === 'review' && e.rating >= 1 && e.rating <= 5);
  if (rated.length === 0) return undefined;

  const sum = rated.reduce((acc, r) => acc + r.rating, 0);
  const average = Math.round((sum / rated.length) * 10) / 10;

  return {
    '@type': 'AggregateRating',
    ratingValue: average,
    reviewCount: rated.length,
    bestRating: 5,
    worstRating: 1,
  };
}

/** نظرهای واقعی به‌صورت آرایه‌ی `Review` — باز هم فقط اگر وجود داشته باشند. */
export function reviewsJsonLd(entries: CommunityEntry[]): Record<string, unknown>[] | undefined {
  const rated = entries.filter((e) => e.type === 'review' && e.rating >= 1);
  if (rated.length === 0) return undefined;

  return rated.map((r) => ({
    '@type': 'Review',
    reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    author: { '@type': 'Person', name: r.author },
    reviewBody: r.content,
    ...(r.date ? { datePublished: r.date } : {}),
  }));
}
