// src/lib/site-options.ts
// ---------------------------------------------------------------------------
// تنظیمات سایت از وردپرس — صفحه‌ی «تنظیمات کرین یدک».
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ چرا این فایل تازه ساخته شد، در حالی که فیلدهایش ماه‌هاست وجود دارند
// ═══════════════════════════════════════════════════════════════════════════
// گروه فیلد `siteOptionsFields` از ابتدا در افزونه تعریف شده بود و شامل
// پرسش‌های متداول، ساعات کاری، مختصات جغرافیایی و لینک‌های شبکه‌های
// اجتماعی است. مدیر سایت می‌توانست همه را در پنل پر کند.
//
// اما فرانت‌اند *هرگز آن را نخواند*. حتی یک بار. به‌جایش از آرایه‌های
// hardcode شده در `src/data/content.ts` و `src/data/site.ts` استفاده
// می‌کرد.
//
// این دقیقاً همان الگویی است که در دسته‌ها، برندها و گروه‌های برند هم
// تکرار شد: فیلد در بک‌اند ساخته می‌شود، فرانت‌اند از فهرست محلی
// می‌خواند، و هیچ خطایی هیچ‌جا چاپ نمی‌شود. بدترین نوع خرابی — چون
// کاربر داده را وارد می‌کند و هیچ اتفاقی نمی‌افتد.
//
// از این پس وردپرس مرجع است.
// ---------------------------------------------------------------------------

import { acfString, acfList } from './acf';
import { wpQueryPublic } from './wp';

export interface SiteFaq {
  q: string;
  /** HTML مورد اعتماد از ویرایشگر وردپرس. */
  a: string;
}

export interface SiteContact {
  phonePrimary: string | null;
  phoneSecondary: string | null;
  whatsapp: string | null;
  email: string | null;
  street: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  /** آیا حداقل تلفن اصلی ثبت شده؟ کنترل انتشار NAP در اسکیما. */
  hasRealContact: boolean;
}

export interface SiteHours {
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

export interface SiteAdvantage {
  title: string;
  body: string;
}

export interface SiteHighlight {
  label: string;
  value: string;
}

export interface SiteAuthorityBlock {
  heading: string;
  paragraphs: string[];
  highlights: SiteHighlight[];
}

export interface SiteWearItem {
  categorySlug: string;
  reason: string;
}

export interface SiteOptions {
  faqs: SiteFaq[];
  hours: SiteHours[];
  contact: SiteContact;
  geo: { lat: number | null; lng: number | null };
  social: {
    googleBusinessProfile: string | null;
    neshan: string | null;
    balad: string | null;
    instagram: string | null;
    telegram: string | null;
  };
  advantages: SiteAdvantage[];
  /** `null` یعنی عنوان بلوک هنوز در پنل ثبت نشده — کامپوننت اصلاً رندر نمی‌کند. */
  authority: SiteAuthorityBlock | null;
  highWearParts: SiteWearItem[];
  /** آیا وردپرس واقعاً چیزی برگرداند؟ برای گزارش زمان build. */
  fromWordPress: boolean;
}

/* ⚠️ سه شکل کوئری، به ترتیب اولویت — و چرا.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * `craneSiteOptions` (اول) — فیلدی که *خود افزونه‌ی ما* ثبت می‌کند.
 *   انتشار فیلدهای ACF روی یک Options Page به نسخه و تنظیمات افزونه‌ی
 *   «WPGraphQL for ACF» وابسته بود و در عمل کار نکرد:
 *       Cannot query field "siteOptionsFields" on type "RootQuery"
 *   حالا افزونه‌ی خودمان این فیلد را با `register_graphql_field` ثبت
 *   می‌کند و مقادیر را با `get_field(..., 'option')` می‌خواند — API ای
 *   که ACF برای options page تضمین می‌کند. هیچ وابستگی به رفتار
 *   نسخه‌ی افزونه‌ی جانبی باقی نمی‌ماند.
 *
 * دو شکل بعدی فقط برای سازگاری عقب‌رو هستند: اگر روزی نسخه‌ی جدید
 * WPGraphQL for ACF این را بومی منتشر کرد، بدون تغییر کد کار می‌کند.
 * ═══════════════════════════════════════════════════════════════════════
 */
const OPTION_FIELDS = `
  faqs { question answer }
  businessHours { days opens closes }
  geoLat
  geoLng
  googleBusinessProfile
  neshan
  balad
  instagram
  telegram
  phonePrimary
  phoneSecondary
  whatsapp
  supportEmail
  addressStreet
  addressCity
  addressRegion
  addressPostal
  advantages { title body }
  authorityHeading
  authorityParagraphs
  authorityHighlights { label value }
  highWearParts { categorySlug reason }
`;

const QUERY_SHAPES: { name: string; query: string; pick: (d: any) => RawOptions | null }[] = [
  {
    name: 'craneSiteOptions',
    query: `query CraneSiteOptions { craneSiteOptions { ${OPTION_FIELDS} } }`,
    pick: (d) => d?.craneSiteOptions ?? null,
  },
  {
    name: 'craneSiteSettings.siteOptionsFields',
    query: `query CraneSiteOptions { craneSiteSettings { siteOptionsFields { ${OPTION_FIELDS} } } }`,
    pick: (d) => d?.craneSiteSettings?.siteOptionsFields ?? null,
  },
  {
    name: 'siteOptionsFields',
    query: `query CraneSiteOptions { siteOptionsFields { ${OPTION_FIELDS} } }`,
    pick: (d) => d?.siteOptionsFields ?? null,
  },
];

interface RawOptions {
  faqs?: ({ question?: string | null; answer?: string | null } | null)[] | null;
  businessHours?: ({ days?: unknown; opens?: string | null; closes?: string | null } | null)[] | null;
  geoLat?: number | null;
  geoLng?: number | null;
  googleBusinessProfile?: string | null;
  neshan?: string | null;
  balad?: string | null;
  instagram?: string | null;
  telegram?: string | null;
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  whatsapp?: string | null;
  supportEmail?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressRegion?: string | null;
  addressPostal?: string | null;
  advantages?: ({ title?: string | null; body?: string | null } | null)[] | null;
  authorityHeading?: string | null;
  authorityParagraphs?: (string | null)[] | null;
  authorityHighlights?: ({ label?: string | null; value?: string | null } | null)[] | null;
  highWearParts?: ({ categorySlug?: string | null; reason?: string | null } | null)[] | null;
}

const EMPTY_CONTACT: SiteContact = {
  phonePrimary: null,
  phoneSecondary: null,
  whatsapp: null,
  email: null,
  street: null,
  city: null,
  region: null,
  postalCode: null,
  hasRealContact: false,
};

// از مرز مشترک — نه یک کپی محلی دیگر.
const clean = acfString;

function cleanUrl(value: unknown): string | null {
  const raw = clean(value);
  if (!raw) return null;
  // لینک نامعتبر بدتر از نبود لینک است — وارد sameAs اسکیما می‌شود.
  return /^https?:\/\//i.test(raw) ? raw : null;
}

const EMPTY: SiteOptions = {
  faqs: [],
  hours: [],
  contact: EMPTY_CONTACT,
  geo: { lat: null, lng: null },
  social: { googleBusinessProfile: null, neshan: null, balad: null, instagram: null, telegram: null },
  advantages: [],
  authority: null,
  highWearParts: [],
  fromWordPress: false,
};

let optionsPromise: Promise<SiteOptions> | null = null;

async function fetchOptions(): Promise<SiteOptions> {
  let raw: RawOptions | null = null;
  const failures: string[] = [];

  /* هر شکل را به ترتیب امتحان می‌کند و اولین پاسخ معتبر را می‌گیرد.
     ⚠️ خطای یک شکل، بقیه را متوقف نمی‌کند — چون «فیلد وجود ندارد» یک
     خطای گراف‌کیوال است، نه نشانه‌ی خرابی سرور. */
  for (const shape of QUERY_SHAPES) {
    try {
      const data = await wpQueryPublic<any>(shape.query, {});
      const picked = shape.pick(data);
      if (picked) {
        raw = picked;
        break;
      }
      failures.push(`${shape.name}: پاسخ خالی`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${shape.name}: ${message.slice(0, 90)}`);
    }
  }

  if (!raw) {
    console.warn(
      `\n⚙️  تنظیمات سایت از وردپرس خوانده نشد — اطلاعات تماس، پرسش‌های\n` +
        `   متداول و لینک‌ها روی سایت نمایش داده نمی‌شوند.\n\n` +
        failures.map((f) => `     • ${f}`).join('\n') +
        `\n\n   اگر همه‌ی موارد بالا «Cannot query field» هستند، آخرین نسخه‌ی\n` +
        `   افزونه‌ی «کرین یدک» نصب نیست. بررسی کنید:\n` +
        `     ۱) افزونه‌ها ← «Crane Yadak — Headless Backend» روی آخرین نسخه فعال است؟\n` +
        `        (شماره‌ی نسخه را اینجا هاردکد نکنید — قبلاً یک بار ۱.۳.۱ نوشته شده بود\n` +
        `        و ده‌ها نسخه عقب افتاد بدون اینکه کسی متوجه شود.)\n` +
        `     ۲) تنظیمات کرین یدک ← مقادیر تماس و پرسش‌های متداول پر شده‌اند؟\n`
    );
    return EMPTY;
  }

  const faqs: SiteFaq[] = (raw.faqs ?? [])
    .map((row) => {
      const q = clean(row?.question);
      const a = clean(row?.answer);
      // پرسش بدون پاسخ وارد اسکیمای FAQPage نمی‌شود — گوگل آن را
      // به‌عنوان داده‌ی ناقص علامت می‌زند.
      return q && a ? { q, a } : null;
    })
    .filter((row): row is SiteFaq => row !== null);

  const phonePrimary = clean(raw.phonePrimary);

  const hours: SiteHours[] = (raw.businessHours ?? [])
    .map((row) => {
      /* ⚠️ این `dayOfWeek` بود، ولی نام فیلد در ACF `days` است. کوئری با
         «Cannot query field dayOfWeek» می‌افتاد و ساعت کاری **هرگز** وارد
         JSON-LD نمی‌شد — یعنی openingHoursSpecification در LocalBusiness
         غایب بود و هیچ‌کس خبر نداشت، چون این واکشی در سکوت تنزل می‌کرد. */
      const days = acfList(row?.days);
      const opens = clean(row?.opens);
      const closes = clean(row?.closes);
      // ساعت ناقص وارد اسکیما نمی‌شود — گوگل آن را نامعتبر می‌داند.
      return days.length > 0 && opens && closes ? { dayOfWeek: days, opens, closes } : null;
    })
    .filter((row): row is SiteHours => row !== null);

  const advantages: SiteAdvantage[] = (raw.advantages ?? [])
    .map((row) => {
      const title = clean(row?.title);
      const body = clean(row?.body);
      return title && body ? { title, body } : null;
    })
    .filter((row): row is SiteAdvantage => row !== null);

  const authorityHeading = clean(raw.authorityHeading);
  const authorityParagraphs = (raw.authorityParagraphs ?? [])
    .map((p) => clean(p))
    .filter((p): p is string => p !== null);
  const authorityHighlights: SiteHighlight[] = (raw.authorityHighlights ?? [])
    .map((row) => {
      const label = clean(row?.label);
      const value = clean(row?.value);
      return label && value ? { label, value } : null;
    })
    .filter((row): row is SiteHighlight => row !== null);
  // بلوکِ نیمه — عنوان بدون پاراگراف یا برعکس — بدتر از نبودِ بلوک است.
  const authority: SiteAuthorityBlock | null =
    authorityHeading && authorityParagraphs.length > 0
      ? { heading: authorityHeading, paragraphs: authorityParagraphs, highlights: authorityHighlights }
      : null;

  const highWearParts: SiteWearItem[] = (raw.highWearParts ?? [])
    .map((row) => {
      const categorySlug = clean(row?.categorySlug);
      const reason = clean(row?.reason);
      return categorySlug && reason ? { categorySlug, reason } : null;
    })
    .filter((row): row is SiteWearItem => row !== null);

  return {
    faqs,
    hours,
    contact: {
      phonePrimary,
      phoneSecondary: clean(raw.phoneSecondary),
      whatsapp: clean(raw.whatsapp),
      email: clean(raw.supportEmail),
      street: clean(raw.addressStreet),
      city: clean(raw.addressCity),
      region: clean(raw.addressRegion),
      postalCode: clean(raw.addressPostal),
      /* ⚠️ تلفن اصلی، شرط انتشار NAP در اسکیماست.
         قبلاً شماره و کدپستی ساختگی داخل LocalBusiness منتشر می‌شد و
         این خطرناک‌ترین قلم داده‌ی جعلی پروژه بود. حالا اگر مدیر سایت
         تلفن واقعی وارد نکرده باشد، هیچ NAPی وارد داده‌ی ساختاریافته
         نمی‌شود — نه شماره‌ی جعلی، نه هیچ چیز. */
      hasRealContact: Boolean(phonePrimary),
    },
    geo: {
      lat: typeof raw.geoLat === 'number' ? raw.geoLat : null,
      lng: typeof raw.geoLng === 'number' ? raw.geoLng : null,
    },
    social: {
      googleBusinessProfile: cleanUrl(raw.googleBusinessProfile),
      neshan: cleanUrl(raw.neshan),
      balad: cleanUrl(raw.balad),
      instagram: cleanUrl(raw.instagram),
      telegram: cleanUrl(raw.telegram),
    },
    advantages,
    authority,
    highWearParts,
    fromWordPress: true,
  };
}

export function getSiteOptions(): Promise<SiteOptions> {
  optionsPromise ??= fetchOptions();
  return optionsPromise;
}

/**
 * پرسش‌های متداول — فقط از وردپرس.
 *
 * ⚠️ دیگر هیچ فالبک محلی وجود ندارد. اگر وردپرس پرسشی برنگرداند، آرایه
 * خالی است و صفحه بخش پرسش‌ها و گره FAQPage را رندر نمی‌کند.
 *
 * این عمدی است: صفحه‌ای که پرسشی نمایش نمی‌دهد نباید در داده‌ی
 * ساختاریافته ادعای FAQPage داشته باشد. داده‌ی ساختاریافته باید بازتاب
 * چیزی باشد که کاربر می‌بیند.
 */
export async function getFaqs(): Promise<SiteFaq[]> {
  const options = await getSiteOptions();

  if (options.faqs.length === 0) {
    console.warn(
      `\n⚠️  هیچ پرسش متداولی در وردپرس ثبت نشده — بخش پرسش‌ها و اسکیمای\n` +
        `   FAQPage روی صفحه‌ی اصلی رندر نمی‌شوند.\n` +
        `   پنل ← تنظیمات کرین یدک ← پرسش‌های متداول\n`
    );
  } else {
    console.log(`[wp] ✓ ${options.faqs.length} پرسش متداول از وردپرس خوانده شد.`);
  }

  return options.faqs;
}

/**
 * مزیت‌های بخش «چرا کرین یدک» — فقط از وردپرس.
 *
 * جای‌گیر ندارد: اگر پنل چیزی برنگرداند، بخش اصلاً رندر نمی‌شود. آیکون هر
 * کارت در کد ثابت است (`ADVANTAGE_ICONS` در `src/pages/index.astro`) و با
 * ترتیب ردیف‌های پنل جفت می‌شود.
 */
export async function getAdvantages(): Promise<SiteAdvantage[]> {
  const options = await getSiteOptions();

  if (options.advantages.length === 0) {
    console.warn(
      `\n⚠️  هیچ مزیتی در «تنظیمات کرین یدک ← مزیت‌های صفحه‌ی اصلی» ثبت نشده — \n` +
        `   بخش «چرا کرین یدک» روی صفحه‌ی اصلی رندر نمی‌شود.\n`,
    );
  }

  return options.advantages;
}

/**
 * بلوک اقتدار دامنه (پایین صفحه‌ی اصلی) — فقط از وردپرس.
 *
 * `null` یعنی عنوان یا هیچ پاراگرافی ثبت نشده؛ کامپوننت این حالت را
 * رندر نمی‌کند. بلوک نیمه‌کاره (عنوان بدون متن) بدتر از نبودِ بلوک است.
 */
export async function getAuthorityBlock(): Promise<SiteAuthorityBlock | null> {
  const options = await getSiteOptions();

  if (!options.authority) {
    console.warn(
      `\n⚠️  بلوک اقتدار دامنه در پنل کامل نیست (عنوان یا پاراگراف خالی) — \n` +
        `   این بخش پایین صفحه‌ی اصلی رندر نمی‌شود.\n` +
        `   پنل ← تنظیمات کرین یدک ← بلوک اقتدار دامنه\n`,
    );
  }

  return options.authority;
}

/**
 * «قطعات مصرفی و پرتعویض» — فقط از وردپرس.
 *
 * تطبیق اسلاگ با تاکسونومی واقعی همچنان در کامپوننت (`HighWearParts.astro`)
 * انجام می‌شود، نه اینجا — دقیقاً مثل قبل از مهاجرت.
 */
export async function getHighWearParts(): Promise<SiteWearItem[]> {
  const options = await getSiteOptions();

  if (options.highWearParts.length === 0) {
    console.warn(
      `\n⚠️  هیچ «قطعه‌ی مصرفی» در پنل ثبت نشده — بخش مربوطه روی صفحه‌ی اصلی \n` +
        `   رندر نمی‌شود.\n` +
        `   پنل ← تنظیمات کرین یدک ← قطعات مصرفی و پرتعویض\n`,
    );
  }

  return options.highWearParts;
}

/* ═══════════════════════════════════════════════════════════════════════
   کمک‌کننده‌های آماده‌ی نمایش
   ═══════════════════════════════════════════════════════════════════════
   ⚠️ چرا هر مقدار می‌تواند `null` باشد و این عمدی است:

   تا پیش از این، شماره‌ی تلفن و آدرس در `src/data/site.ts` مقدار ثابت
   داشتند — و آن مقادیر ساختگی بودند (۰۲۱-۱۲۳۴۵۶۷۸، کد پستی
   ۱۲۳۴۵۶۷۸۹۰). نتیجه این بود که سایت همیشه «یک تلفن» داشت، حتی وقتی
   تلفن واقعی وارد نشده بود.

   حالا اگر مدیر سایت مقداری وارد نکرده باشد، مقدار `null` است و
   کامپوننت آن بخش را *رندر نمی‌کند*. دکمه‌ی تماسی که به شماره‌ی
   ساختگی زنگ می‌زند، بدتر از نبودِ دکمه است.
   ═══════════════════════════════════════════════════════════════════════ */

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** ارقام لاتین → فارسی، فقط برای *نمایش*. لینک tel: همیشه لاتین می‌ماند. */
function toFaDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]!);
}

export interface ContactView extends SiteContact {
  /** `tel:` آماده — `null` یعنی دکمه‌ی تماس رندر نشود. */
  telHref: string | null;
  /** شماره‌ی دوم به‌صورت `tel:`. */
  telSecondaryHref: string | null;
  /** نمایش فارسی شماره‌ی اصلی. */
  phoneDisplay: string | null;
  phoneSecondaryDisplay: string | null;
  /** لینک واتساپ — فقط رقم، بدون + و بدون فاصله. */
  whatsappHref: string | null;
  /** `mailto:` آماده. */
  emailHref: string | null;
  /** نشانی کامل یک‌خطی برای نمایش. */
  fullAddress: string | null;
}

export async function getContact(): Promise<ContactView> {
  const { contact } = await getSiteOptions();

  const digits = (value: string | null) => (value ? value.replace(/[^0-9+]/g, '') : null);
  const primary = digits(contact.phonePrimary);
  const secondary = digits(contact.phoneSecondary);
  const wa = contact.whatsapp ? contact.whatsapp.replace(/[^0-9]/g, '') : null;

  const addressParts = [contact.city, contact.street].filter(Boolean);

  return {
    ...contact,
    telHref: primary ? `tel:${primary}` : null,
    telSecondaryHref: secondary ? `tel:${secondary}` : null,
    phoneDisplay: contact.phonePrimary ? toFaDigits(contact.phonePrimary) : null,
    phoneSecondaryDisplay: contact.phoneSecondary ? toFaDigits(contact.phoneSecondary) : null,
    whatsappHref: wa ? `https://wa.me/${wa}` : null,
    emailHref: contact.email ? `mailto:${contact.email}` : null,
    fullAddress: addressParts.length > 0 ? addressParts.join('، ') : null,
  };
}
