// src/pages/compare-index.json.ts — داده‌ی صفحه‌ی مقایسه (/compare/)، فایل استاتیک
// ---------------------------------------------------------------------------
// کارفرما (O8، ۲۹ آبان ← ساخته ۱ آذر ۱۴۰۵ با دومین ریموت هم‌نوع، SAGA1-L10): «صفحه‌ی مقایسه» مثل دیجی‌کالا.
// همان الگوی search-index.json: یک فایل جدا که فقط /compare/ می‌خواندش — حجم صفحه‌های دیگر با رشد کاتالوگ ثابت می‌ماند.
// فقط داده‌ی واقعی محصول (مشخصات ثبت‌شده در وردپرس)؛ تصویر کوچک بهینه (۱۶۰px AVIF)، نه JPEG اصلی.
// ---------------------------------------------------------------------------
import { getImage } from 'astro:assets';
import { getAllProducts, productPath } from '../lib/wp';

export async function GET() {
  const products = (await getAllProducts()).filter((p) => !p.isDemo);
  const out = await Promise.all(
    products.map(async (p) => ({
      slug: p.slug,
      name: p.name,
      href: productPath(p),
      sku: p.sku,
      brand: p.brandNameFa,
      categories: p.categorySlugs,
      image: p.images[0] ? (await getImage({ src: p.images[0].url, width: 160, height: 160, format: 'avif', inferSize: false })).src : null,
      specs: p.technicalSpecs.map((s) => [s.label, s.value]),
    })),
  );
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
}
