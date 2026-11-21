// src/lib/catalogs.ts — کاتالوگ و دفترچه‌های PDF سازنده (CPT cyh_catalog، افزونه ۳.۳۲.۰)
// ---------------------------------------------------------------------------
// کارفرما (۳۰ آبان ۱۴۰۵): «صفحه‌ای فقط برای کاتالوگ‌ها، و در هر صفحه‌ی محصول گزینه‌ی اختیاری دانلود کاتالوگ همان
// محصول». یک بارگذاری در وردپرس (منوی «کاتالوگ‌ها»)، دو نمایش: /catalogs/ و جعبه‌ی دانلود صفحه‌ی محصول.
//
// ⚠️ کوئری جدا، نه داخل CORE_FIELDS محصول (CLAUDE.md «نردبان کوئری»): افزونه‌ی قدیمی‌تر از ۳.۳۲.۰ نوع CraneCatalog را
// ندارد؛ شکست این کوئری فقط یعنی «کاتالوگی نیست» و یک هشدار build — صفحه‌ی محصول و کل سایت سالم می‌مانند.
// ⚠️ فقط سند دارای فایل واقعی نمایش داده می‌شود (درس datasheet حذف‌شده: عنوان بی فایل = ادعای ساختگی).
// ---------------------------------------------------------------------------
import { wpQueryPublic } from './wp';

import { normalizeCatalog, type Catalog, type RawCatalog } from './catalog-shape';
export { DOC_TYPE_LABEL, LANG_LABEL, formatSize, type Catalog } from './catalog-shape';

const QUERY = /* GraphQL */ `
  query Catalogs($first: Int!) {
    craneCatalogs(first: $first, where: { status: PUBLISH }) {
      nodes {
        slug
        title
        catalogFields {
          file { node { mediaItemUrl fileSize mimeType } }
          docType
          language
          brand { nodes { ... on CraneBrand { slug title } } }
          products { nodes { ... on CraneProduct { slug } } }
        }
      }
    }
  }
`;

let memo: Promise<Catalog[]> | null = null;

export function getCatalogs(): Promise<Catalog[]> {
  return (memo ??= (async () => {
    try {
      const data = await wpQueryPublic<{ craneCatalogs?: { nodes?: RawCatalog[] } }>(QUERY, { first: 200 });
      return (data?.craneCatalogs?.nodes ?? []).map(normalizeCatalog).filter((c): c is Catalog => c !== null);
    } catch (e) {
      console.warn(`\n📚 کاتالوگ‌ها خوانده نشد (افزونه‌ی ۳.۳۲.۰ و Sync گروه «Catalog Fields»؟): ${(e as Error).message}\n`);
      return [];
    }
  })());
}

export async function catalogsForProduct(slug: string): Promise<Catalog[]> {
  return (await getCatalogs()).filter((c) => c.productSlugs.includes(slug));
}

