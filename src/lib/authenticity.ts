// src/lib/authenticity.ts
// برچسب اجباری «اصلی / غیر اصلی» (تصمیم مدیریت، ۷ مهر ۱۴۰۵). خالص، بدون import.meta.env،
// تا با آزمون اجرا شود (authenticity.test.mts). کلیدها باید با acf-json
// (field_cyh_product_authenticity) و class-product-authenticity.php یکی باشند.

export type Authenticity = 'original' | 'non_original';

export const AUTHENTICITY_LABEL: Record<Authenticity, string> = {
  original: 'اصلی',
  non_original: 'غیر اصلی',
};

/** ثبت‌نشده یا ناشناخته = null — هرگز پیش‌فرض «اصلی» (ادعای اصالت باید صریح باشد). */
export function parseAuthenticity(raw: unknown): Authenticity | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return v === 'original' || v === 'non_original' ? v : null;
}
