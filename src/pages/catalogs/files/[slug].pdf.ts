// src/pages/catalogs/files/[slug].pdf.ts — نسخه‌ی هم‌دامنه‌ی PDF کاتالوگ برای «دانلود مستقیم»
// ---------------------------------------------------------------------------
// ⚠️ چرا (کارفرما، ۱ آذر ۱۴۰۵: «دکمه‌ی دانلود مستقیم در صفحه‌ی محصول»): فایل اصلی روی admin.craneyadak.com است و
// مرورگرها ویژگی `download` را برای پیوند دامنه‌ی دیگر نادیده می‌گیرند — دکمه PDF را باز می‌کرد، دانلود نه. راه بی تغییر
// افزونه: در build همان فایل یک بار واکشی و در dist/catalogs/files/<slug>.pdf نوشته می‌شود؛ پیوند هم‌دامنه با `download`
// واقعاً ذخیره می‌کند. منبع یگانه همچنان وردپرس است (بارگذاری در منوی «کاتالوگ‌ها»).
// ⚠️ شکست واکشی یک فایل = build قرمز، نه پیوند شکسته‌ی بی‌صدا روی سایت.
// ---------------------------------------------------------------------------
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCatalogs } from '../../../lib/catalogs';

export const getStaticPaths: GetStaticPaths = async () =>
  (await getCatalogs()).map((c) => ({ params: { slug: c.slug }, props: { url: c.url } }));

export const GET: APIRoute = async ({ props }) => {
  const res = await fetch(props.url as string);
  if (!res.ok) throw new Error(`کاتالوگ ${props.url}: HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (String.fromCharCode(...buf.slice(0, 5)) !== '%PDF-') throw new Error(`کاتالوگ ${props.url}: فایل PDF نیست`);
  return new Response(buf, { headers: { 'Content-Type': 'application/pdf' } });
};
