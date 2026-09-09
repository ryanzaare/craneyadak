// src/lib/brand-custom-sections.ts
// ---------------------------------------------------------------------------
// بخش‌های دلخواه صفحه‌ی برند — ساخته‌ی مدیر محتوا، نه برنامه‌نویس.
//
// ═══════════════════════════════════════════════════════════════════════════
// مسئله‌ای که حل می‌کند
// ═══════════════════════════════════════════════════════════════════════════
// هر بخش «تعریف‌شده» صفحه‌ی برند (سری‌ها، پلاک، قطعات…) ساختار خودش را
// دارد: جدول، ستون، نشان رنگی. آن ساختار ارزشش همین است، ولی قیمتش این
// است که افزودن یک بخش تازه یعنی تغییر کد.
//
// این ریپیتر همان آزادیِ «توضیحات محصول» قدیمی را برمی‌گرداند، بدون
// از دست دادن بقیه: هر ردیف = یک بخش کامل با عنوان و متن. مدیر می‌تواند
// «شرایط گارانتی» یا «نحوه‌ی ارسال» را خودش اضافه، حذف یا جابه‌جا کند.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا کوئری جداست و به نردبان اضافه نشد
// ═══════════════════════════════════════════════════════════════════════════
// نردبان کوئری پروفایل برند همین حالا ۱۹ پله دارد. هر محور تازه تعدادش را
// دو برابر می‌کند. مهم‌تر اینکه این یک فیلد **جدید** است: اگر داخل نردبان
// می‌رفت، تا نصب افزونه‌ی جدید تمام پله‌های بالایی می‌افتادند.
//
// پس همان الگوی «غنی‌سازی اختیاری»: کوئری خودش، خطای خودش. اگر بیفتد،
// فقط بخش‌های دلخواه نمایش داده نمی‌شوند و بقیه‌ی صفحه دست‌نخورده می‌ماند.
// ---------------------------------------------------------------------------

import { isWpConfigured, wpQueryPublic } from './wp';

export interface BrandCustomSection {
  heading: string;
  bodyHtml: string;
  needsReview: boolean;
}

const QUERY = `query BrandCustomSections($first: Int!) {
  craneBrands(first: $first) {
    nodes { slug brandProfile { customSections { heading body needsReview } } }
  }
}`;

type Row = { heading?: string | null; body?: string | null; needsReview?: unknown };
type Payload = {
  craneBrands: { nodes: { slug: string | null; brandProfile: { customSections: Row[] | null } | null }[] } | null;
};

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

let cache: Promise<Map<string, BrandCustomSection[]>> | null = null;

async function fetchAll(): Promise<Map<string, BrandCustomSection[]>> {
  const map = new Map<string, BrandCustomSection[]>();
  if (!isWpConfigured()) return map;

  try {
    const data = await wpQueryPublic<Payload>(QUERY, { first: 100 });

    for (const node of data?.craneBrands?.nodes ?? []) {
      if (!node.slug) continue;
      const rows = node.brandProfile?.customSections;
      if (!Array.isArray(rows)) continue;

      const clean = rows
        .filter((r): r is Row => Boolean(r) && typeof r === 'object')
        .map((r) => ({
          heading: str(r.heading),
          bodyHtml: str(r.body),
          needsReview: r.needsReview === true || r.needsReview === 1 || r.needsReview === '1',
        }))
        // بخشی که نه عنوان دارد نه متن، یک ردیف خالیِ فراموش‌شده است.
        .filter((r) => r.heading !== '' || r.bodyHtml !== '');

      if (clean.length) map.set(node.slug, clean);
    }

    const total = [...map.values()].reduce((n, v) => n + v.length, 0);
    if (total > 0) console.info(`[brand] ${total} بخش دلخواه روی ${map.size} برند.`);
  } catch {
    // غنی‌سازی اختیاری — اگر فیلد هنوز در اسکیما نباشد (افزونه‌ی قدیمی)،
    // صفحه بدون این بخش‌ها ساخته می‌شود و چیزی نمی‌شکند.
  }

  return map;
}

export function getBrandCustomSections(slug: string): Promise<BrandCustomSection[]> {
  cache ??= fetchAll();
  return cache.then((m) => m.get(slug) ?? []);
}
