# انتشار و نگهداری — وضعیت جاری

سایت زنده است: `craneyadak.com` (خروجی استاتیک Astro روی cPanel/LiteSpeed هاست‌ایران) و وردپرس هدلس روی
`admin.craneyadak.com`. ⚠️ مراحل نصب اولیه (وردپرس خام، برند و محصول آزمایشی، منوهای قدیمی) در ۲۸ مهر ۱۴۰۵
از این سند برداشته شد چون دیگر با وضعیت واقعی نمی‌خواند؛ نسخه‌ی تاریخی در تاریخچه‌ی git است.

## افزونه‌ی وردپرس

نصب، به‌روزرسانی، تنظیمات و ثابت‌های `wp-config.php`: `wordpress-plugin/crane-yadak-headless/README.md`.
هر نسخه‌ی تازه فقط با `/plugin-release <نسخه>` ساخته می‌شود و همیشه یک zip در مخزن است.

## انتشار خودکار با GitHub Actions (build → آپلود به cPanel)

**چه می‌شود:** GitHub خودش سایت را build می‌کند (از داده‌ی وردپرس)، پوشه‌ی `dist/` را با FTPS
روی هاست آپلود می‌کند، و بعد رفتار واقعی سرور را می‌سنجد (۳۰۱ واقعی، HTTPS، ۴۰۴). فایل:
`.github/workflows/deploy.yml`. اجرا با دکمه‌ی دستی، هر شب ۰۲:۳۰ UTC، و (بعداً) با وبهوک وردپرس.
روی push اجرا **نمی‌شود** تا هر کامیت سایت زنده را عوض نکند.

**گام ۱ — یک حساب FTP فقط برای انتشار (در cPanel):**
1. cPanel ← **FTP Accounts** ← Add FTP Account.
2. نام کاربری و رمز قوی بدهید. **Directory** را روی ریشه‌ی سند سایت اصلی بگذارید
   (معمولاً `public_html`). ⚠️ وردپرس `admin.craneyadak.com` نباید داخل این پوشه باشد
   (اگر هست، به من بگویید تا `server-dir` را جدا کنیم).
3. از همان صفحه «Configure FTP Client» نشانی **سرور FTP** را یادداشت کنید.

**گام ۲ — Secretهای GitHub** (مخزن ← Settings ← Secrets and variables ← Actions ← New repository secret):

| نام | مقدار |
|---|---|
| `WP_GRAPHQL_URL` | `https://admin.craneyadak.com` (بدون اسلش پایانی) |
| `PUBLIC_WP_API_URL` | `https://admin.craneyadak.com` |
| `FTP_SERVER` | نشانی سرور FTP از گام ۱ |
| `FTP_USERNAME` | نام کاربری FTP گام ۱ |
| `FTP_PASSWORD` | رمز FTP گام ۱ |
| `FTP_SERVER_DIR` | مسیر روی سرور **با اسلش پایانی**. اگر «Directory» حساب FTP را روی ریشه‌ی سند سایت گذاشته‌اید (پیشنهادی)، حساب داخل همان پوشه قفل است و مقدار درست `./` است |

اختیاری (تب Variables): `FTP_PROTOCOL` (`ftps` پیش‌فرض؛ فقط اگر هاست FTPS ندارد `ftp`)،
`INDEX_EMPTY_CATEGORIES` (`1` = دسته‌های بدون محصول هم ایندکس شوند؛ ⚠️ فقط پس از نهایی‌شدن محتوا).
رمز و مقادیر را هیچ‌جا در چت یا فایل نگذارید؛ فقط داخل Secrets.

**گام ۳ — پیش‌نیاز وردپرس:** افزونه‌ی آخرین نسخه نصب باشد. (فیلد «اصالت کالا (اصلی / غیر اصلی)» اختیاری است؛ محصول
بدون برچسب بدون آن نمایش داده می‌شود.) GitHub باید بتواند `admin.craneyadak.com/graphql` را بخواند
(اگر هاست/فایروال آی‌پی‌های خارجی را می‌بندد، اجرای اول همین‌جا خطا می‌دهد).

**گام ۴ — اولین اجرا:** مخزن ← **Actions** ← Deploy ← **Run workflow**. سه مرحله‌ی مهم:
Build (سبز = داده و تست‌ها سالم)، Upload (سبز = فایل‌ها، از جمله `.htaccess` مخفی، رفتند)،
Verify (سبز = سرور واقعاً ۳۰۱/HTTPS/۴۰۴ را درست می‌دهد). قرمزِ Verify یعنی فایل آپلود شده ولی
سرور آن را اجرا نمی‌کند (مثلاً `AllowOverride` خاموش است یا دامنه هنوز به این هاست اشاره نمی‌کند).

**گام ۵ — انتشار خودکار پس از ویرایش محتوا (وردپرس ← GitHub).** فقط پس از اینکه یک اجرای دستی کاملاً سبز شد:
1. GitHub ← Settings (حساب شما) ← Developer settings ← **Fine-grained personal access tokens** ← Generate.
   Repository access = **Only select repositories** ← فقط همین مخزن. Permissions ← Repository permissions ←
   **Contents: Read and write** (برای `repository_dispatch` لازم است). مدت اعتبار را ثبت کنید (پیش از پایانش تمدید کنید).
2. توکن را **فقط** در `wp-config.php` هاست بگذارید (File Manager cPanel ← `wp-config.php` ← Edit)، پیش از خط
   «That's all, stop editing!»: `define( 'CYH_GITHUB_TOKEN', 'github_pat_…' );` — نه در تنظیمات وردپرس، نه در چت.
3. وردپرس ← تنظیمات ← کرین یدک Headless: «مخزن GitHub» = `ryanzaare/craneyadak`، تیک «انتشار خودکار» را روشن،
   ذخیره. خط «وضعیت» باید «مخزن و توکن تنظیم است ✓» شود.
4. دکمه‌ی «همین حالا دیپلوی کن» بزنید: در GitHub ← Actions باید یک اجرای Deploy (event: repository_dispatch) ببینید.
   خطای توکن/مخزن (۴۰۱/۴۰۴) زیر همان فیلد در پنل نوشته می‌شود؛ توکن هرگز در پیام خطا نمی‌آید.
از این به بعد هر انتشار/ویرایش محصول، برند، دسته یا مقاله، ۶۰ ثانیه بعد (جمع‌شده در یک درخواست) یک انتشار می‌سازد.

## فرانت‌اند: `dist/.htaccess` (ریدایرکت ۳۰۱، HTTPS، ۴۰۴)

این راهنما درباره‌ی بک‌اند است، ولی فرانت‌اند هم روی همین cPanel منتشر می‌شود و
یک نکته‌ی حیاتی دارد: `npm run build` فایل **`dist/.htaccess`** را می‌سازد (نه
`public/_redirects`؛ آن فایل قالب Netlify بود و روی Apache اثری نداشت و حذف شد).

1. `dist/` را کامل روی ریشه‌ی سند بارگذاری کنید — **با فایل‌های مخفی**
   (در File Manager: Settings ← Show Hidden Files).
2. بسنجید (باید ۳۰۱ و مقصدِ با «/» ببینید):
   `curl -I https://craneyadak.com/categories/crane-hook`
   `curl -I http://www.craneyadak.com/about` (یک ۳۰۱ مستقیم به `https://craneyadak.com/about/`)
   `curl -I https://craneyadak.com/does-not-exist` (کد ۴۰۴)
3. ریدایرکت جدید = فقط یک ویرایش در `src/data/legacy-redirects.mjs`؛ بقیه خودکار.

