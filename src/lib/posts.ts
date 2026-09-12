// src/lib/posts.ts
// ---------------------------------------------------------------------------
// مقالات مجله — از **نوشته‌های وردپرس**، نه از آرایه‌ی داخل کد.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا این فایل ساخته شد
// ═══════════════════════════════════════════════════════════════════════════
// سه مقاله‌ی سایت در `src/data/content.ts` به‌صورت آرایه‌ی هاردکد نوشته شده
// بودند. یعنی «بخش بلاگ» در پنل وجود نداشت و کارفرما برای تغییر یک جمله
// باید به کد دست می‌زد — دقیقاً همان چیزی که کل بازنویسی ۳.۰.۰ برای حذفش
// انجام شد، ولی این گوشه از قلم افتاد.
//
// وردپرس از ابتدا «نوشته‌ها» را داشت؛ سایت فقط نگاهش نمی‌کرد. پس نه CPT
// تازه‌ای لازم است، نه فیلد تازه‌ای — فقط خواندن از جایی که همیشه بوده.
//
// ⚠️ نردبان کوئری: هر فیلدِ تازه باید پله‌ی خودش را داشته باشد. سه بار در
// این پروژه یک فیلد تازه داخل کوئری اصلی رفت و کل صفحه را خالی کرد.
// ---------------------------------------------------------------------------

import { isWpConfigured, wpQueryPublic } from './wp';
import { acfString, acfText } from './acf';
import { wrapProseTables, normalizeProseImages } from './prose-html';

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  /** تاریخ شمسی برای نمایش. */
  date: string;
  /** ISO برای `<time datetime>` و JSON-LD. */
  isoDate: string;
  /** تاریخ آخرین ویرایش — برای `dateModified` در schema. */
  isoModified: string;
  category: string;
  bodyHtml: string;
}

const CORE_POST_FIELDS = `
  slug
  title
  excerpt
  date
  modified
  content
  categories(first: 1) { nodes { name } }
`;

const POST_SHAPES = [
  {
    name: 'با نویسنده',
    query: `query CranePosts($first: Int!) {
      posts(first: $first, where: { status: PUBLISH, orderby: { field: DATE, order: DESC } }) {
        nodes { ${CORE_POST_FIELDS} author { node { name } } }
      }
    }`,
  },
  {
    name: 'بدون نویسنده',
    query: `query CranePosts($first: Int!) {
      posts(first: $first, where: { status: PUBLISH, orderby: { field: DATE, order: DESC } }) {
        nodes { ${CORE_POST_FIELDS} }
      }
    }`,
  },
];

interface RawPost {
  slug?: string | null;
  title?: string | null;
  excerpt?: string | null;
  date?: string | null;
  modified?: string | null;
  content?: string | null;
  categories?: { nodes?: { name?: string | null }[] } | null;
  author?: { node?: { name?: string | null } | null } | null;
}

/** `<p>…</p>` و `&hellip;` که وردپرس دور چکیده می‌پیچد، برای متا بی‌فایده‌اند. */
function plainExcerpt(html: unknown): string {
  return acfText(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * چکیده در حد یک توضیح متا — با مرز **جمله**، نه با شمردن کاراکتر.
 *
 * ⚠️ وقتی «چکیده»ی دستی در وردپرس خالی باشد، وردپرس ۵۵ کلمه‌ی اول متن را
 * خودکار برمی‌دارد. نتیجه برای هر دو مقاله ۳۰۰ کاراکتر شد، که در Layout
 * به ۱۵۸ بریده می‌شد و وسط جمله با «…» تمام می‌شد.
 *
 * پس اینجا به‌جای بریدن، **جمله‌های کامل** برداشته می‌شوند تا جا شود. اگر
 * حتی جمله‌ی اول بلند باشد، تور ایمنی Layout کار خودش را می‌کند.
 *
 * بهترین حالت هنوز این است که نویسنده «چکیده» را خودش بنویسد؛ این فقط
 * تضمین می‌کند حالت پیش‌فرض هم شکسته نباشد.
 */
function metaExcerpt(html: unknown, max = 158): string {
  const text = plainExcerpt(html);
  if (text.length <= max) return text;

  // جمله‌ها را نگه می‌داریم، همراه با علامت پایانی‌شان.
  const parts = text.split(/(?<=[.!؟?])\s+/);
  let out = '';
  for (const part of parts) {
    const next = out ? `${out} ${part}` : part;
    if (next.length > max) break;
    out = next;
  }
  return out || text;
}

/**
 * تاریخ شمسی.
 *
 * ⚠️ `timeZone: 'UTC'` عمدی است. بدون آن، تاریخِ ساخته‌شده در ساعت‌های
 * ابتدایی روز یک روز عقب می‌افتد و تاریخ نمایشی با `datetime` نمی‌خواند.
 */
const JALALI = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

function toJalali(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : JALALI.format(d);
}

function normalizePost(node: RawPost): BlogPost | null {
  const slug = acfString(node.slug);
  const title = acfString(node.title);
  // بدون این دو، نه مسیری قابل ساخت است نه عنوانی قابل نمایش.
  if (!slug || !title) return null;

  const iso = acfString(node.date) ?? '';
  // ⚠️ `normalizeProseImages` شیء `{ html, audit }` می‌دهد، نه رشته.
  const body = normalizeProseImages(wrapProseTables(acfText(node.content))).html;

  return {
    slug,
    title,
    excerpt: metaExcerpt(node.excerpt),
    date: toJalali(iso),
    isoDate: iso ? iso.slice(0, 10) : '',
    isoModified: (acfString(node.modified) ?? iso).slice(0, 10),
    category: acfString(node.categories?.nodes?.[0]?.name) ?? 'مقاله',
    bodyHtml: body,
  };
}

let cache: Promise<BlogPost[]> | null = null;

async function fetchPosts(): Promise<BlogPost[]> {
  if (!isWpConfigured()) return [];

  const failures: string[] = [];

  for (const shape of POST_SHAPES) {
    try {
      const data = await wpQueryPublic<{ posts?: { nodes?: RawPost[] } | null }>(shape.query, {
        first: 100,
      });
      const nodes = data?.posts?.nodes ?? [];
      const posts = nodes.map(normalizePost).filter((p): p is BlogPost => p !== null);

      // همیشه گزارش — سکوت همان چیزی بود که گذاشت این بخش ماه‌ها هاردکد بماند.
      if (posts.length) {
        console.info(`[blog] ${posts.length} مقاله از وردپرس خوانده شد (پله‌ی ${shape.name}).`);
      } else {
        console.warn(
          '[blog] ⚠ هیچ نوشته‌ی منتشرشده‌ای در وردپرس نیست. ' +
            'صفحه‌ی مجله خالی می‌ماند تا اولین مقاله در پنل منتشر شود.',
        );
      }
      return posts;
    } catch (err) {
      failures.push(`پله‌ی «${shape.name}» → ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.warn(
    '[blog] ⚠ خواندن مقالات شکست خورد؛ صفحه‌ی مجله خالی ساخته می‌شود.\n' +
      failures.map((f) => `        • ${f}`).join('\n'),
  );
  return [];
}

export function getPosts(): Promise<BlogPost[]> {
  cache ??= fetchPosts();
  return cache;
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  return (await getPosts()).find((p) => p.slug === slug) ?? null;
}
