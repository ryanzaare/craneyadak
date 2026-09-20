// src/lib/block-shape.ts
// ---------------------------------------------------------------------------
// شکل بلوک محتوا و نرمال‌سازی آن — **بدون هیچ وابستگی**.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا از content-blocks.ts جدا شد
// ═══════════════════════════════════════════════════════════════════════════
// این منطق یک تبدیل خالص است: داده‌ی خام گراف‌کیوال می‌گیرد، بلوک تمیز
// می‌دهد. ولی داخل فایلی زندگی می‌کرد که کلاینت وردپرس را import می‌کرد، و
// آن هم چیزهای دیگر را. نتیجه: برای آزمودنِ یک تابع خالص، باید کل گراف
// وابستگی‌ها بارگذاری می‌شد — یعنی عملاً آزمون‌ناپذیر بود.
//
// و دقیقاً همین‌جا بود که باگی چهار بلوک از هفت بلوک صفحه‌ی دماگ را بی‌صدا
// دور ریخت: `blockType` از WPGraphQL آرایه برمی‌گردد و اینجا رشته فرض شده
// بود. یک آزمون ساده با پاسخ واقعی، همان روز اول می‌گرفتش.
//
// پس این فایل عمداً هیچ import ندارد و هرگز نباید پیدا کند.
// ---------------------------------------------------------------------------

export type BlockType = 'text' | 'table' | 'faq' | 'parts' | 'media' | 'specs' | 'callout';
export type CalloutTone = 'danger' | 'note' | 'tip';

export interface BlockTableRow {
  cells: string[];
}
export interface BlockSpec {
  label: string;
  value: string;
  unit: string;
}

export interface BlockFaq {
  question: string;
  answer: string;
}
export interface BlockPart {
  partName: string;
  categorySlug: string | null;
  categoryName: string | null;
  failureReason: string;
}
export interface BlockMedia {
  kind: 'image' | 'diagram' | 'video';
  url: string | null;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string;
  videoUrl: string | null;
}

export interface ContentBlock {
  type: BlockType;
  heading: string;
  /**
   * برچسب کوتاه برای نوار ناوبری چسبان.
   *
   * ⚠️ چرا فیلد جداست و از `heading` جدا شده: یک رشته نمی‌تواند هم‌زمان دو
   * نیازِ متضاد را برآورده کند. `H2` باید بلند، پرسش‌محور و کلیدواژه‌دار
   * باشد چون گوگل می‌خواندش؛ برچسب ناوبری باید دو-سه کلمه باشد چون کنار
   * هفت برچسب دیگر در یک نوار می‌نشیند. تا امروز `SectionNav` مستقیم
   * `heading` را می‌گرفت و نتیجه نواری بود که با یک عنوان پر می‌شد.
   */
  navLabel: string;
  needsReview: boolean;
  /**
   * شناسه‌ی لنگر برای ناوبری درون‌صفحه‌ای — از **عنوان** ساخته می‌شود.
   *
   * ⚠️ پیش از این `block-${i+1}` بود، یعنی از *جایگاه*. دو ایراد داشت و
   * دومی جدی است:
   *
   *   ۱) `#block-5` برای انسان هیچ معنایی ندارد. لینکی که در واتساپ
   *      فرستاده می‌شود باید بگوید کجا می‌رود.
   *   ۲) **ناپایدار بود.** جابه‌جا کردن یک بلوک در پنل، لنگرِ *همه‌ی*
   *      بلوک‌های بعدی را عوض می‌کرد — یعنی هر لینک ذخیره‌شده، هر لینک
   *      داخلی و هر «پرش به بخش» که گوگل نشان می‌دهد، می‌شکست. بی‌صدا.
   *
   * این دقیقاً همان اشتباهی است که در `category-facets.ts` گرفته شد و
   * آنجا نوشته شد «شناسه از `spec_label` ساخته می‌شود، نه از شماره‌ی
   * ردیف» — و بعد همین‌جا تکرار شد. قاعده یکی است: **شناسه‌ی پایدار از
   * محتوا می‌آید، نه از ترتیب.**
   */
  anchor: string;
  /**
   * یادداشت ستون کناری — محتوای کوتاهِ *نوشته‌شده*، نه تکرار خودکار متن.
   *
   * ⚠️ چرا فیلد است و تولید خودکار نیست: اگر این ستون را با متنِ قالبی پر
   * کنیم، همان چند جمله روی ۳۱ صفحه‌ی دسته تکرار می‌شود و نسبت محتوای
   * یکتای هر صفحه را پایین می‌آورد — یعنی دقیقاً برعکس چیزی که ستون
   * برایش ساخته شده.
   */
  asideHtml: string;
  // متن
  bodyHtml: string;
  // جدول
  intro: string;
  columns: string[];
  rows: BlockTableRow[];
  // بقیه
  faqs: BlockFaq[];
  parts: BlockPart[];
  media: BlockMedia[];
  // مشخصات فنی
  specs: BlockSpec[];
  // هشدار
  tone: CalloutTone;
  calloutBody: string;
}

/* ⚠️ اینجا قبلاً `str`، `bool`، `num`، `unwrap`، `firstTerm` و `arr` کپی
   شده بودند — یعنی **دومین** لایه‌ی تبدیلِ مقادیر ACF در همین مخزن.

   `src/lib/acf.ts` دقیقاً برای پایان دادن به همین ساخته شد: «هر ماژول
   تبدیل خودش را نوشت و فقط یکی از شش‌تا درست بود». بعد همان فایل ساخته
   شد و بزرگ‌ترین مصرف‌کننده‌اش — همین ماژول — روی کپی خودش ماند. اگر
   روزی رفتار `acf.ts` عوض می‌شد، بلوک‌ها از آن بی‌خبر می‌ماندند.

   `acf.ts` هم هیچ وابستگی ندارد، پس این import آزمون‌پذیریِ این فایل را
   خراب نمی‌کند — همان دلیلی که این ماژول برایش جدا شد.

   ⚠️ پسوند `.ts` عمدی است. این ماژول باید مستقیم با `node` قابل اجرا باشد
   (آزمونش همین کار را می‌کند) و node بدون پسوند resolve نمی‌کند. قاعده‌ی
   پروژه: **هر ماژولی که آزمونِ مستقیم دارد، importهایش پسوند می‌گیرند.** */
import {
  acfText as str,
  acfBool as bool,
  acfNumber as num,
  acfNode as unwrap,
  acfFirstTerm as firstTerm,
  acfRows as arr,
} from './acf.ts';

/** ⚠️ این آرایه باید با choices در ACF و شاخه‌های ContentBlocks.astro یکی
 *  بماند. `check-architecture.mjs` واگرایی هر سه را می‌شکند. */
const TYPES: BlockType[] = ['text', 'table', 'faq', 'parts', 'media', 'specs', 'callout'];
const TONES: CalloutTone[] = ['danger', 'note', 'tip'];

/**
 * بیشینه‌ی طول برچسب ناوبری.
 *
 * عدد از عرض واقعی نوار می‌آید، نه از سلیقه: هشت قرصِ ۲۴ کاراکتری در
 * ۱۲۸۰ پیکسل جا می‌شوند بدون اسکرول افقی. بلندتر از این یعنی نوار روی
 * دسکتاپ هم اسکرول‌دار می‌شود و فایده‌ی «یک نگاه، کل صفحه» از بین می‌رود.
 */
export const NAV_LABEL_MAX = 24;

/*
 * جداکننده‌ها به ترتیب اولویت.
 *
 * ⚠️ خط تیره‌ی ساده (-) عمداً **نیست**. در فارسی داخل کدهای فنی و اسلاگ‌ها
 * می‌آید (`6×36WS-IWRC`) و بریدن روی آن، کد را نصف می‌کند. نیم‌فاصله هم
 * جداکننده نیست؛ داخل خود کلمه است («سیم‌بکسل»).
 */
const NAV_SEPARATORS = ['：', ':', '—', '–', '؛', '،'];

/**
 * برچسب ناوبری: یا آنچه نویسنده نوشته، یا کوتاه‌شده‌ی هوشمندِ عنوان.
 *
 * تابع خالص و بدون وابستگی است تا آزمون مستقیم داشته باشد — چون رفتارش
 * روی هر صفحه‌ی دسته و برند دیده می‌شود و «تقریباً درست» کافی نیست.
 *
 * ترتیب تصمیم:
 *   ۱) اگر نویسنده `nav_label` نوشته → همان، بی‌چون‌وچرا.
 *   ۲) اگر عنوان خودش کوتاه است → دست‌نخورده.
 *   ۳) برش روی نخستین جداکننده‌ای که سمت چپش طول معقولی دارد.
 *   ۴) در نهایت، برش روی مرز کلمه — هرگز وسط کلمه.
 */
export function deriveNavLabel(heading: string, explicit = ''): string {
  const set = explicit.trim();
  if (set) return set;

  const h = heading.trim();
  if (!h || h.length <= NAV_LABEL_MAX) return h;

  for (const sep of NAV_SEPARATORS) {
    const at = h.indexOf(sep);
    if (at < 0) continue;
    const left = h.slice(0, at).trim();
    // کوتاه‌تر از ۳ کاراکتر یعنی جداکننده در ابتدای عنوان بوده؛ آن برش
    // برچسبی بی‌معنا می‌سازد و باید جداکننده‌ی بعدی امتحان شود.
    if (left.length >= 3 && left.length <= NAV_LABEL_MAX) return left;
  }

  let out = '';
  for (const word of h.split(/\s+/)) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > NAV_LABEL_MAX) break;
    out = next;
  }
  // تنها حالتی که به اینجا می‌رسد: نخستین کلمه خودش بلندتر از سقف است.
  return out || h.slice(0, NAV_LABEL_MAX);
}

/**
 * عنوان → لنگر URL.
 *
 * ⚠️ خروجی **فارسی** است و این عمدی است. جایگزین‌ها بدترند: حرف‌نویسی به
 * لاتین هم پرخطاست هم برای خواننده‌ی فارسی بی‌معنا، و هش کوتاه (`#s-a3f2`)
 * پایدار هست ولی باز هم چیزی به آدم نمی‌گوید. مرورگر فارسی را در نوار
 * آدرس درست نشان می‌دهد.
 *
 * ⚠️ نیم‌فاصله (U+200C) به خط تیره تبدیل می‌شود، نه اینکه بماند: کاراکتر
 * نامرئی داخل URL یعنی لینکی که کپی می‌شود و بعد کسی نمی‌فهمد چرا کار
 * نمی‌کند.
 */
/* ⚠️ نشانه‌گذاری و اعرابِ فارسی **داخل** بازه‌ی حروف (U+0600–U+06FF)
   زندگی می‌کنند، پس یک فهرست سفیدِ ساده‌ی «بازه‌ی فارسی» آن‌ها را نگه
   می‌دارد. نسخه‌ی اول همین کار را کرد و «قطر-چیست؟» ساخت — علامت سوال
   داخل URL. آزمون گرفتش.

   جدا حذف می‌شوند:
     • U+0600–U+0605، U+06DD  نشانه‌های قرآنی/متنی
     • U+060C ،   U+061B ؛   U+061E ؎   U+061F ؟
     • U+0610–U+061A، U+064B–U+065F، U+0670، U+06D6–U+06ED  اعراب
       (نامرئی‌اند؛ داخل لنگر یعنی لینکی که کپی می‌شود و کار نمی‌کند)
     • U+066A–U+066D ٪٫٬٭   U+06D4 ۔ */
const FA_PUNCT_AND_MARKS =
  /[؀-؅،؍؛؞؟٪-٭۔۝ؐ-ًؚ-ٰٟۖ-ۭ]/g;

export function slugifyAnchor(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(FA_PUNCT_AND_MARKS, '')
    .replace(/[‌\s_/]+/g, '-')
    // باقی‌مانده: حروف فارسی/عربی، ارقام (لاتین و فارسی)، لاتین، خط تیره.
    .replace(/[^؀-ۿ0-9a-z-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/, '');
}

export function normalizeBlocks(raw: unknown, label = ''): ContentBlock[] {
  /* شمارنده‌ی لنگرهای تکراری. دو بلوک با عنوان یکسان در یک صفحه نادر است
     ولی ممکن — و دو `id` یکسان یعنی مرورگر همیشه به اولی می‌پرد و
     HTML نامعتبر می‌شود. */
  const usedAnchors = new Map<string, number>();

  const all = arr(raw)
    .map((r, i): ContentBlock => {
      const t = str(r.blockType) as BlockType;
      const type = TYPES.includes(t) ? t : 'text';

      // ⚠️ ستون خالی اصلاً وارد مدل نمی‌شود. یک ستونِ سراسر «—» فضا
      // می‌گیرد، به بازدیدکننده حس خرابی می‌دهد و چیزی نمی‌گوید — همان
      // چیزی که یک بار در جدول سری‌های دماگ اتفاق افتاد.
      const rawCols = [r.col1, r.col2, r.col3, r.col4, r.col5].map(str);
      const keep = rawCols.map((c, n) => (c !== '' ? n : -1)).filter((n) => n >= 0);

      const rows = arr(r.rows)
        .map((row) => ({ cells: keep.map((n) => str(row[`c${n + 1}`])) }))
        .filter((row) => row.cells.some((c) => c !== ''));

      const heading = str(r.heading);

      /* بلوک بی‌عنوان لنگر معناداری ندارد؛ فقط برای آن به جایگاه برمی‌گردیم
         — و چون در نوار ناوبری هم نمی‌آید، ناپایداری‌اش کسی را نمی‌شکند. */
      const slug = slugifyAnchor(heading);
      let anchor: string;
      if (slug === '') {
        anchor = `block-${i + 1}`;
      } else {
        const seen = (usedAnchors.get(slug) ?? 0) + 1;
        usedAnchors.set(slug, seen);
        anchor = seen === 1 ? slug : `${slug}-${seen}`;
      }

      return {
        type,
        heading,
        navLabel: deriveNavLabel(heading, str(r.navLabel)),
        needsReview: bool(r.needsReview),
        anchor,
        asideHtml: str(r.aside),
        bodyHtml: str(r.body),
        intro: str(r.intro),
        columns: keep.map((n) => rawCols[n]),
        rows,
        faqs: arr(r.faqs)
          .map((f) => ({ question: str(f.question), answer: str(f.answer) }))
          .filter((f) => f.question !== ''),
        parts: arr(r.parts)
          .map((p) => {
            const term = firstTerm(p.category);
            return {
              partName: str(p.partName),
              categorySlug: term.slug,
              categoryName: term.name,
              failureReason: str(p.failureReason),
            };
          })
          .filter((p) => p.partName !== ''),
        media: arr(r.media)
          .map((m) => {
            const asset = unwrap(m.asset);
            const details = unwrap(asset?.mediaDetails);
            const kind = str(m.kind);
            return {
              kind: (kind === 'video' || kind === 'diagram' ? kind : 'image') as BlockMedia['kind'],
              url: asset ? str(asset.sourceUrl) || null : null,
              width: num(details?.width),
              height: num(details?.height),
              alt: str(m.altText) || (asset ? str(asset.altText) : ''),
              caption: str(m.caption),
              videoUrl: str(m.videoUrl) || null,
            };
          })
          .filter((m) => (m.kind === 'video' ? m.videoUrl : m.url)),

        specs: arr(r.specs)
          .map((x) => ({ label: str(x.label), value: str(x.value), unit: str(x.unit) }))
          // مشخصه‌ی بدون مقدار، یک ردیف نیمه‌کاره است؛ روی صفحه «—» نشان
          // دادن بدتر از نبودنش است.
          .filter((x) => x.label !== '' && x.value !== ''),

        tone: (TONES.includes(str(r.tone) as CalloutTone) ? str(r.tone) : 'note') as CalloutTone,
        calloutBody: str(r.calloutBody),
      };
    });

  /*
   * بلوکی که هیچ محتوایی ندارد، یک ردیف فراموش‌شده است و نباید رندر شود.
   *
   * ⚠️ ولی «دور ریختن در سکوت» همان چیزی بود که گذاشت ۴ بلوک از ۷ بلوک
   * دماگ ناپدید شوند و build سبز بماند. حذف درست است؛ نگفتنش نه.
   */
  const kept = all.filter((b) => hasContent(b));

  if (label && kept.length < all.length) {
    const lost = all
      .filter((b) => !hasContent(b))
      .map((b) => `${b.type}${b.heading ? ` «${b.heading}»` : ''}`);
    console.warn(
      `[blocks] ⚠ ${label}: ${all.length - kept.length} بلوک از ${all.length} بلوک ` +
        `چون خالی بودند رندر نمی‌شوند: ${lost.join('، ')}`,
    );
  }

  return kept;
}

export function hasContent(b: ContentBlock): boolean {
  switch (b.type) {
    case 'text':  return b.bodyHtml !== '';
    case 'table': return b.rows.length > 0 && b.columns.length > 0;
    case 'faq':   return b.faqs.length > 0;
    case 'parts': return b.parts.length > 0;
    case 'media': return b.media.length > 0;
    case 'specs': return b.specs.length > 0;
    case 'callout': return b.calloutBody !== '';
    default:      return false;
  }
}
