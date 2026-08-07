// src/data/site.ts

export const SITE = {
  name: 'کرین یدک',
  legalName: 'شرکت تامین قطعات جرثقیل کرین یدک',
  url: 'https://craneyadak.com',
  tagline: 'تامین تخصصی قطعات جرثقیل سقفی',
  description:
    'تخصصی‌ترین مرجع تامین و فروش لوازم یدکی جرثقیل سقفی در ایران. ارائه قطعات اصلی دماگ، اشتال، کونه‌کرین و تله‌کرین با ضمانت اصالت کالا.',
  locale: 'fa_IR',
  phone: '021-12345678',
  phoneDisplay: '۰۲۱-۱۲۳۴۵۶۷۸',
  whatsapp: '+989120000000',
  // یوزرنیم تلگرام (بدون @) — کانال ارتباطی اصلی مهندسین/مدیران خرید صنعتی
  // ایران؛ نرخ پاسخ‌دهی و نصب آن معمولاً از واتساپ در مخاطب B2B ایرانی بالاتر است.
  telegram: 'craneyadak',
  email: 'info@craneyadak.com',
  address: {
    street: 'خیابان صنعتی، پلاک ۱۰',
    city: 'تهران',
    region: 'تهران',
    postalCode: '1234567890',
    country: 'IR',
  },
  // ⚠️ سئوی محلی (Local SEO) — TODO قبل از انتشار نهایی:
  // مقادیر lat/lng فعلاً null هستند چون آدرس بالا خودش placeholder است
  // («خیابان صنعتی پلاک ۱۰» + کدپستی ۱۲۳۴۵۶۷۸۹۰ واقعی نیست). ثبت یک
  // مختصات جغرافیایی برای یک آدرس جعلی، به‌اندازه‌ی ساختن ریویوی تقلبی
  // گمراه‌کننده است — یک پین اشتباه روی نقشه اعتماد خریدار B2B را از بین
  // می‌برد. به محض داشتن آدرس واقعی دفتر/انبار، مقدار را از روی Google
  // Maps (کلیک راست روی موقعیت → کپی مختصات) یا نشان جایگزین کنید؛ کد
  // مصرف‌کننده (index.astro, contact.astro) به‌صورت خودکار GeoCoordinates
  // را در Schema.org و نقشه‌ی جاسازی‌شده فعال می‌کند.
  geo: {
    lat: null as number | null,
    lng: null as number | null,
  },
  // ساعات کاری ساختاریافته — همان مقداری که در contact.astro به‌صورت متن
  // نمایش داده می‌شود، اما این‌جا هم برای Schema.org openingHoursSpecification
  // استفاده می‌شود تا هرگز بین متن نمایشی و داده‌ی ساختاریافته واگرا نشود.
  hours: [
    { dayOfWeek: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'], opens: '08:30', closes: '17:00' },
    { dayOfWeek: ['Thursday'], opens: '08:30', closes: '13:00' },
  ],
  social: {
    instagram: 'https://www.instagram.com/craneyadak',
    // ⚠️ سئوی محلی — TODO: این دو مورد مهم‌ترین منابع «Local Citation» در
    // ایران هستند (کاربران ایرانی برای جستجوی محلی از نشان/بلد بیش از
    // گوگل‌مپ استفاده می‌کنند). پس از ساخت پروفایل کسب‌وکار واقعی در هرکدام،
    // لینک را اینجا قرار دهید تا در sameAs اسکیمای LocalBusiness و کارت
    // تماس نمایش داده شود.
    googleBusinessProfile: '',
    neshan: '',
    balad: '',
  },
} as const;

export interface Category {
  name: string;
  keyword: string;
  slug: string;
  blurb: string;
  icon: string;
}

export const CATEGORIES: Category[] = [
  {
    name: 'ریموت کنترل',
    keyword: 'ریموت کنترل جرثقیل سقفی',
    slug: '/categories/remote-control',
    blurb: 'انواع ریموت‌های صنعتی تله‌کرین و ساگا ویژه کنترل دقیق بالابرها.',
    icon: 'M7 4a2 2 0 012-2h6a2 2 0 012 2v16a2 2 0 01-2 2H9a2 2 0 01-2-2V4z M10 8h4 M10 12h4 M10 16h4 M12 2v2',
  },
  {
    name: 'شین برق‌رسان',
    keyword: 'شین برق‌رسان جرثقیل',
    slug: '/categories/conductor-bar',
    blurb: 'سیستم‌های انتقال قدرت و شین‌های باز و بسته دماگ و فاله.',
    icon: 'M4 8h16v4H4z M10 12l-2 6h8l-2-6 M12 18v4 M8 22h8 M4 4h16',
  },
  {
    name: 'چرخ راهبر',
    keyword: 'چرخ راهبر و کلگی',
    slug: '/categories/crane-wheels',
    blurb: 'چرخ‌های فولادی آلیاژی ضدسایش ویژه حرکت طولی و عرضی.',
    icon: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 16a4 4 0 100-8 4 4 0 000 8z M12 14a2 2 0 100-4 2 2 0 000 4z M4.93 4.93l14.14 14.14 M19.07 4.93L4.93 19.07',
  },
  {
    name: 'کمربند جرثقیل',
    keyword: 'کمربند و راهنمای سیم‌بکسل',
    slug: '/categories/rope-guide',
    blurb: 'روپ‌گایدهای اورجینال جهت جلوگیری از پارگی سیم‌بکسل.',
    icon: 'M4 6h16v12H4z M2 10h20v4H2z M8 6v12 M16 6v12 M12 6v12',
  },
  {
    name: 'موتور گیربکس',
    keyword: 'موتور گیربکس و وینچ',
    slug: '/categories/wire-rope-hoist',
    blurb: 'موتورهای بالابر قدرتمند اشتال، دماگ و آبوس با راندمان بالا.',
    icon: 'M5 6h14v6H5z M9 12v6 M15 12v6 M10 18h4 M12 18v3c0 1.5-1.5 2-3 2',
  },
  {
    name: 'جاروبک',
    keyword: 'جاروبک شین برق',
    slug: '/categories/current-collector',
    blurb: 'زغال و جاروبک‌های انتقال جریان با کمترین میزان افت ولتاژ.',
    icon: 'M8 4h8 M12 4v6 M7 10h10l-1 4H8z M12 14v6 M10 20h4',
  },
  {
    name: 'قلاب و قرقره',
    keyword: 'بلاک قلاب جرثقیل',
    slug: '/categories/crane-hook',
    blurb: 'قلاب‌های فورج‌شده استاندارد DIN با ضریب اطمینان بالا.',
    icon: 'M12 3v3 M9 6h6v3H9z M12 9v5 M12 14c-3 0-5 2-5 5s2 4 4 4c1.5 0 2.5-.5 2.5-.5v-2.5s-1 .5-2 .5c-1.5 0-2-1-2-2.5s1.5-4 3-4h.5v-4.5z',
  },
  {
    name: 'دیسک ترمز',
    keyword: 'لنت و دیسک ترمز',
    slug: '/categories/brake-disk',
    blurb: 'مگنت، لنت و دیسک ترمز موتورهای مگنت‌دار بالابر.',
    icon: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 18a6 6 0 100-12 6 6 0 000 12z M9 12h6 M12 9v6 M10 4.5l4 15 M4.5 10l15 4',
  },
];

export interface Brand {
  slug: string;
  nameFa: string;
  nameEn: string;
  brandColor: string;
  seoAnchor: string;
  seoDesc: string;
  logoText: string;
}

export const ENRICHED_BRANDS: Brand[] = [
  { slug: '/brands/demag', nameFa: 'دماگ', nameEn: 'DEMAG', brandColor: 'group-hover:text-[#F2A900]', seoAnchor: 'خرید قطعات اورجینال و موتور گیربکس دماگ آلمان', seoDesc: 'تامین و خرید تجهیزات جرثقیل سقفی دماگ (Demag)', logoText: 'DEMAG' },
  { slug: '/brands/stahl', nameFa: 'اشتال', nameEn: 'STAHL', brandColor: 'group-hover:text-[#E3000F]', seoAnchor: 'تامین قطعات و وینچ بالابر اشتال (Stahl)', seoDesc: 'فروش قطعات اصلی و لوازم یدکی جرثقیل‌های اشتال', logoText: 'STAHL' },
  { slug: '/brands/konecranes', nameFa: 'کونه‌کرین', nameEn: 'KONECRANES', brandColor: 'group-hover:text-[#005F9E]', seoAnchor: 'فروش قطعات و لوازم جانبی جرثقیل کونه‌کرین فنلاند', seoDesc: 'تامین تجهیزات بالابرهای کونه‌کرین', logoText: 'KONECRANES' },
  { slug: '/brands/telecrane', nameFa: 'تله‌کرین', nameEn: 'TELECRANE', brandColor: 'group-hover:text-[#FF6600]', seoAnchor: 'نمایندگی فروش ریموت کنترل صنعتی تله‌کرین تایوان', seoDesc: 'خرید ریموت کنترل تله‌کرین F21 و F24', logoText: 'TELECRANE' },
  { slug: '/brands/kito', nameFa: 'کیتو', nameEn: 'KITO', brandColor: 'group-hover:text-[#F3D03E]', seoAnchor: 'لوازم یدکی و بالابرهای برقی کیتو (Kito) ژاپن', seoDesc: 'تامین قطعات جرثقیل‌های کیتو', logoText: 'KITO' },
  { slug: '/brands/abus', nameFa: 'آبوس', nameEn: 'ABUS', brandColor: 'group-hover:text-[#D2232A]', seoAnchor: 'فروش لوازم یدکی و وینچ بالابر آبوس آلمان', seoDesc: 'خرید قطعات اصلی جرثقیل آبوس', logoText: 'ABUS' },
  { slug: '/brands/swf', nameFa: 'اس‌دبلیواف', nameEn: 'SWF', brandColor: 'group-hover:text-[#E30613]', seoAnchor: 'تامین قطعات جرثقیل اس‌دبلیواف (SWF)', seoDesc: 'تامین تجهیزات بالابر SWF', logoText: 'SWF' },
  { slug: '/brands/podem', nameFa: 'پودم', nameEn: 'PODEM', brandColor: 'group-hover:text-[#004B87]', seoAnchor: 'قطعات یدکی جرثقیل‌های پودم بلغارستان', seoDesc: 'تامین وینچ و لوازم پودم کرین', logoText: 'PODEM' },
];

export const BRANDS = [
  'دماگ (Demag)',
  'اشتال (Stahl)',
  'کونه‌کرین (Konecranes)',
  'تله‌کرین (Telecrane)',
  'کیتو (Kito)',
  'آبوس (ABUS)',
  'اس‌دبلیواف (SWF)',
  'پودم (Podem)',
] as const;