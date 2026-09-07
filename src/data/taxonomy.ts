// src/data/taxonomy.ts
import { SILOS_DATA } from './taxonomy.generated';
// ---------------------------------------------------------------------------
// معماری سیلو (Silo) — تک منبع حقیقتِ دسته‌بندی محصولات.
//
// چرا سیلو و نه فهرست تخت:
// با ۳۰ دسته، یک فهرست تخت باعث «هم‌نوع‌خواری کلمات کلیدی» (Cannibalization)
// می‌شود: چند صفحه برای یک نیت جستجو رقابت می‌کنند و هیچ‌کدام رتبه نمی‌گیرند.
// در ساختار سیلو، صفحه‌ی والد عبارت کلی («سیستم برق‌رسانی جرثقیل سقفی») را
// هدف می‌گیرد و هر فرزند یک عبارت مشخص و بدون هم‌پوشانی («شین برق‌رسان»).
//
// ⚠️ زبان: نام فارسی هر دسته دقیقاً همان چیزی است که کارفرما تایید کرده و
// «منبع حقیقت» است. اسلاگ‌های انگلیسی صرفاً شناسه‌ی فنی URL هستند و هیچ‌وقت
// نباید از روی آن‌ها ترجمه‌ی معکوس انجام شود — فهرست اولیه یک‌بار با مترجم
// ماشینی از فارسی به انگلیسی رفته بود و چند مورد را خراب کرده بود (نمونه:
// «جرثقیل بکسلی» به اشتباه «Towable crane» ترجمه شده بود، چون مترجم «بکسل»
// را «tow» خوانده بود؛ معنای درست «بالابر سیم‌بکسلی» است).
//
// یادداشت تاریخچه: در فهرست اولیه، «کوپلینگ» و «کمربند» هرکدام در دو سیلو
// تکرار شده بودند. کارفرما تایید کرد که هر دو فقط به سیلوی «بالابر و
// متعلقات» تعلق دارند. بنابراین هر دسته دقیقاً یک سیلو و یک URL متعارف
// دارد — بدون تکرار، بدون رقابت دو صفحه‌ی خودی بر سر یک کوئری.
//
// ساختار نهایی: ۷ سیلو، ۳۰ دسته (۶ / ۴ / ۸ / ۳ / ۳ / ۳ / ۳).
// ---------------------------------------------------------------------------

export interface Category {
  /** اسلاگ یکتا — باید دقیقاً با اسلاگ ترم `crane_category` در وردپرس یکی باشد. */
  slug: string;
  /** نام دقیق و تاییدشده‌ی کارفرما. در منو، بردکرامب و کارت‌ها استفاده می‌شود. */
  name: string;
  /** عبارت کلیدی کامل — برای <title>، <h1> و متن سئویی. */
  keyword: string;
  /** توضیح یک‌خطی، واقعی و بدون ادعای اثبات‌نشده. */
  blurb: string;
  /** مسیر آیکون SVG (۲۴×۲۴، stroke-based). */
  icon: string;
  /**
   * نام‌های جایگزین/عامیانه‌ی همین قطعه. این‌ها عمداً **صفحه‌ی جدا نمی‌گیرند**
   * و فقط داخل همین صفحه به‌عنوان مترادف به کار می‌روند.
   */
  aka?: string[];
  /** یادداشت داخلی — هرگز در سایت رندر نمی‌شود. */
  note?: string;
}

export interface Silo {
  slug: string;
  name: string;
  /** عبارت کلیدی سطح والد — عمداً کلی‌تر از هر فرزند. */
  keyword: string;
  /** توضیح والد: باید ارزش مستقل داشته باشد، نه تکرار فرزندان. */
  intro: string;
  icon: string;
  categories: Category[];
}

/**
 * ساختار سیلو — از وردپرس می‌آید.
 *
 * تا پیش از این، این آرایه دستی در همین فایل نوشته شده بود و وردپرس
 * نمی‌توانست دسته‌ی جدید بسازد. حالا برعکس شده: وردپرس مرجع است و این
 * ماژول فقط عکسِ تولیدشده‌ی آن را می‌خواند.
 *
 * توابع کمکی (findCategory، categoryPath و…) عمداً همان امضای قبلی را
 * دارند تا ۱۸ فایل مصرف‌کننده دست‌نخورده بمانند.
 */
/**
 * آیکون پیش‌فرض — مربعِ ساده‌ی «قطعه».
 *
 * ⚠️ چرا لازم است: فیلد آیکون در وردپرس اختیاری است و باید هم باشد —
 * انتظار اینکه مدیر سایت هنگام ساخت دسته یک مسیر SVG بنویسد، یعنی عملاً
 * نتواند دسته بسازد. بدون این fallback، دسته‌ی تازه‌ساخته یک `<path d="">`
 * خالی رندر می‌کند: نه خطا می‌دهد، نه دیده می‌شود. یعنی دقیقاً همان
 * خرابیِ بی‌صدایی که تشخیصش سخت‌ترین است.
 */
const DEFAULT_ICON = 'M4 7h16v10H4z M4 11h16 M9 7v10';

export const SILOS: Silo[] = SILOS_DATA.map((silo) => ({
  ...silo,
  icon: silo.icon || DEFAULT_ICON,
  categories: silo.categories.map((category) => ({
    ...category,
    icon: category.icon || DEFAULT_ICON,
  })),
}));


/** همه‌ی دسته‌ها به‌صورت تخت، همراه با ارجاع به سیلوی متعارف. */
export const ALL_CATEGORIES: (Category & { silo: Silo })[] = SILOS.flatMap((silo) =>
  silo.categories.map((category) => ({ ...category, silo }))
);

/** یافتن یک دسته با اسلاگ. */
export function findCategory(slug: string): (Category & { silo: Silo }) | undefined {
  return ALL_CATEGORIES.find((c) => c.slug === slug);
}

/** مسیر متعارف (canonical) هر دسته — تودرتو، بازتاب‌دهنده‌ی سیلو. */
export function categoryPath(category: Category & { silo: Pick<Silo, 'slug'> }): string {
  return `/categories/${category.silo.slug}/${category.slug}`;
}

/** مسیر هر سیلو. */
export function siloPath(silo: Pick<Silo, 'slug'>): string {
  return `/categories/${silo.slug}`;
}

/** یافتن یک سیلو با اسلاگ. */
export function findSilo(slug: string): Silo | undefined {
  return SILOS.find((s) => s.slug === slug);
}

// ---------------------------------------------------------------------------
// برندها — عمداً در سه کلاس گروه‌بندی شده‌اند، نه یک فهرست تخت.
//
// دلیل سئویی: نیت جستجوی «قطعات دماگ» (سازنده‌ی کامل جرثقیل)، «ریموت HBC»
// (سازنده‌ی سیستم کنترل) و «کنتاکتور اشنایدر» (سازنده‌ی قطعه‌ی برقی) سه چیز
// کاملاً متفاوت است. یک فهرست تخت این سه نیت را در هم می‌ریزد و صفحه‌ی برند
// را از تمرکز خارج می‌کند.
// ---------------------------------------------------------------------------

export type BrandClass = 'oem' | 'control' | 'electrical';

export interface Brand {
  slug: string;
  nameFa: string;
  nameEn: string;
  /** متن لوگوی متنی — تا زمانی که لوگوی واقعی و دارای مجوز استفاده موجود شود. */
  logoText: string;
  brandClass: BrandClass;
  /** کشور سازنده — واقعیت قابل راستی‌آزمایی، نه ادعای بازاریابی. */
  country: string;
  /** توضیح کوتاه و دقیق درباره‌ی تخصص برند. */
  seoDesc: string;
}

export const BRAND_CLASSES: Record<BrandClass, { name: string; slug: string; intro: string }> = {
  oem: {
    name: 'سازندگان جرثقیل و بالابر',
    slug: 'crane-manufacturers',
    intro:
      'سازندگان اصلی جرثقیل سقفی و بالابر. قطعات یدکی این برندها معمولاً با کد فنی کارخانه (Part Number) شناسایی و سفارش می‌شوند.',
  },
  control: {
    name: 'سازندگان سیستم کنترل و ریموت',
    slug: 'control-systems',
    intro:
      'برندهای تخصصی ریموت کنترل رادیویی و سیستم‌های فرمان صنعتی. این تجهیزات معمولاً مستقل از برند جرثقیل انتخاب و نصب می‌شوند.',
  },
  electrical: {
    name: 'سازندگان تجهیزات برقی',
    slug: 'electrical-components',
    intro:
      'برندهای قطعات برقی صنعتی (کنتاکتور، درایو، تجهیزات حفاظت) که در تابلو فرمان جرثقیل به کار می‌روند.',
  },
};

export const BRANDS: Brand[] = [
  // --- سازندگان جرثقیل و بالابر ---
  { slug: 'demag', nameFa: 'دماگ', nameEn: 'Demag', logoText: 'DEMAG', brandClass: 'oem', country: 'آلمان', seoDesc: 'جرثقیل سقفی و بالابرهای دماگ' },
  { slug: 'stahl', nameFa: 'اشتال', nameEn: 'Stahl', logoText: 'STAHL', brandClass: 'oem', country: 'آلمان', seoDesc: 'وینچ و بالابرهای اشتال' },
  { slug: 'konecranes', nameFa: 'کونه‌کرین', nameEn: 'Konecranes', logoText: 'KONECRANES', brandClass: 'oem', country: 'فنلاند', seoDesc: 'جرثقیل و تجهیزات بالابری کونه‌کرین' },
  { slug: 'abus', nameFa: 'آبوس', nameEn: 'ABUS', logoText: 'ABUS', brandClass: 'oem', country: 'آلمان', seoDesc: 'جرثقیل سقفی و بالابرهای آبوس' },
  { slug: 'kito', nameFa: 'کیتو', nameEn: 'Kito', logoText: 'KITO', brandClass: 'oem', country: 'ژاپن', seoDesc: 'بالابرهای زنجیری و برقی کیتو' },
  { slug: 'verlinde', nameFa: 'ورلینده', nameEn: 'Verlinde', logoText: 'VERLINDE', brandClass: 'oem', country: 'فرانسه', seoDesc: 'بالابر و تجهیزات جابه‌جایی ورلینده' },
  { slug: 'podem', nameFa: 'پودم', nameEn: 'Podem', logoText: 'PODEM', brandClass: 'oem', country: 'بلغارستان', seoDesc: 'وینچ و بالابرهای پودم' },
  { slug: 'balkancar', nameFa: 'بالکانکار', nameEn: 'Balkancar', logoText: 'BALKANCAR', brandClass: 'oem', country: 'بلغارستان', seoDesc: 'تجهیزات جابه‌جایی و بالابری بالکانکار' },
  { slug: 'balkansko-echo', nameFa: 'بالکانسکو اکو', nameEn: 'Balkansko Echo', logoText: 'BALKANSKO', brandClass: 'oem', country: 'بلغارستان', seoDesc: 'قطعات بالابر بالکانسکو اکو' },
  { slug: 'rexon', nameFa: 'رکسون', nameEn: 'Rexon', logoText: 'REXON', brandClass: 'oem', country: 'تایوان', seoDesc: 'بالابر و تجهیزات رکسون' },

  // --- سازندگان سیستم کنترل و ریموت ---
  { slug: 'telecrane', nameFa: 'تله‌کرین', nameEn: 'Telecrane', logoText: 'TELECRANE', brandClass: 'control', country: 'تایوان', seoDesc: 'ریموت کنترل رادیویی صنعتی تله‌کرین' },
  { slug: 'hbc', nameFa: 'اچ‌بی‌سی', nameEn: 'HBC', logoText: 'HBC', brandClass: 'control', country: 'آلمان', seoDesc: 'سیستم‌های کنترل رادیویی HBC' },
  { slug: 'ikusi', nameFa: 'ایکوزی', nameEn: 'Ikusi', logoText: 'IKUSI', brandClass: 'control', country: 'اسپانیا', seoDesc: 'ریموت کنترل صنعتی ایکوزی' },
  { slug: 'saga', nameFa: 'ساگا', nameEn: 'Saga', logoText: 'SAGA', brandClass: 'control', country: 'تایوان', seoDesc: 'ریموت کنترل رادیویی ساگا' },
  { slug: 'txk', nameFa: 'تی‌ایکس‌کی', nameEn: 'TXK', logoText: 'TXK', brandClass: 'control', country: 'چین', seoDesc: 'ریموت کنترل و تجهیزات فرمان TXK' },
  { slug: 'vital', nameFa: 'ویتال', nameEn: 'Vital', logoText: 'VITAL', brandClass: 'control', country: 'تایوان', seoDesc: 'تجهیزات کنترل و بالابری ویتال' },

  // --- سازندگان تجهیزات برقی ---
  { slug: 'schneider', nameFa: 'اشنایدر', nameEn: 'Schneider', logoText: 'SCHNEIDER', brandClass: 'electrical', country: 'فرانسه', seoDesc: 'کنتاکتور، درایو و تجهیزات حفاظت اشنایدر' },
  { slug: 'samsung', nameFa: 'سامسونگ', nameEn: 'Samsung', logoText: 'SAMSUNG', brandClass: 'electrical', country: 'کره جنوبی', seoDesc: 'تجهیزات برقی صنعتی سامسونگ' },
];

export function brandsByClass(brandClass: BrandClass): Brand[] {
  return BRANDS.filter((b) => b.brandClass === brandClass);
}

export function findBrand(slug: string): Brand | undefined {
  return BRANDS.find((b) => b.slug === slug);
}
