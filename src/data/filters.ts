// src/data/filters.ts
// ---------------------------------------------------------------------------
// معماری دولایه‌ی فیلتر: عمومی + تخصصیِ هر دسته.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا فیلتر عمومی به‌تنهایی شکست می‌خورد
// ═══════════════════════════════════════════════════════════════════════════
// «برند» و «موجودی» برای هر قطعه‌ای معنا دارند، اما هیچ‌کدام به سوال واقعی
// خریدار جواب نمی‌دهند. کسی که دنبال کمربند (روپ‌گاید) است، برندش را
// اغلب می‌داند؛ چیزی که نمی‌داند این است که کدام کمربند به گام درام و
// قطر سیم‌بکسل دستگاه او می‌خورد. فیلترکردن بر اساس برند، فهرست ۴۰تایی را
// به ۱۲تا کاهش می‌دهد و او همچنان باید ۱۲ صفحه را باز کند.
//
// در قطعه‌ی صنعتی، «مشخصه‌ی انتخاب» تقریباً همیشه یک عدد مهندسی است، نه
// یک برچسب تجاری. به همین دلیل هر دسته فیلترهای خودش را دارد.
//
// ═══════════════════════════════════════════════════════════════════════════
// قاعده‌ی حاکم
// ═══════════════════════════════════════════════════════════════════════════
//     نمای فیلتر یک دسته = همه‌ی فیلترهای عمومی + فیلترهای فنی همان دسته
//
// ═══════════════════════════════════════════════════════════════════════════
// چگونه به داده وصل می‌شود (نکته‌ی مهم پیاده‌سازی)
// ═══════════════════════════════════════════════════════════════════════════
// این‌ها فیلد جدید ACF نمی‌سازند. روی همان `technicalSpecs` موجود کار
// می‌کنند که یک آرایه‌ی label/value است. هر فیلتر با `specLabel` به یک
// برچسب مشخصات وصل می‌شود و مقادیر در زمان build از خودِ محصولات استخراج
// می‌شوند.
//
// دلیل این انتخاب: اگر برای هر مشخصه یک فیلد ACF جدا می‌ساختیم، تعریف
// فیلدها به ۸۰+ فیلد می‌رسید و مدیر محتوا برای هر قطعه باید از میان
// ده‌ها فیلد بی‌ربط عبور می‌کرد. با روش فعلی، افزودن یک فیلتر تازه فقط
// یک ردیف در همین فایل است و هیچ مهاجرت دیتابیسی لازم ندارد.
//
// ⚠️ `specLabel` باید *دقیقاً* با برچسبی که در وردپرس وارد می‌شود یکی
// باشد. برای همین `validateFilterLabels()` در زمان build هشدار می‌دهد اگر
// فیلتری تعریف شده اما هیچ محصولی آن برچسب را ندارد.
// ---------------------------------------------------------------------------

import type { CraneProduct } from '../lib/wp';

export type FacetKind = 'checkbox' | 'range';

export interface SpecFacet {
  /** شناسه‌ی یکتا — در پارامتر URL استفاده می‌شود. */
  id: string;
  /** عنوان نمایشی فیلتر. */
  label: string;
  /**
   * برچسب مشخصه در `technicalSpecs` محصول.
   * باید مو‌به‌مو با آنچه در وردپرس وارد می‌شود یکی باشد.
   */
  specLabel: string;
  kind: FacetKind;
  /** واحد — فقط برای نمایش کنار عدد. */
  unit?: string;
  /** توضیح کوتاه: چرا این مشخصه در انتخاب قطعه اهمیت دارد. */
  hint?: string;
}

/* =========================================================================
   لایه‌ی ۱ — فیلترهای عمومی
   =========================================================================
   همه‌جا اعمال می‌شوند: آرشیو /products، صفحات دسته، و نتایج جستجو.
   این‌ها روی فیلدهای اصلی محصول کار می‌کنند نه روی مشخصات فنی.
   ========================================================================= */
export const GENERAL_FACETS = [
  { id: 'brand', label: 'برند', hint: 'سازنده‌ی قطعه' },
  { id: 'stock', label: 'موجودی', hint: 'فقط اقلام آماده‌ی ارسال' },
  { id: 'price', label: 'بازه‌ی قیمت', hint: 'اقلام استعلامی جدا نمایش داده می‌شوند' },
  { id: 'buymode', label: 'نحوه‌ی خرید', hint: 'خرید مستقیم یا استعلام و پیش‌فاکتور' },
] as const;

/* =========================================================================
   لایه‌ی ۲ — فیلترهای تخصصی هر دسته
   =========================================================================
   تحلیل مهندسی زیر بر پایه‌ی مشخصه‌هایی است که در انتخاب هر قطعه
   *تعیین‌کننده* هستند — یعنی اگر اشتباه باشند، قطعه نصب نمی‌شود یا
   زود خراب می‌شود.

   ⚠️ صداقت درباره‌ی این داده: این‌ها *پارامترهای انتخاب* هستند، نه
   مشخصات یک محصول خاص. یعنی می‌گوییم «برای انتخاب کمربند باید قطر
   سیم‌بکسل را بدانی» — که یک واقعیت مهندسی عمومی و قابل راستی‌آزمایی
   است. هیچ مقدار عددی‌ای اینجا اختراع نشده؛ مقادیر از خودِ محصولات
   واقعی در زمان build استخراج می‌شوند.
   ========================================================================= */
export const CATEGORY_FACETS: Record<string, SpecFacet[]> = {
  // ---- سیلوی ۱: بالابر و متعلقات ----
  'rope-guide': [
    { id: 'rope-dia', label: 'قطر سیم‌بکسل', specLabel: 'قطر سیم بکسل', kind: 'range', unit: 'mm',
      hint: 'کمربند باید دقیقاً با قطر سیم‌بکسل دستگاه هم‌خوان باشد؛ اختلاف چند دهم میلی‌متر باعث گیرکردن یا لغزش می‌شود.' },
    { id: 'drum-pitch', label: 'گام شیار درام', specLabel: 'گام شیار درام', kind: 'range', unit: 'mm',
      hint: 'گام اشتباه یعنی سیم‌بکسل روی درام مرتب جمع نمی‌شود و لایه‌ها روی هم می‌افتند.' },
    { id: 'drum-dia', label: 'قطر درام', specLabel: 'قطر درام', kind: 'range', unit: 'mm' },
    { id: 'rg-material', label: 'جنس بدنه', specLabel: 'جنس بدنه', kind: 'checkbox',
      hint: 'چدن مقاومت بالاتر، تفلون اصطکاک کمتر و حرکت نرم‌تر.' },
  ],

  'crane-drum': [
    { id: 'drum-dia-2', label: 'قطر درام', specLabel: 'قطر درام', kind: 'range', unit: 'mm' },
    { id: 'drum-len', label: 'طول درام', specLabel: 'طول درام', kind: 'range', unit: 'mm' },
    { id: 'groove', label: 'نوع شیار', specLabel: 'نوع شیار', kind: 'checkbox',
      hint: 'ساده یا شیاردار — روی عمر سیم‌بکسل اثر مستقیم دارد.' },
  ],

  'crane-coupling': [
    { id: 'cpl-bore', label: 'قطر داخلی', specLabel: 'قطر داخلی', kind: 'range', unit: 'mm' },
    { id: 'cpl-torque', label: 'گشتاور مجاز', specLabel: 'گشتاور مجاز', kind: 'range', unit: 'N·m',
      hint: 'گشتاور کمتر از نیاز، در راه‌اندازی زیر بار می‌شکند.' },
    { id: 'cpl-type', label: 'نوع کوپلینگ', specLabel: 'نوع کوپلینگ', kind: 'checkbox' },
  ],

  // ---- سیلوی ۲: سیستم برق‌رسانی ----
  'busbar-power-line': [
    { id: 'bb-amp', label: 'آمپراژ', specLabel: 'آمپراژ', kind: 'range', unit: 'A',
      hint: 'آمپراژ کمتر از مصرف، باعث گرم‌شدن شین و افت ولتاژ انتهای مسیر می‌شود.' },
    { id: 'bb-poles', label: 'تعداد شین (قطب)', specLabel: 'تعداد قطب', kind: 'checkbox',
      hint: 'معمولاً ۴ شینه (سه فاز + ارت). سیستم‌های کنترلی ممکن است بیشتر بخواهند.' },
    { id: 'bb-len', label: 'طول شاخه', specLabel: 'طول شاخه', kind: 'range', unit: 'm' },
  ],

  'current-collector': [
    { id: 'cc-amp', label: 'آمپراژ', specLabel: 'آمپراژ', kind: 'range', unit: 'A' },
    { id: 'cc-shoe', label: 'جنس زغال', specLabel: 'جنس زغال', kind: 'checkbox',
      hint: 'جنس زغال باید با جنس شین هم‌خوان باشد وگرنه یکی دیگری را می‌ساید.' },
    { id: 'cc-poles', label: 'تعداد قطب', specLabel: 'تعداد قطب', kind: 'checkbox' },
  ],

  'wire-and-cable': [
    { id: 'cbl-section', label: 'سطح مقطع', specLabel: 'سطح مقطع', kind: 'range', unit: 'mm²' },
    { id: 'cbl-cores', label: 'تعداد رشته', specLabel: 'تعداد رشته', kind: 'checkbox' },
  ],

  // ---- سیلوی ۳: کنترل، فرمان و ایمنی ----
  'remote-control': [
    { id: 'rc-ch', label: 'تعداد کانال', specLabel: 'تعداد کانال', kind: 'checkbox',
      hint: 'هر حرکت (بالا/پایین، چپ/راست، جلو/عقب) یک جفت کانال می‌خواهد.' },
    { id: 'rc-freq', label: 'فرکانس کاری', specLabel: 'فرکانس کاری', kind: 'checkbox' },
    { id: 'rc-ip', label: 'درجه حفاظت', specLabel: 'درجه حفاظت', kind: 'checkbox', unit: 'IP',
      hint: 'محیط غبارآلود یا مرطوب حداقل IP65 می‌خواهد.' },
  ],

  inverter: [
    { id: 'inv-kw', label: 'توان', specLabel: 'توان', kind: 'range', unit: 'kW' },
    { id: 'inv-volt', label: 'ولتاژ ورودی', specLabel: 'ولتاژ ورودی', kind: 'checkbox' },
    { id: 'inv-phase', label: 'فاز', specLabel: 'فاز', kind: 'checkbox' },
  ],

  contactor: [
    { id: 'ct-amp', label: 'جریان نامی', specLabel: 'جریان نامی', kind: 'range', unit: 'A' },
    { id: 'ct-class', label: 'کلاس کاری', specLabel: 'کلاس کاری', kind: 'checkbox',
      hint: 'AC-3 برای بار عادی، AC-4 برای قطع و وصل پرتکرار زیر بار — در جرثقیل اغلب AC-4.' },
    { id: 'ct-coil', label: 'ولتاژ بوبین', specLabel: 'ولتاژ بوبین', kind: 'checkbox' },
  ],

  microswitch: [
    { id: 'ms-lever', label: 'نوع اهرم', specLabel: 'نوع اهرم', kind: 'checkbox' },
    { id: 'ms-contacts', label: 'تعداد کنتاکت', specLabel: 'تعداد کنتاکت', kind: 'checkbox' },
    { id: 'ms-ip', label: 'درجه حفاظت', specLabel: 'درجه حفاظت', kind: 'checkbox' },
  ],

  // ---- سیلوی ۴: ترمز ----
  'brake-wheel-disc': [
    { id: 'bd-dia', label: 'قطر دیسک', specLabel: 'قطر دیسک', kind: 'range', unit: 'mm' },
    { id: 'bd-torque', label: 'گشتاور ترمز', specLabel: 'گشتاور ترمز', kind: 'range', unit: 'N·m',
      hint: 'گشتاور ناکافی یعنی بار در توقف سُر می‌خورد — بحرانی‌ترین پارامتر ایمنی این قطعه.' },
    { id: 'bd-lining', label: 'جنس لنت', specLabel: 'جنس لنت', kind: 'checkbox' },
  ],

  'brake-magnet': [
    { id: 'bm-volt', label: 'ولتاژ بوبین', specLabel: 'ولتاژ بوبین', kind: 'checkbox' },
    { id: 'bm-force', label: 'نیروی کششی', specLabel: 'نیروی کششی', kind: 'range', unit: 'N' },
    { id: 'bm-duty', label: 'دوره کاری', specLabel: 'دوره کاری', kind: 'checkbox', unit: '%ED' },
  ],

  rectifier: [
    { id: 'rc-in', label: 'ولتاژ ورودی', specLabel: 'ولتاژ ورودی', kind: 'checkbox' },
    { id: 'rc-out', label: 'ولتاژ خروجی', specLabel: 'ولتاژ خروجی', kind: 'checkbox' },
    { id: 'rc-amp2', label: 'جریان خروجی', specLabel: 'جریان خروجی', kind: 'range', unit: 'A' },
  ],

  // ---- سیلوی ۵: محرکه ----
  'gearbox-motor': [
    { id: 'gm-ratio', label: 'نسبت تبدیل', specLabel: 'نسبت تبدیل', kind: 'checkbox',
      hint: 'نسبت اشتباه یعنی سرعت حرکت با طراحی جرثقیل نمی‌خواند.' },
    { id: 'gm-kw', label: 'توان موتور', specLabel: 'توان موتور', kind: 'range', unit: 'kW' },
    { id: 'gm-rpm', label: 'دور خروجی', specLabel: 'دور خروجی', kind: 'range', unit: 'rpm' },
    { id: 'gm-mount', label: 'نوع نصب', specLabel: 'نوع نصب', kind: 'checkbox',
      hint: 'فلنجی، پایه‌دار یا شفت‌توخالی — تعیین‌کننده‌ی امکان نصب روی همان جای قبلی.' },
    { id: 'gm-brake', label: 'ترمز داخلی', specLabel: 'ترمز داخلی', kind: 'checkbox' },
  ],

  'crane-wheel': [
    { id: 'cw-dia', label: 'قطر چرخ', specLabel: 'قطر چرخ', kind: 'range', unit: 'mm' },
    { id: 'cw-tread', label: 'عرض سطح تماس', specLabel: 'عرض سطح تماس', kind: 'range', unit: 'mm' },
    { id: 'cw-flange', label: 'نوع فلنج', specLabel: 'نوع فلنج', kind: 'checkbox',
      hint: 'یک‌طرفه یا دوطرفه — با پروفیل ریل دستگاه باید بخواند.' },
    { id: 'cw-load', label: 'بار مجاز چرخ', specLabel: 'بار مجاز چرخ', kind: 'range', unit: 'kg' },
  ],

  bearing: [
    { id: 'br-bore', label: 'قطر داخلی', specLabel: 'قطر داخلی', kind: 'range', unit: 'mm' },
    { id: 'br-od', label: 'قطر خارجی', specLabel: 'قطر خارجی', kind: 'range', unit: 'mm' },
    { id: 'br-width', label: 'عرض', specLabel: 'عرض', kind: 'range', unit: 'mm' },
    { id: 'br-type', label: 'نوع بیرینگ', specLabel: 'نوع بیرینگ', kind: 'checkbox' },
  ],

  // ---- سیلوی ۶: تجهیزات بلندکردن بار ----
  'crane-hook': [
    { id: 'hk-cap', label: 'ظرفیت نامی', specLabel: 'ظرفیت نامی', kind: 'range', unit: 'ton',
      hint: 'ظرفیت قلاب هرگز نباید کمتر از ظرفیت نامی جرثقیل انتخاب شود.' },
    { id: 'hk-grade', label: 'کلاس مقاومت', specLabel: 'کلاس مقاومت', kind: 'checkbox' },
    { id: 'hk-type', label: 'نوع اتصال', specLabel: 'نوع اتصال', kind: 'checkbox',
      hint: 'شفتی یا چشمی — باید با مکانیزم بالابر موجود بخواند.' },
  ],

  'wire-rope': [
    { id: 'wr-dia', label: 'قطر', specLabel: 'قطر', kind: 'range', unit: 'mm' },
    { id: 'wr-construction', label: 'ساختار بافت', specLabel: 'ساختار بافت', kind: 'checkbox' },
    { id: 'wr-core', label: 'جنس مغزی', specLabel: 'جنس مغزی', kind: 'checkbox',
      hint: 'مغز فولادی مقاومت بالاتر، مغز کنفی انعطاف بیشتر.' },
    { id: 'wr-mbl', label: 'حداقل بار پارگی', specLabel: 'حداقل بار پارگی', kind: 'range', unit: 'kN' },
  ],

  // ---- سیلوی ۷: ریل و سازه ----
  'crane-rail': [
    { id: 'rl-profile', label: 'پروفیل ریل', specLabel: 'پروفیل ریل', kind: 'checkbox',
      hint: 'پروفیل ریل تعیین‌کننده‌ی انتخاب چرخ است؛ این دو همیشه با هم انتخاب می‌شوند.' },
    { id: 'rl-head', label: 'عرض سر ریل', specLabel: 'عرض سر ریل', kind: 'range', unit: 'mm' },
  ],

  'end-carriage': [
    { id: 'ec-span', label: 'فاصله چرخ‌ها', specLabel: 'فاصله چرخ ها', kind: 'range', unit: 'mm' },
    { id: 'ec-cap', label: 'ظرفیت', specLabel: 'ظرفیت', kind: 'range', unit: 'ton' },
  ],

  'shock-absorber': [
    { id: 'sa-stroke', label: 'کورس', specLabel: 'کورس', kind: 'range', unit: 'mm' },
    { id: 'sa-energy', label: 'انرژی جذب‌شده', specLabel: 'انرژی جذب شده', kind: 'range', unit: 'J' },
  ],
};

/** فیلترهای تخصصی یک دسته — خالی یعنی فقط فیلترهای عمومی. */
export function facetsForCategory(categorySlug: string): SpecFacet[] {
  return CATEGORY_FACETS[categorySlug] ?? [];
}

/* -------------------------------------------------------------------------
   استخراج مقادیر واقعی از محصولات
------------------------------------------------------------------------- */

export interface ResolvedFacet extends SpecFacet {
  /** مقادیر یکتای موجود (برای checkbox). */
  values: string[];
  /** کمینه/بیشینه‌ی عددی (برای range). */
  min: number | null;
  max: number | null;
  /** چند محصول این مشخصه را دارند. */
  count: number;
}

/** عدد ابتدای یک مقدار مشخصات — «۱۶ mm» → 16 */
function numericValue(raw: string): number | null {
  const normalized = raw
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/,/g, '');
  const match = normalized.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/** مقدار یک مشخصه در یک محصول. */
export function specValue(product: CraneProduct, specLabel: string): string | null {
  const row = product.technicalSpecs.find((s) => s.label.trim() === specLabel.trim());
  return row ? row.value.trim() : null;
}

/**
 * فیلترهای تخصصی را با داده‌ی واقعی پر می‌کند.
 * فیلتری که هیچ محصولی مقدارش را ندارد، حذف می‌شود — فیلتر خالی فقط
 * نوار کناری را شلوغ می‌کند.
 */
export function resolveFacets(products: CraneProduct[], facets: SpecFacet[]): ResolvedFacet[] {
  const out: ResolvedFacet[] = [];

  for (const facet of facets) {
    const raw = products
      .map((p) => specValue(p, facet.specLabel))
      .filter((v): v is string => Boolean(v));

    if (raw.length === 0) continue;

    if (facet.kind === 'range') {
      const nums = raw.map(numericValue).filter((n): n is number => n !== null);
      if (nums.length === 0) continue;
      out.push({
        ...facet,
        values: [],
        min: Math.min(...nums),
        max: Math.max(...nums),
        count: nums.length,
      });
    } else {
      const unique = [...new Set(raw)].sort((a, b) => a.localeCompare(b, 'fa'));
      out.push({ ...facet, values: unique, min: null, max: null, count: raw.length });
    }
  }

  return out;
}

/**
 * اعتبارسنجی زمان build: برچسب‌های تعریف‌شده در برابر برچسب‌های واقعی.
 *
 * چرا لازم است: `specLabel` یک رشته است و باید مو‌به‌مو با آنچه مدیر
 * محتوا در وردپرس تایپ می‌کند یکی باشد. یک «قطر درام» در برابر
 * «قطر  درام» (دو فاصله) فیلتر را بی‌صدا از کار می‌اندازد. این تابع
 * آن اختلاف را بلند اعلام می‌کند.
 */
export function validateFilterLabels(products: CraneProduct[]): void {
  if (products.length === 0) return;

  const actual = new Set<string>();
  for (const p of products) for (const s of p.technicalSpecs) actual.add(s.label.trim());

  const orphans: string[] = [];
  for (const [slug, facets] of Object.entries(CATEGORY_FACETS)) {
    for (const f of facets) {
      if (!actual.has(f.specLabel)) orphans.push(`${slug} → «${f.specLabel}» (${f.label})`);
    }
  }

  if (orphans.length > 0 && orphans.length < Object.keys(CATEGORY_FACETS).length * 4) {
    console.warn(
      `\n⚠️  ${orphans.length} فیلتر تخصصی به هیچ مشخصه‌ی واقعی وصل نیست:\n` +
        orphans.slice(0, 12).map((o) => `    • ${o}`).join('\n') +
        (orphans.length > 12 ? `\n    … و ${orphans.length - 12} مورد دیگر` : '') +
        `\n  برچسب‌ها باید دقیقاً با «برچسب مشخصه» در وردپرس یکی باشند.\n`
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   آیا نوار فیلتر اصلاً چیزی برای نشان دادن دارد؟
   ═══════════════════════════════════════════════════════════════════════
   ⚠️ باگی که این تابع رفع می‌کند — و من خودم ساخته بودمش:

   صفحه‌ی دسته چیدمان دوستونی دارد:
       grid-cols-[15rem_minmax(0,1fr)]
   ستون اول نوار فیلتر، ستون دوم شبکه‌ی محصولات.

   وقتی هیچ فیلتر مفیدی وجود ندارد، کامپوننت CategoryFilters *هیچ چیز*
   رندر نمی‌کند. آن‌وقت گرید فقط یک فرزند دارد و آن فرزند در ستون
   *اول* می‌نشیند — یعنی کل شبکه‌ی محصولات در ۱۵rem له می‌شود. دقیقاً
   همان چیزی که در صفحه‌ی «کمربند جرثقیل سقفی» دیده شد: کارت محصول به
   یک ستون باریک تبدیل شده بود و متنش سه‌نقطه خورده بود.

   این باگ وقتی ظاهر شد که شرط نمایش فیلترها را سخت‌گیرانه‌تر کردم
   (فیلتری که همه‌ی محصولات را می‌گیرد حذف شود). با یک محصول در دسته،
   هیچ فیلتری باقی نمی‌ماند و چیدمان می‌شکست.

   راه‌حل: صفحه باید *پیش از* رندر بداند که نوار فیلتر می‌آید یا نه، تا
   بتواند چیدمان تک‌ستونی یا دوستونی را انتخاب کند. همین تابع تنها مرجع
   آن تصمیم است و هر دو طرف از آن استفاده می‌کنند — تا دوباره از هم
   واگرا نشوند.
   ═══════════════════════════════════════════════════════════════════════ */
export function hasUsefulFilters(products: CraneProduct[], categorySlug: string): boolean {
  if (products.length === 0) return false;

  /** گزینه‌ای که همه یا هیچ‌کدام را می‌گیرد، چیزی را باریک نمی‌کند. */
  const narrows = (count: number) => count > 0 && count < products.length;

  const inStock = products.filter((p) => p.stockStatus === 'in_stock').length;
  const rfq = products.filter((p) => p.buyMode === 'rfq').length;
  const priced = products.filter((p) => p.price !== null || p.salePrice !== null).length;

  if (narrows(inStock) || narrows(products.length - inStock)) return true;
  if (narrows(priced) || narrows(rfq)) return true;

  const brands = new Set(products.map((p) => p.brandSlug).filter(Boolean));
  if (brands.size >= 2) return true;

  return resolveFacets(products, facetsForCategory(categorySlug)).some((f) =>
    f.kind === 'range' ? f.min !== f.max : f.values.length >= 2
  );
}
