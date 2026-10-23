// src/components/contact-mobile.ts
// ---------------------------------------------------------------------------
// خط همراه «تماس فوری» (Frontend v2، فاز ۳ — دستور کارفرما، ۲ آبان ۱۴۰۵).
//
// چرا همراه، نه ثابت ۰۲۱: مدیر کارخانه یا تکنسینِ جرثقیلِ از کار افتاده می‌خواهد همان لحظه با یک خط مستقیم حرف
// بزند. ۰۲۱ در فوتر و صفحه‌ی تماس کنار همراه می‌ماند؛ «تماس فوری» در جعبه‌ی خرید، نوار پایین، هدر و «پیدا نشد»
// همراه است.
//
// منبع (هرگز ثابت در کد — قاعده‌ی ۲): اول `phoneSecondary` وردپرس اگر همراه است، وگرنه شماره‌ی واتساپ وردپرس
// (۹۸۹… → ۰۹…). کارفرما تأیید کرده همان شماره‌ی واتساپ خط تماس همراه است. ⚠️ بیرون از src/lib (قرارداد §7).
// آزمون: contact-mobile.test.mts (npm run test:mobile).
// ---------------------------------------------------------------------------

const FA = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** هر شکل شماره‌ی همراه ایران → «09xxxxxxxxx»؛ هر چیز دیگر (ثابت، خارجی، ناقص) → null. */
export function toIranMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/\D/g, '');
  if (d.startsWith('0098')) d = d.slice(4);
  else if (d.startsWith('98') && d.length === 12) d = d.slice(2);
  if (d.length === 10 && d.startsWith('9')) d = `0${d}`;
  return /^09\d{9}$/.test(d) ? d : null;
}

export interface MobileLine {
  digits: string;
  href: string;
  /** ارقام فارسی، بدون جداکننده — همان شکلی که کارفرما خواست: «۰۹۱۲۲۸۹۲۲۵۳». */
  display: string;
}

export function mobileLine(contact: { phoneSecondary: string | null; whatsapp: string | null }): MobileLine | null {
  const digits = toIranMobile(contact.phoneSecondary) ?? toIranMobile(contact.whatsapp);
  if (!digits) return null;
  return { digits, href: `tel:${digits}`, display: digits.replace(/\d/g, (c) => FA[Number(c)]!) };
}
