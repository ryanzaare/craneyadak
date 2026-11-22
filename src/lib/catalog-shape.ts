// src/lib/catalog-shape.ts — نگاشت خالص کاتالوگ (بی import) تا آزمون Node اجرایش کند: catalog-shape.test.mts.
// مصرف: src/lib/catalogs.ts.
export type CatalogDocType = 'catalog' | 'manual' | 'datasheet';

export interface Catalog {
  slug: string;
  title: string;
  url: string;
  /** نسخه‌ی هم‌دامنه برای دانلود مستقیم (src/pages/catalogs/files/[slug].pdf.ts). */
  localUrl: string;
  /** بایت؛ null اگر وردپرس نداد. */
  size: number | null;
  docType: CatalogDocType;
  language: 'fa' | 'en' | 'other';
  brandSlug: string | null;
  brandName: string | null;
  productSlugs: string[];
}

export const DOC_TYPE_LABEL: Record<CatalogDocType, string> = { catalog: 'کاتالوگ', manual: 'دفترچه‌ی راهنما', datasheet: 'دیتاشیت' };
export const LANG_LABEL = { fa: 'فارسی', en: 'انگلیسی', other: 'دیگر' } as const;

export interface RawCatalog {
  slug?: string | null;
  title?: string | null;
  catalogFields?: {
    file?: { node?: { mediaItemUrl?: string | null; fileSize?: number | null; mimeType?: string | null } | null } | null;
    docType?: string | string[] | null;
    language?: string | string[] | null;
    brand?: { nodes?: { slug?: string; title?: string }[] } | null;
    products?: { nodes?: { slug?: string }[] } | null;
  } | null;
}

const one = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

/** نگاشت خالص (آزمون: catalogs.test.mts). سند بی فایل PDF https یا بی عنوان = حذف. */
export function normalizeCatalog(n: RawCatalog): Catalog | null {
  const f = n.catalogFields;
  const file = f?.file?.node;
  const url = file?.mediaItemUrl ?? '';
  if (!n.slug || !/^https:\/\/.+\.pdf$/i.test(url)) return null;
  if (file?.mimeType && file.mimeType !== 'application/pdf') return null;
  const dt = one(f?.docType);
  const lg = one(f?.language);
  const brand = f?.brand?.nodes?.[0];
  // ⚠️ عنوان خالی (۱ آذر ۱۴۰۵): اولین کاتالوگ زنده بی عنوان ذخیره شد و نسخه‌ی اول کل سند را کنار می‌گذاشت — فایل واقعی
  // روی سایت نیامد. وردپرس عنوان را اجباری نمی‌کند؛ پس عنوان از داده‌ی خود سند ساخته می‌شود («کاتالوگ ساگا»)، نه حدس.
  const docType = (['catalog', 'manual', 'datasheet'].includes(dt) ? dt : 'catalog') as CatalogDocType;
  const title = n.title?.trim() || [DOC_TYPE_LABEL[docType], brand?.title].filter(Boolean).join(' ');
  return {
    slug: n.slug,
    title,
    url,
    localUrl: `/catalogs/files/${n.slug}.pdf`,
    size: typeof file?.fileSize === 'number' ? file.fileSize : null,
    docType,
    language: (['fa', 'en', 'other'].includes(lg) ? lg : 'other') as Catalog['language'],
    brandSlug: brand?.slug ?? null,
    brandName: brand?.title ?? null,
    productSlugs: (f?.products?.nodes ?? []).map((p) => p.slug).filter((s): s is string => Boolean(s)),
  };
}


/** «۲٫۴ مگابایت». */
export function formatSize(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  const mb = bytes / 1048576;
  return mb >= 1 ? `${mb.toLocaleString('fa-IR', { maximumFractionDigits: 1 })} مگابایت` : `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('fa-IR')} کیلوبایت`;
}
