# Crane Yadak — Headless Backend Plugin

این پلاگین بک‌اند Headless سایت کرین یدک است: CPT/تکسونومی محصولات را با
پشتیبانی WPGraphQL ثبت می‌کند، فیلدهای ACF Pro را از طریق Local JSON
همگام نگه می‌دارد، و اندپوینت REST امنی برای فرم استعلام قیمت فراهم
می‌کند. جزئیات کامل نگاشت داده و تصمیمات معماری در
`docs/backend-integration.md` (در ریشه‌ی پروژه‌ی Astro) مستند شده؛ این
فایل فقط مراحل نصب و نمونه‌ی Queryهاست.

## پیش‌نیازها

1. یک نصب وردپرس (نسخه‌ی ۶.۴ به بالا توصیه می‌شود) — هاست یا سرور شما.
2. افزونه‌ی **Advanced Custom Fields PRO** فعال (شما قبلاً لایسنس آن را
   دارید).
3. افزونه‌ی **WPGraphQL** فعال (از دایرکتوری رسمی وردپرس یا
   wpgraphql.com).
4. ⚠️ **پشتیبانی WPGraphQL از فیلدهای ACF**: بسته به نسخه‌ی ACF PRO شما،
   یکی از این دو مسیر لازم است:
   - اگر ACF PRO نسخه‌ی ۶.۳ یا بالاتر دارید: پشتیبانی GraphQL به‌صورت
     Native داخل خودِ ACF وجود دارد و کلیدهای `show_in_graphql` در
     فایل‌های JSON این پلاگین به‌صورت خودکار کار می‌کنند.
   - اگر نسخه‌ی قدیمی‌تر دارید: افزونه‌ی مکمل رایگان **WPGraphQL for
     Advanced Custom Fields** (wp-graphql-acf) را هم نصب و فعال کنید.
   - نسخه‌ی خود را از مسیر افزونه‌ها › Advanced Custom Fields PRO بررسی
     کنید. اگر مطمئن نیستید، هر دو مسیر را همزمان فعال نگه‌داشتن ضرری
     ندارد.

## نصب

1. پوشه‌ی `crane-yadak-headless` را (بدون فایل `README.md` این خط به
   خط لازم نیست حذف شود؛ می‌تواند در پلاگین بماند) به‌صورت zip فشرده
   کنید یا مستقیماً در `wp-content/plugins/` آپلود کنید.
2. از پنل وردپرس › افزونه‌ها، «Crane Yadak — Headless Backend» را فعال
   کنید.
3. پس از فعال‌سازی، به تنظیمات › پیوندهای یکتا (Permalinks) بروید و
   دکمه‌ی «ذخیره تغییرات» را بزنید (این کار Rewrite Rules مربوط به
   اسلاگ‌های `/brands/` و `/industries/` را فعال می‌کند — یک مرحله‌ی
   دستی کلاسیک وردپرس که فراموش‌کردنش باعث خطای ۴۰۴ می‌شود).
4. به تنظیمات › «کرین یدک Headless» بروید و ایمیل دریافت لید و
   دامنه‌های مجاز CORS (دامنه‌ی واقعی فرانت‌اند Astro شما) را وارد کنید.
5. به تنظیمات › «تنظیمات کرین یدک» (ACF Options Page) بروید و FAQ، ساعات
   کاری، مختصات جغرافیایی واقعی و لینک‌های نشان/بلد/گوگل بیزینس پروفایل
   را وارد کنید.
6. محتوای واقعی را در منوهای «محصولات»، «برندها»، «صنایع تحت پوشش» و
   «اسناد فنی» وارد کنید (یا Import کنید).

## نمونه Query های WPGraphQL

### دریافت محصولات یک دسته‌بندی (برای `categories/[slug].astro`)

```graphql
query ProductsByCategory($slug: [String]) {
  craneProducts(
    where: {
      taxQuery: {
        taxArray: [
          { taxonomy: CRANECATEGORY, terms: $slug, field: SLUG }
        ]
      }
    }
    first: 50
  ) {
    nodes {
      title
      slug
      productFields {
        sku
        priceDisplay
        brand {
          ... on CraneBrand {
            title
            slug
          }
        }
        gallery {
          url
          altText
        }
        oemCrossReference {
          oemBrand
          oemPartNumber
        }
      }
    }
  }
}
```

### دریافت همه‌ی برندها (برای `brands/index.astro`)

```graphql
query AllBrands {
  craneBrands(first: 100) {
    nodes {
      title
      slug
      brandFields {
        nameEn
        logoText
        brandColor
        seoAnchor
        seoDesc
      }
    }
  }
}
```

### دریافت تنظیمات سراسری (FAQ، ساعات کاری، مختصات)

```graphql
query SiteOptions {
  craneSiteSettings {
    siteOptionsFields {
      faqs {
        question
        answer
      }
      businessHours {
        days
        opens
        closes
      }
      geoLat
      geoLng
      googleBusinessProfile
      neshan
      balad
    }
  }
}
```

## اندپوینت فرم تماس

```
POST https://<دامنه-وردپرس>/wp-json/crane/v1/inquiry
Content-Type: application/json

{
  "name": "مهندس رضایی",
  "phone": "09121234567",
  "company": "فولاد کویر",
  "sku": "DMG-1024",
  "message": "نیاز به استعلام قیمت دارم",
  "website": ""
}
```

فیلد `website` باید در فرم HTML وجود داشته باشد اما با CSS مخفی شود
(هانی‌پات ضداسپم) — به نمونه‌ی پیاده‌سازی در `docs/backend-integration.md`
بخش ۶ نگاه کنید.

پاسخ موفق:

```json
{ "success": true, "message": "درخواست شما با موفقیت ثبت شد." }
```

پاسخ خطا (مثال: شماره نامعتبر):

```json
{ "code": "cyh_invalid_phone", "message": "شماره همراه معتبر نیست...", "data": { "status": 400 } }
```

## تست محلی این پلاگین (بدون نصب وردپرس)

فایل `../wp-stub-harness.php` (خارج از پوشه‌ی پلاگین، فقط برای توسعه)
تمام توابع وردپرسی مورد نیاز را Stub می‌کند و منطق واقعی CPT/REST را
اجرا و بررسی می‌کند (ثبت صحیح CPTها، رد هانی‌پات، اعتبارسنجی شماره،
Rate Limiting). این فایل بخشی از پلاگین نیست و نباید به وردپرس واقعی
آپلود شود؛ فقط برای تایید صحت منطق پیش از دیپلوی استفاده شد.
