// src/lib/legal-pages.ts
// ---------------------------------------------------------------------------
// صفحات حقوقی — قوانین و مقررات، حریم خصوصی، رویه‌ی بازگشت کالا، شرایط ارسال.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا از نوع محتوای بومی «برگه» (page) وردپرس، نه یک CPT یا گروه ACF تازه
// ═══════════════════════════════════════════════════════════════════════════
// متن حقوقی یک سند یک‌تکه‌ی طولانی است، نه داده‌ی ساخت‌یافته — دقیقاً همان
// شکلی که ویرایشگر وردپرس (`content`) از ابتدا برایش ساخته شده، و همان
// الگویی که `posts.ts` برای مقالات مجله استفاده می‌کند. نه فیلد تازه لازم
// است، نه گروه ACF: `page` هم مثل `post` یک نوع محتوای هسته‌ای وردپرس است
// که WPGraphQL همیشه (بدون هیچ تنظیمی در این افزونه) روی ریشه‌ی `pages`
// expose می‌کند.
//
// ⚠️ **متن حقوقی هرگز اینجا ساخته نمی‌شود.** طبق قاعده‌ی ۲ (هرگز چیزی از
// خودت نساز)، این ماژول فقط از وردپرس می‌خواند. تا وقتی مشاور حقوقی
// کارفرما متن واقعی را در پنل وارد نکرده، `getLegalPages()` آرایه‌ای
// ناقص برمی‌گرداند و هشدار می‌دهد — نه اینکه متن جایگزین بسازد.
// ---------------------------------------------------------------------------

import { isWpConfigured, wpQueryPublic } from './wp';
import { acfString, acfText } from './acf';
import { metaExcerpt } from './seo-meta';
import { wrapProseTables, normalizeProseImages } from './prose-html';

export interface LegalPage {
  slug: string;
  /** عنوان نمایشی ثابت — نه از وردپرس، چون این چهار مسیر و برچسبشان از قبل مشخص‌اند. */
  label: string;
  /** عنوان واقعی ثبت‌شده در پنل (برای `<title>` و JSON-LD). */
  title: string;
  excerpt: string;
  bodyHtml: string;
  isoModified: string;
}

/*
 * ⚠️ فهرست بسته‌ی مسیرهای مجاز — چرا اینجا و نه «هر برگه‌ی وردپرس».
 *
 * نوع محتوای `page` عمومی است؛ اگر این ماژول هر برگه‌ی منتشرشده را
 * بدون فیلتر به مسیر عمومی تبدیل کند، هر برگه‌ی آزمایشی یا فراموش‌شده
 * در پنل هم یک URL زنده روی سایت می‌گیرد. این پروژه فقط همین چهار سند
 * حقوقی را نیاز دارد (ایست ۱، `docs/backlog.md`)، پس فهرست صریح است.
 */
const LEGAL_SLUGS: { slug: string; label: string }[] = [
  { slug: 'terms', label: 'قوانین و مقررات' },
  { slug: 'privacy', label: 'حریم خصوصی' },
  { slug: 'returns', label: 'رویه بازگشت کالا' },
  { slug: 'shipping', label: 'شرایط ارسال' },
];

interface RawPage {
  slug?: string | null;
  title?: string | null;
  content?: string | null;
  modified?: string | null;
}

const CORE_PAGE_FIELDS = `slug title content modified`;

let cache: Promise<LegalPage[]> | null = null;

async function fetchLegalPages(): Promise<LegalPage[]> {
  if (!isWpConfigured()) return [];

  const wanted = new Map(LEGAL_SLUGS.map((p) => [p.slug, p.label]));

  let data;
  try {
    data = await wpQueryPublic<{ pages?: { nodes?: RawPage[] } | null }>(
      `query LegalPages($first: Int!) {
        pages(first: $first, where: { status: PUBLISH }) { nodes { ${CORE_PAGE_FIELDS} } }
      }`,
      { first: 50 },
    );
  } catch (err) {
    console.warn(
      `[legal] ⚠ خواندن صفحات حقوقی شکست خورد؛ هیچ صفحه‌ی حقوقی ساخته نمی‌شود.\n` +
        `        ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }

  const pages: LegalPage[] = [];
  for (const node of data?.pages?.nodes ?? []) {
    const slug = acfString(node.slug);
    const label = slug ? wanted.get(slug) : undefined;
    if (!slug || !label) continue; // برگه‌ی خارج از فهرست مجاز — نادیده گرفته می‌شود
    const title = acfString(node.title);
    if (!title) continue;

    pages.push({
      slug,
      label,
      title,
      excerpt: metaExcerpt(node.content),
      bodyHtml: normalizeProseImages(wrapProseTables(acfText(node.content))).html,
      isoModified: (acfString(node.modified) ?? '').slice(0, 10),
    });
  }

  const missing = LEGAL_SLUGS.filter((p) => !pages.some((pg) => pg.slug === p.slug));
  if (missing.length) {
    console.warn(
      `[legal] ⚠ ${missing.length} صفحه‌ی حقوقی هنوز در وردپرس منتشر نشده ` +
        `(${missing.map((p) => p.slug).join('، ')}). این مسیرها ساخته نمی‌شوند تا ` +
        `مشاور حقوقی متن واقعی را در پنل («برگه‌ها») ثبت کند.`,
    );
  }
  if (pages.length) {
    console.info(`[legal] ${pages.length} صفحه‌ی حقوقی از وردپرس خوانده شد.`);
  }

  return pages;
}

export function getLegalPages(): Promise<LegalPage[]> {
  cache ??= fetchLegalPages();
  return cache;
}
