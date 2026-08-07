# راهنمای اتصال بک‌اند Headless WordPress (WPGraphQL + ACF Pro)

این سند برای زمانی نوشته شده که پروژه‌ی فرانت‌اند (Astro) به یک بک‌اند
Headless WordPress با افزونه‌های **WPGraphQL** و **ACF Pro** متصل می‌شود.
هدف: شکل دقیق داده‌ی Mock فعلی (`src/data/site.ts` و `src/data/content.ts`)
را به CPT/Taxonomy/Field Group واقعی وردپرس نگاشت کند تا هیچ صفحه‌ای در
فرانت‌اند نیاز به بازنویسی ساختاری نداشته باشد — فقط منبع داده عوض می‌شود.

> ✅ **به‌روزرسانی**: نقشه‌ی زیر دیگر صرفاً یک پیشنهاد نیست — پیاده‌سازی
> واقعی آن به‌صورت یک پلاگین کامل و آماده‌ی نصب در پوشه‌ی
> `wordpress-plugin/crane-yadak-headless/` این پروژه ساخته شده است
> (CPTها، تکسونومی، فیلدهای ACF به‌صورت Local JSON، اندپوینت REST فرم
> تماس با ضداسپم/Rate Limiting، و CORS). راهنمای نصب دقیق در
> `wordpress-plugin/crane-yadak-headless/README.md` است. منطق REST این
> پلاگین با یک هارنس PHP محلی (خارج از خودِ پلاگین) اجرا و تست شد —
> نتایج در انتهای همین سند، بخش «وضعیت تایید».

---

## ۱. نقشه‌ی کلی Content Type ها

| داده‌ی فعلی (Mock) | نوع پیشنهادی در وردپرس | افزونه |
|---|---|---|
| `CATEGORIES` (site.ts) | Taxonomy سفارشی `crane_category` روی CPT محصول | ACF Pro (Term Fields) |
| `ENRICHED_BRANDS` (site.ts) | CPT سفارشی `brand` یا Taxonomy `crane_brand` | ACF Pro |
| `INDUSTRIES` (content.ts) | CPT سفارشی `industry` | ACF Pro |
| `BLOG_POSTS` (content.ts) | پست‌های پیش‌فرض وردپرس (`post`) + دسته‌بندی native | Yoast/RankMath اختیاری |
| `DATASHEETS` (content.ts) | CPT سفارشی `datasheet` یا فیلد Repeater روی محصول | ACF Pro |
| محصولات Mock در `categories/[slug].astro` و `brands/[slug].astro` | CPT سفارشی `product` | ACF Pro |
| `FAQS` (content.ts) | Repeater Field روی صفحه‌ی اصلی (ACF Options Page) یا CPT `faq` | ACF Options Page |
| فرم تماس (`contact.astro` + `api/contact.ts`) | WPGraphQL Mutation سفارشی یا REST `/wp-json/contact/v1/submit` | WPGraphQL + wp_mail یا CRM |

پیشنهاد: از **Custom Post Type UI** یا کد در `functions.php` برای ثبت
CPTها استفاده شود، سپس WPGraphQL آن‌ها را به‌صورت خودکار expose می‌کند
(با فعال‌سازی `show_in_graphql` هنگام ثبت CPT).

---

## ۲. CPT: `product`

فیلدهای ACF Pro پیشنهادی (Field Group: `Product Fields`):

- `sku` (Text) — کد فنی/Part Number — معادل `product.sku` فعلی
- `brand` (Relationship → CPT `brand` یا Taxonomy Term) — معادل `product.brand`
- `crane_category` (Taxonomy field → `crane_category`)
- `price_display` (Text) — چون قیمت واقعی معمولاً استعلامی است (نه فروش
  آنلاین مستقیم)، به‌جای فیلد عددی `price`، یک متن نمایشی مثل «تماس بگیرید»
  یا مقدار عددی واقعی نگه‌داری شود. **نکته حیاتی سئو**: اگر قیمت واقعی
  موجود شد، حتماً baseUrl/`priceCurrency: 'IRR'` را در Schema.org
  `Offer` اضافه کنید (فعلاً به‌عمد از schema `Offer` صرف‌نظر شده چون
  `price` ناقص، معتبر نیست — نگاه کنید به کامنت داخل
  `src/pages/categories/[slug].astro`).
- `gallery` (Gallery field) — تصاویر محصول
- `datasheet_files` (Relationship → CPT `datasheet`) — نقشه‌های فنی مرتبط
- `oem_cross_reference` (Repeater: `oem_brand` + `oem_part_number`) —
  **ایده‌ی مهم سئو/تجاری**: اکثر خریداران صنعتی با شماره‌ی OEM اصلی سازنده
  سرچ می‌کنند نه با کد داخلی فروشگاه؛ این Repeater امکان می‌دهد صفحه‌ی
  محصول برای چندین Part Number مختلف (کدهای معادل/جایگزین) رتبه بگیرد.
- `compatible_models` (Repeater: `crane_brand` + `model_name`) — برای
  محتوای «سازگار با مدل‌های...» که اعتماد خریدار صنعتی را جلب می‌کند.
- `technical_specs` (Repeater: `spec_label` + `spec_value`) — برای تولید
  جدول مشخصات فنی + `additionalProperty` در Schema.org Product.

### نمونه Query گراف‌کیوال

```graphql
query GetProductsByCategory($slug: [String]) {
  craneProducts(where: { taxQuery: { taxArray: [{ taxonomy: CRANECATEGORY, terms: $slug, field: SLUG }] } }) {
    nodes {
      title
      slug
      productFields {
        sku
        priceDisplay
        brand { ... on CraneBrand { title slug } }
        gallery { url altText }
        oemCrossReference { oemBrand oemPartNumber }
      }
    }
  }
}
```

> این نمونه دقیقاً با نوع‌ها و نام فیلدهای واقعی پلاگین
> `wordpress-plugin/crane-yadak-headless/` هم‌خوانی دارد (پیشوند `crane`
> در نام تایپ‌ها عمداً برای جلوگیری از برخورد نام با WooCommerce/افزونه‌های
> دیگر انتخاب شده — نگاه کنید به کامنت بالای `includes/class-post-types.php`).
> نمونه‌های بیشتر (برندها، تنظیمات سراسری) در README همان پوشه است.

### ✅ وضعیت پیاده‌سازی (به‌روزرسانی)

آرایه‌های `mockProducts` در `categories/[slug].astro` و `brands/[slug].astro`
**حذف شدند** و جای آن‌ها را ماژول `src/lib/wp.ts` گرفت:

- `getStaticPaths()` هر دو صفحه اکنون `async` است و محصولات واقعی را در
  زمان **build** از WPGraphQL می‌گیرد (خروجی `output: 'static'` دست‌نخورده
  باقی مانده — بازدیدکننده هیچ درخواستی به وردپرس نمی‌زند).
- برای حذف وابستگی به افزونه‌های جانبی، عمداً از `taxQuery`/`metaQuery`
  استفاده نشده (هرکدام یک افزونه‌ی مجزا لازم دارند). در عوض کل کاتالوگ
  **یک‌بار در هر build** با pagination واکشی و در حافظه فیلتر می‌شود؛ هم
  سریع‌تر است (یک رفت‌وبرگشت به‌جای N) و هم فقط به WPGraphQL + WPGraphQL
  for ACF نیاز دارد.
- متغیر محیطی: `WP_GRAPHQL_URL` (بدون پیشوند `PUBLIC_` — فقط سمت بیلد).
- **وقتی تنظیم نشده باشد** → آرایه‌ی خالی و «حالت خالیِ صادقانه» در صفحه؛
  هیچ محصول ساختگی و هیچ گره‌ی `ItemList`/`Product` تولید نمی‌شود.
- **وقتی تنظیم شده ولی در دسترس نباشد** → بیلد عمداً `throw` می‌کند.
  شکست خاموش ممنوع است: یک کاتالوگ خالی که بی‌سروصدا روی پروداکشن منتشر
  شود، صفحات واقعی را از ایندکس گوگل حذف می‌کند بدون این‌که کسی بفهمد.
- `productJsonLd()` هرگز فیلدی را که مقدار واقعی ندارد نمی‌سازد: `offers`
  فقط با قیمت عددی واقعی، و `availability` **هرگز** حدس زده نمی‌شود.

---

## ۳. CPT: `datasheet`

فیلدها: `title` (native)، `brand` (Relationship)، `doc_type` (Select:
Maintenance Manual / Exploded View / Wiring Diagram / ...)، `pdf_file`
(File field)، `file_size` (Text یا محاسبه‌ی خودکار از متادیتای فایل در
سمت وردپرس). خروجی مستقیماً جایگزین آرایه‌ی `DATASHEETS` در `content.ts`
می‌شود.

---

## ۴. CPT: `industry`

فیلدها: `keyword`، `description`، `icon_svg_path` (Text — یا بهتر: آپلود
SVG واقعی به‌جای رشته‌ی path دستی)، `background_theme` (Select: مقادیر
کلاس Tailwind فعلی مثل `bg-zinc-800` بهتر است به یک enum معنایی مثل
`dark` / `emerald` / `amber` تبدیل شود تا از نشت جزئیات پیاده‌سازی
فرانت‌اند به دیتابیس محتوا جلوگیری شود).

---

## ۵. پست‌های وبلاگ

از پست‌های استاندارد وردپرس استفاده کنید (نیازی به CPT سفارشی نیست).
فیلد `excerpt` بومی وردپرس جایگزین `BLOG_POSTS[].excerpt` و
`categories` بومی جایگزین `category` می‌شود. برای Schema.org
`BlogPosting`، از `date`, `modified`, `featuredImage` بومی WPGraphQL
استفاده کنید (خروجی این‌ها مستقیماً input جدول `jsonLd` در
`blog/[slug].astro` می‌شود).

---

## ۶. فرم تماس / استعلام قیمت — ✅ حل شد

**مشکل قبلی:** `astro.config.mjs` هیچ `output`/`adapter` سروری ندارد
(حالت پیش‌فرض `static`)، بنابراین `src/pages/api/contact.ts` در بیلد
نهایی **اصلاً وجود نداشت** — فقط در `astro dev` کار می‌کرد چون dev روی
Node اجرا می‌شود و این تفاوت را می‌پوشاند. نتیجه در پروداکشن: هر ارسال
فرم به یک ۴۰۴ می‌رسید و لید بی‌سروصدا از بین می‌رفت.

**وضعیت فعلی (پیاده‌سازی‌شده):**

1. `src/pages/api/contact.ts` **حذف شد**.
2. `action` خودِ فرم در `contact.astro` مستقیماً به
   `${PUBLIC_WP_API_URL}/wp-json/crane/v1/inquiry` اشاره می‌کند (اندپوینت
   واقعی پلاگین: `wordpress-plugin/crane-yadak-headless/includes/class-rest-contact.php`).
   بنابراین حتی بدون جاوااسکریپت هم ارسال واقعاً ثبت می‌شود — WP REST هم
   `application/json` و هم `form-encoded` را می‌پذیرد.
3. اسکریپت پایین `contact.astro` یک **بهبود تدریجی** است: مقصد را از
   `data-endpoint` همان فرم می‌خواند (تک منبع حقیقت)، با `fetch` ارسال
   می‌کند، از ترک صفحه جلوگیری می‌کند، در موفقیت به `/thank-you` می‌رود و
   در خطا پیام سرور را درجا در بنر `#form-feedback` نشان می‌دهد.
4. **اگر `PUBLIC_WP_API_URL` تنظیم نشده باشد، فرم اصلاً رندر نمی‌شود.**
   به‌جای آن کانال‌های تماس مستقیم (تلفن/واتساپ/تلگرام) نمایش داده
   می‌شوند. دلیل: فرمی که ارسالش به هیچ مقصدی نمی‌رسد، بدتر از نبودِ فرم
   است — کاربر فکر می‌کند درخواستش ثبت شده در حالی که هیچ لیدی وجود ندارد.

---

## ۷. ایده‌های محتوایی/سئوی مبتنی بر بک‌اند جدید

- **AggregateRating واقعی**: پس از این‌که مشتریان واقعی نظر ثبت کردند
  (مثلاً از طریق یک CPT `review` با فیلدهای `rating`, `author`, `body`,
  `product` Relationship)، فیلد `aggregateRating` را به Schema.org
  `Product` اضافه کنید. **هرگز این عدد را قبل از وجود داده‌ی واقعی جعل
  نکنید** — گوگل امتیازات ساختگی را به‌عنوان Spam Rich Result جریمه
  می‌کند و اعتماد B2B (که کل استراتژی این سایت به آن متکی است) را
  زیر سؤال می‌برد.
- **نماد اعتماد الکترونیکی (eNamad)**: پس از دریافت مجوز واقعی از طریق
  enamad.ir، بج آن به فوتر اضافه شود (فیلد `enamad_badge_code` روی
  ACF Options Page، چون کد بج معمولاً شامل اسکریپت رسمی enamad است).
- **صفحات پویا محصول** با Static Generation در build-time از طریق
  `getStaticPaths()` + WPGraphQL (نه ISR/SSR) تا سئوی استاتیک و
  سرعت فعلی سایت برای کاربران شبکه‌ی محدود ایران حفظ شود.
- **نقشه‌ی ریدایرکت (Redirect Map)**: قبل از قطع مسیرهای Mock فعلی و
  جایگزینی با اسلاگ‌های واقعی وردپرس، حتماً جدول ۳۰۱ redirect برای هر
  مسیر Mock موجود (`/categories/*`, `/brands/*`, `/blog/*`,
  `/industries/*`) تهیه شود تا Link Equity از دست نرود. اگر اسلاگ‌ها در
  وردپرس دقیقاً با اسلاگ‌های فعلی یکسان تعریف شوند (که توصیه می‌شود)،
  اصلاً نیازی به redirect نخواهد بود.
- **Preview/Draft محتوا**: اگر تیم محتوا نیاز به پیش‌نمایش پست‌های
  Draft قبل از build دارد، از قابلیت WPGraphQL Content Blocks یا یک
  دکمه‌ی "Rebuild" (Webhook از وردپرس به سرویس بیلد/دیپلوی، مثل
  ArvanCloud یا Vercel/Netlify Build Hook) روی هر `publish`/`update`
  استفاده کنید تا سایت استاتیک هرگز محتوای قدیمی نشان ندهد.

---

## ۸. جمع‌بندی وضعیت فعلی فرانت‌اند (برای مرحله‌ی بعد)

فرانت‌اند فعلی کاملاً بدون بک‌اند و مستقل قابل build است (`src/data/*.ts`
تک منبع حقیقت Mock). هر زمان بک‌اند وردپرس آماده شد، تنها لازم است:

1. فایل‌های `src/data/site.ts` و `src/data/content.ts` با توابع
   `fetch`-محور به WPGraphQL جایگزین شوند (در `getStaticPaths()` هر
   صفحه‌ی داینامیک).
2. مرحله‌ی ۶ (فرم تماس) طبق بالا اجرا شود.
3. هیچ تغییری در ساختار JSX/Astro، کلاس‌های Tailwind، یا Schema.org
   لازم نیست — چون شکل داده‌ی خروجی همان شکل فعلی نگه داشته می‌شود.
