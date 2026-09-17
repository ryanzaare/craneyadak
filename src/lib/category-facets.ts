// src/lib/category-facets.ts
// ---------------------------------------------------------------------------
// فیلترهای فنی هر دسته — از **وردپرس**، نه از آرایه‌ی داخل کد.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا این فایل ساخته شد
// ═══════════════════════════════════════════════════════════════════════════
// `src/data/filters.ts` برای ۲۱ دسته از ۳۱ دسته فیلتر فنی را در کد تعریف
// کرده بود. یعنی اگر کارفرما دسته‌ای اضافه می‌کرد که فیلتر می‌خواست، باید
// **کد عوض می‌شد** — همان الگویی که کل بازنویسی ۳.۰.۰ برای حذفش انجام شد
// و این آخرین جایی بود که از قلم افتاده بود.
//
// حالا در `categoryMeta.spec_facets` زندگی می‌کنند: یک ریپیتر با
// label / spec_label / kind / unit / hint.
//
// ⚠️ فیلد ACF تازه‌ای برای *مشخصات* ساخته نشد. این‌ها روی همان
// `technical_specs` موجود محصول کار می‌کنند؛ هر ردیف فقط می‌گوید «کدام
// برچسب مشخصه قابل فیلتر است».
//
// ⚠️ یک پلِ موقت اینجا بود که تا پیش از ورود فایل به نقشه‌ی کد برمی‌گشت.
// ورود تأیید شد («۶۵ فیلتر روی ۲۱ دسته») و پل در همان کامیت حذف شد.
// حالا وردپرس تنها منبع است: اگر دسته‌ای فیلتر نداشته باشد، فقط فیلترهای
// عمومی نشان داده می‌شوند — که رفتار درست است، نه نقص.
// ---------------------------------------------------------------------------

import { isWpConfigured, wpQueryPublic } from './wp';
import { acfRows, acfString, acfChoice } from './acf';
import type { SpecFacet, FacetKind } from '../data/filters';

const FACET_KINDS: FacetKind[] = ['checkbox', 'range'];

const FACET_SHAPES = [
  {
    name: 'کامل',
    query: `query CraneCategoryFacets($first: Int!) {
      craneCategories(first: $first) {
        nodes {
          slug
          categoryMeta {
            specFacets { label specLabel kind unit hint }
          }
        }
      }
    }`,
  },
  {
    name: 'بدون راهنما',
    query: `query CraneCategoryFacets($first: Int!) {
      craneCategories(first: $first) {
        nodes {
          slug
          categoryMeta {
            specFacets { label specLabel kind }
          }
        }
      }
    }`,
  },
];

interface RawNode {
  slug?: string | null;
  categoryMeta?: { specFacets?: unknown } | null;
}

/**
 * شناسه‌ی پایدار برای پارامتر URL.
 *
 * ⚠️ از `spec_label` ساخته می‌شود، نه از شماره‌ی ردیف — وگرنه جابه‌جا کردن
 * ردیف‌ها در پنل، لینک‌های فیلترشده‌ای را که کاربر ذخیره کرده می‌شکند.
 */
function facetId(slug: string, specLabel: string): string {
  const latin = specLabel
    .replace(/[\s‌]+/g, '-')
    .replace(/[^\w؀-ۿ-]/g, '')
    .slice(0, 40);
  return `${slug}-${latin}`;
}

function normalize(slug: string, raw: unknown): SpecFacet[] {
  return acfRows(raw)
    .map((row): SpecFacet | null => {
      const label = acfString(row.label);
      const specLabel = acfString(row.specLabel);
      // بدون این دو، فیلتر ساخته می‌شود ولی همیشه خالی می‌ماند.
      if (!label || !specLabel) return null;

      const unit = acfString(row.unit);
      const hint = acfString(row.hint);

      return {
        id: facetId(slug, specLabel),
        label,
        specLabel,
        kind: acfChoice(row.kind, FACET_KINDS, 'checkbox'),
        ...(unit ? { unit } : {}),
        ...(hint ? { hint } : {}),
      };
    })
    .filter((f): f is SpecFacet => f !== null);
}

let cache: Promise<Map<string, SpecFacet[]>> | null = null;

async function fetchFacets(): Promise<Map<string, SpecFacet[]>> {
  const map = new Map<string, SpecFacet[]>();
  if (!isWpConfigured()) return map;

  const failures: string[] = [];

  for (const shape of FACET_SHAPES) {
    try {
      const data = await wpQueryPublic<{ craneCategories?: { nodes?: RawNode[] } | null }>(
        shape.query,
        { first: 200 },
      );
      for (const node of data?.craneCategories?.nodes ?? []) {
        const slug = acfString(node.slug);
        if (!slug) continue;
        const facets = normalize(slug, node.categoryMeta?.specFacets);
        if (facets.length) map.set(slug, facets);
      }

      const total = [...map.values()].reduce((n, f) => n + f.length, 0);
      if (total > 0) {
        console.info(`[facets] ${total} فیلتر روی ${map.size} دسته از وردپرس خوانده شد (پله‌ی ${shape.name}).`);
      }
      return map;
    } catch (err) {
      failures.push(`پله‌ی «${shape.name}» → ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.warn(
    '[facets] ⚠ خواندن فیلترها از وردپرس شکست خورد. صفحه‌های دسته فقط فیلتر عمومی نشان می‌دهند.\n' +
      failures.map((f) => `        • ${f}`).join('\n'),
  );
  return map;
}

/** فیلترهای یک دسته. تنها منبع: وردپرس. */
export async function getCategoryFacets(slug: string): Promise<SpecFacet[]> {
  cache ??= fetchFacets();
  return (await cache).get(slug) ?? [];
}
