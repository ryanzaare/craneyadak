// src/lib/pricing.ts
// ---------------------------------------------------------------------------
// محاسبه‌ی قیمت — عمداً بدون هیچ وابستگی، تا مستقیم با node آزموده شود
// (src/lib/pricing.test.mts) — همان الگوی block-shape.ts.
//
// ⚠️ هم‌رفتار با cyh_product_pricing() در
// wordpress-plugin/crane-yadak-headless/includes/class-pricing.php.
// صفحه‌ی استاتیک همین تابع را در زمان build اجرا می‌کند و سرور همان
// منطق را هنگام پرداخت. واگرایی این دو یعنی کسر مبلغی متفاوت از آنچه
// صفحه نشان داده — دقیقاً باگی که class-quote-requests.php داشت.
// هر تغییر اینجا → همان تغییر در PHP → مورد مرزیِ مشترک در هر دو آزمون.
// ---------------------------------------------------------------------------

export type BuyMode = 'cart' | 'rfq';
export type StockStatus = 'in_stock' | 'on_order' | 'unknown';

/** فقط فیلدهایی که قیمت به آن‌ها وابسته است — CraneProduct ساختاراً آن را دارد. */
export interface PricingInput {
  buyMode: BuyMode;
  stockStatus: StockStatus;
  price: number | null;
  salePrice: number | null;
  saleStart: string | null;
  saleEnd: string | null;
  /** آخرین تغییر/تأیید مقدار قیمت (ISO) — از کوئری اختیاری. */
  priceUpdatedAt: string | null;
  /** پایان اعتبار قیمت (ISO). null = بدون تاریخ = منقضی (پیش‌فرض امن). */
  priceValidUntil: string | null;
}

/** نتیجه‌ی محاسبه‌ی قیمت — تنها منبع مجاز برای نمایش قیمت و ساخت اسکیما. */
export interface PriceState {
  /** آیا عددی برای نمایش داریم؟ (پرداخت‌پذیر یا فقط «آخرین قیمت») */
  hasPrice: boolean;
  /** قیمتی که کاربر می‌پردازد (تخفیف‌خورده در صورت فعال بودن). */
  effective: number | null;
  /** قیمت قبل، فقط وقتی تخفیف واقعاً فعال و قلم پرداخت‌پذیر است. */
  previous: number | null;
  discountPercent: number | null;
  onSale: boolean;
  saleEnd: string | null;
  /**
   * آنلاین پرداخت‌پذیر در لحظه‌ی build: حالت cart + قیمت + «موجود در
   * انبار» + قیمت معتبر. سرور هنگام پرداخت دوباره و مستقل می‌سنجد؛ این
   * فقط راهنمای صفحه است.
   */
  payable: boolean;
  /** پایان اعتبار (ISO) — فقط وقتی payable؛ برای priceValidUntil اسکیما و محافظ مرورگر. */
  validUntil: string | null;
  /**
   * عدد فقط «آخرین قیمت» است، نه پیشنهاد فروش (ناموجود یا منقضی).
   * ⚠️ هرگز وارد JSON-LD نمی‌شود — گوگل آن را قیمت جاری می‌خواند.
   */
  reference: boolean;
  /** تاریخ آخرین قیمت (ISO) برای برچسب «آخرین قیمت (تاریخ)». */
  priceDate: string | null;
}

/**
 * «Y-m-d»، «Ymd» یا ISO → لحظه‌ی آغاز/پایان آن روز به وقت تهران.
 *
 * ⚠️ ایران از ۱۴۰۱ ساعت تابستانی ندارد؛ +03:30 ثابت. پایان **شامل** همان
 * روز است («تا ۱۰ مهر» یعنی خودِ ۱۰ مهر هم). نسخه‌ی قبل
 * `new Date(saleEnd) >= now` بود: نیمه‌شب UTC *آغاز* همان روز — تخفیف در
 * روز آخرش عملاً وجود نداشت.
 * ورودی نامعتبر → null → «بدون محدودیت»، همان رفتار PHP.
 */
export function saleBoundary(raw: string | null, endOfDay: boolean): Date | null {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec((raw ?? '').trim());
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${endOfDay ? '23:59:59' : '00:00:00'}+03:30`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const NO_PRICE: PriceState = {
  hasPrice: false,
  effective: null,
  previous: null,
  discountPercent: null,
  onSale: false,
  saleEnd: null,
  payable: false,
  validUntil: null,
  reference: false,
  priceDate: null,
};

/**
 * ⚠️ قانون یکپارچگی: حالت «استعلام» هیچ قیمتی ندارد — نه روی صفحه، نه در
 * کارت، نه در Schema.org. نمایش هم‌زمان عدد و دکمه‌ی «استعلام» پیام
 * متناقض است. این بررسی عمداً اینجاست، نه در قالب‌ها: هر جای سایت که
 * قیمت رندر می‌شود از همین تابع عبور می‌کند.
 *
 * ⚠️ «قیمت خط‌خورده» فقط وقتی قیمت عادیِ واقعی ثبت شده و تخفیف از آن
 * کمتر است — و فقط روی قلم پرداخت‌پذیر. تخفیف روی چیزی که نمی‌شود خرید،
 * ادعای بی‌پشتوانه است.
 */
export function computePrice(p: PricingInput, now: Date = new Date()): PriceState {
  if (p.buyMode === 'rfq') return NO_PRICE;

  const base = p.price !== null && p.price > 0 ? p.price : null;
  const sale = p.salePrice !== null && p.salePrice > 0 ? p.salePrice : null;
  if (base === null && sale === null) return NO_PRICE;

  let effective: number;
  let saleValid = false;
  if (base === null) {
    effective = sale!;
  } else {
    const start = saleBoundary(p.saleStart, false);
    const end = saleBoundary(p.saleEnd, true);
    saleValid = sale !== null && sale < base && (!start || start <= now) && (!end || end >= now);
    effective = saleValid ? sale! : base;
  }

  const validUntil = p.priceValidUntil ? new Date(p.priceValidUntil) : null;
  const fresh = validUntil !== null && !Number.isNaN(validUntil.getTime()) && validUntil > now;
  const payable = p.stockStatus === 'in_stock' && fresh;

  if (!payable) {
    return { ...NO_PRICE, hasPrice: true, effective, reference: true, priceDate: p.priceUpdatedAt };
  }

  return {
    hasPrice: true,
    effective,
    previous: saleValid ? base : null,
    discountPercent: saleValid && base ? Math.round(((base - effective) / base) * 100) : null,
    onSale: saleValid,
    saleEnd: saleValid ? p.saleEnd : null,
    payable: true,
    validUntil: p.priceValidUntil,
    reference: false,
    priceDate: p.priceUpdatedAt,
  };
}

/**
 * تاریخ priceValidUntil برای اسکیما: هر کدام زودتر — پایان اعتبار قیمت یا
 * پایان تخفیف. خروجی Y-m-d (قالبی که گوگل برای این ویژگی مثال می‌زند).
 */
export function schemaPriceValidUntil(state: PriceState): string | null {
  if (!state.payable || !state.validUntil) return null;
  const candidates = [new Date(state.validUntil)];
  const saleEnd = state.onSale ? saleBoundary(state.saleEnd, true) : null;
  if (saleEnd) candidates.push(saleEnd);
  const earliest = candidates.reduce((a, b) => (a < b ? a : b));
  // به وقت تهران — «تا چه روزی» برای خریدار ایرانی.
  return new Date(earliest.getTime() + 3.5 * 3600_000).toISOString().slice(0, 10);
}
