// src/lib/checkout.ts
// ---------------------------------------------------------------------------
// منطق خالص صفحه‌ی پرداخت: نرمال‌سازی ارقام، اعتبارسنجی فیلدها، روش‌های
// ارسال، جمع مبلغ. بدون DOM، تا با آزمون (checkout.test.mts) اجرا شود.
//
// ⚠️ سرور مرجع است، این فایل فقط بازخورد فوری می‌دهد. هر قاعده‌ای که این‌جا
// عوض شود باید در class-checkout.php هم عوض شود (و برعکس) — وگرنه مشتری
// فرمی را «معتبر» می‌بیند که سرور رد می‌کند، یا برعکس. آزمون
// checkout.test.mts همان موارد مرزی هارنس PHP (بررسی‌های ۶۰ تا ۷۶) را
// اجرا می‌کند و فهرست روش‌های ارسال را با متن PHP مقایسه می‌کند.
// ---------------------------------------------------------------------------

const PERSIAN_ZERO = 0x06f0;
const ARABIC_ZERO = 0x0660;

/** ارقام فارسی (۰-۹) و عربی (٠-٩) → لاتین. بقیه‌ی نویسه‌ها دست‌نخورده. */
export function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (ch) => {
    const code = ch.charCodeAt(0);
    return String(code >= PERSIAN_ZERO ? code - PERSIAN_ZERO : code - ARABIC_ZERO);
  });
}

/** فقط ارقام لاتین (پس از تبدیل) — معادل cyh_digits_only. */
export function digitsOnly(value: string): string {
  return toLatinDigits(value).replace(/\D/g, '');
}

const allSame = (c: string) => /^(\d)\1+$/.test(c);

export function validNationalCode(raw: string): boolean {
  const c = digitsOnly(raw);
  if (!/^\d{10}$/.test(c) || allSame(c)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(c[i]) * (10 - i);
  const r = sum % 11;
  const check = Number(c[9]);
  return r < 2 ? check === r : check === 11 - r;
}

/** 🔶 با شناسه‌ی واقعی شرکت همکار آزموده شود (docs/backlog.md). */
export function validLegalId(raw: string): boolean {
  const c = digitsOnly(raw);
  if (!/^\d{11}$/.test(c) || allSame(c)) return false;
  const d = Number(c[9]) + 2;
  const weights = [29, 27, 23, 19, 17, 29, 27, 23, 19, 17];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (Number(c[i]) + d) * weights[i];
  let r = sum % 11;
  if (r === 10) r = 0;
  return Number(c[10]) === r;
}

export function validPostal(raw: string): boolean {
  const c = digitsOnly(raw);
  return /^\d{10}$/.test(c) && !allSame(c);
}

export function validLandline(raw: string): boolean {
  return /^0[1-8]\d{9}$/.test(digitsOnly(raw));
}

export function validMobile(raw: string): boolean {
  return /^0?9\d{9}$/.test(digitsOnly(raw));
}

/* ------------------------------ ارسال ------------------------------ */

export interface ShippingMethod {
  code: string;
  label: string;
}

/**
 * همه پس‌کرایه‌اند (مبلغ ارسال در جمع ۰ است).
 * ⚠️ عبارت داخل پرانتز روش هوایی الزام حقوقی کارفرماست و باید عیناً کنار
 * گزینه دیده شود؛ سرور همین متن را در سفارش ثبت می‌کند تا بعداً معلوم
 * باشد خریدار چه چیزی را پذیرفته است.
 */
export const SHIPPING_METHODS: readonly ShippingMethod[] = [
  { code: 'tipax', label: 'تیپاکس' },
  { code: 'bus', label: 'اتوبوس' },
  { code: 'freight', label: 'باربری' },
  { code: 'air', label: 'ارسال هوایی (پس‌کرایه - مشروط به وضعیت نرمال مرزها و پروازها)' },
];

/* ------------------------------ مبلغ ------------------------------ */

/**
 * جمع پرداختی، ریال.
 *
 * ⚠️ گرد کردن فقط یک بار و روی جمع نهایی: total = round(sub × (۱۰۰+نرخ) ÷ ۱۰۰)
 * و vat = total − sub، تا اقلام همیشه با جمع بخوانند و ریال کسری نداشته
 * باشد (زرین‌پال عدد صحیح می‌خواهد). چون sub صحیح است، این با
 * sub + round(sub × نرخ ÷ ۱۰۰) دقیقاً یکی است — تفاوت فقط در این است که
 * مالیات جدا گرد نمی‌شود و «۱٬۹۹۹٬۹۹۹٫۸» هیچ‌جا به «۲٬۰۰۰٬۰۰۰» تبدیل نمی‌شود
 * مگر برای نمایش. همان فرمول PHP: cyh_checkout_totals.
 */
export function checkoutTotals(subtotal: number, invoiceWanted: boolean, ratePercent: number) {
  const sub = Math.round(subtotal);
  if (!invoiceWanted) return { sub, vat: 0, total: sub };
  const total = Math.round((sub * (100 + ratePercent)) / 100);
  return { sub, vat: total - sub, total };
}

/* --------------------------- فیلدها --------------------------- */

export type InvoiceType = 'real' | 'legal';

export const CUSTOMER_FIELDS = ['name', 'phone', 'email', 'province', 'city', 'address', 'postal'] as const;
export const INVOICE_FIELDS = ['name', 'national_id', 'economic_code', 'reg_no', 'postal', 'landline', 'address'] as const;
export type CustomerField = (typeof CUSTOMER_FIELDS)[number];
export type InvoiceField = (typeof INVOICE_FIELDS)[number];

/** سقف طول (maxlength) فیلدهای عددی؛ null = محدودیت ندارد. کد ملی ۱۰، شناسه ملی ۱۱. */
export function invoiceMax(field: InvoiceField, type: InvoiceType): number | null {
  switch (field) {
    case 'national_id':
      return type === 'legal' ? 11 : 10;
    case 'economic_code':
      return 14;
    case 'reg_no':
      return 10;
    case 'postal':
      return 10;
    case 'landline':
      return 11;
    default:
      return null;
  }
}

export function customerMax(field: CustomerField): number | null {
  return field === 'phone' ? 11 : field === 'postal' ? 10 : null;
}

const tooShort = (v: string, n: number) => v.trim().length < n;

/** پیام خطا، یا '' اگر معتبر است. متن‌ها همان متن‌های سرور. */
export function validateCustomerField(field: CustomerField, value: string): string {
  switch (field) {
    case 'name':
      return tooShort(value, 3) ? 'نام و نام خانوادگی گیرنده را کامل بنویسید.' : '';
    case 'phone':
      return validMobile(value) ? '' : 'شماره موبایل معتبر نیست (مثل ۰۹۱۲۱۲۳۴۵۶۷).';
    case 'email':
      return value.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? '' : 'ایمیل معتبر نیست.';
    case 'province':
      return value.trim() === '' ? 'استان را بنویسید.' : '';
    case 'city':
      return value.trim() === '' ? 'شهر را بنویسید.' : '';
    case 'address':
      return tooShort(value, 10) ? 'نشانی را کامل بنویسید (خیابان، کوچه، پلاک).' : '';
    case 'postal':
      return validPostal(value) ? '' : 'کد پستی باید ۱۰ رقم باشد.';
  }
}

export function validateInvoiceField(field: InvoiceField, value: string, type: InvoiceType): string {
  const legal = type === 'legal';
  switch (field) {
    case 'name':
      return tooShort(value, 3) ? (legal ? 'نام کامل شرکت را بنویسید.' : 'نام و نام خانوادگی را کامل بنویسید.') : '';
    case 'national_id':
      return (legal ? validLegalId(value) : validNationalCode(value))
        ? ''
        : legal
          ? 'شناسه ملی ۱۱ رقمی معتبر نیست.'
          : 'کد ملی ۱۰ رقمی معتبر نیست.';
    case 'economic_code':
      return /^\d{10,14}$/.test(digitsOnly(value)) ? '' : 'کد اقتصادی باید ۱۰ تا ۱۴ رقم باشد.';
    case 'reg_no':
      return !legal || /^\d{1,10}$/.test(digitsOnly(value)) ? '' : 'شماره ثبت شرکت را بنویسید.';
    case 'postal':
      return validPostal(value) ? '' : 'کد پستی فاکتور باید ۱۰ رقم باشد.';
    case 'address':
      return tooShort(value, 10) ? 'نشانی کامل فاکتور را بنویسید.' : '';
    case 'landline':
      return validLandline(value) ? '' : 'تلفن ثابت یا فکس با پیش‌شماره (۱۱ رقم، مثل ۰۲۱۱۲۳۴۵۶۷۸).';
  }
}

export function validateShipping(code: string | null): string {
  return SHIPPING_METHODS.some((m) => m.code === code) ? '' : 'روش ارسال را انتخاب کنید.';
}
