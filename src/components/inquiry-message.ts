// src/components/inquiry-message.ts
// ---------------------------------------------------------------------------
// پیام از پیش پرشده‌ی واتساپ برای قلم «استعلامی» (تصمیم ۴ کارفرما، docs/frontend-v2.md §10).
//
// چرا نام *و* کد فنی: فروشنده در واتساپ ده‌ها پیام «قیمت؟» با عکس مبهم می‌گیرد. پیامی که نام دقیق
// و کد فنی را از خود صفحه دارد، یک دور رفت‌وبرگشت «کدام قطعه؟» را حذف می‌کند و جلوی اشتباه گرفتن
// قطعه‌ی شبیه را می‌گیرد (قاعده‌ی ۲: کد اشتباه = مسئله‌ی ایمنی). بدون کد فنی، نشانی صفحه همان نقش را دارد.
//
// ⚠️ شماره فقط از تنظیمات وردپرس (`getContact().whatsappHref`) — هرگز ثابت در کد. نبودِ شماره = null و
// دکمه رندر نمی‌شود؛ دکمه‌ای که به هیچ‌جا نمی‌رود بدتر از نبودنش است.
//
// عمداً بیرون از src/lib: آن پوشه قراردادِ دست‌نخورده‌ی Frontend v2 است (§7) و این یک کمک‌تابع نمایشی است.
// آزمون: inquiry-message.test.mts (npm run test:inquiry).
// ---------------------------------------------------------------------------

export interface InquiryItem {
  name: string;
  sku: string | null | undefined;
  /** نشانی canonical صفحه — جایگزین کد فنی وقتی کدی نیست. */
  url: string;
}

export function inquiryText({ name, sku, url }: InquiryItem): string {
  const code = (sku ?? '').trim();
  return `استعلام قیمت: ${name.trim()} — ${code ? `کد فنی ${code}` : url}`;
}

export function whatsappInquiryHref(whatsappHref: string | null | undefined, item: InquiryItem): string | null {
  if (!whatsappHref) return null;
  const sep = whatsappHref.includes('?') ? '&' : '?';
  return `${whatsappHref}${sep}text=${encodeURIComponent(inquiryText(item))}`;
}
