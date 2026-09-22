# کرین یدک — قبل از هر کاری این را بخوان

> این فایل به‌صورت خودکار در ابتدای هر نشست خوانده می‌شود. برخلاف حافظه‌ی
> دستیار، خواندنش «شاید» نیست.

## اول از همه

**`docs/backlog.md` را باز کن.** پاسخ «چه چیزی مانده؟» آنجاست، نه در تاریخچه‌ی
گفتگو. هر ایده‌ای که مطرح شد و ساخته نشد، پیش از بسته‌شدن موضوع باید همان‌جا
نوشته شود.

قاعده: **چیزی که در `docs/backlog.md` نیست، فراموش شده است.**

## 🔒 کد منجمد است (از ۳۰ شهریور ۱۴۰۵)

**فاز پروژه «ساختن» نیست، «پر کردن» است.** این را پیش از پیشنهاد هر فیچری
بدان.

> هیچ کد تازه‌ای نوشته نمی‌شود، مگر آنکه **ورود محتوا را مسدود** کرده باشد.

چرا: ~۱۷٬۰۰۰ خط کد در برابر ۳٬۳۴۴ کلمه محتوا. ۴ دسته از ۳۱ پر است. چیزی که
غایب است قابلیت نیست، صفحه است.

- ایده‌ی تازه → `docs/backlog.md`، بخش «تأیید نشده». **ساخته نمی‌شود.**
- باگی که محتوا را مسدود کند → رفع شود. استثنا نیست، خودِ تعریف است.
- نگهبان (`scripts/check-*`) → مجاز. کد فیچر نیست.
- امنیت → همیشه مجاز.

اگر کارفرما فیچری خواست که در این قاعده نمی‌گنجد، **پیش از ساختنش** همین
معامله را یادآوری کن: هر فیچر، درزِ تازه است و درز همان جایی است که تمام
باگ‌های این پروژه در آن زندگی کرده‌اند.

## چرا این فایل وجود دارد

یک بار قبلاً شکست خوردیم. یک skill به نام `craneyadak-project-state` ساخته شد،
چند بار به‌روز شد، و بعد رها شد. یک ماه بعد هنوز از ووکامرس، datasheets و
`taxonomy.ts` حرف می‌زد — هر سه حذف شده بودند. یعنی سندی که قرار بود از سردرگمی
جلوگیری کند، خودش منبع اطلاعات غلط شد.

درسِ آن شکست: **نیت خوب و حافظه، تضمین نیستند. تست، تضمین است.**
به همین دلیل `npm run check` حالا تازگی مستندات را هم بررسی می‌کند و اگر سندی
از فیچر حذف‌شده حرف بزند، build را می‌شکند.

## قوانین کاری این پروژه

1. **سئو اولویت اول است**، سرعت دوم. هر تصمیمی با همین دو سنجیده می‌شود.
2. **هرگز چیزی از خودت نساز**: کد فنی، مشخصات، ابعاد، قیمت، موجودی، زمان
   تحویل، یا توانمندی تجاری. موارد نامطمئن با 🔶 علامت بخورند، نه اینکه
   حدس جای واقعیت بنشیند. در سایت قطعات جرثقیل، کد اشتباه مسئله‌ی ایمنی است.
3. **هرگز ادعای نمایندگی رسمی** هیچ سازنده‌ای نشود؛ ریسک حقوقی است نه سئویی.
4. **نسخه‌ی قبلی حذف شود.** با افزودن هر نسخه‌ی جدید (زیپ افزونه، فایل، ماژول)،
   نسخه‌های قبلی پاک می‌شوند.
5. **مستندات نادرست باقی نماند.** با هر حذف فیچر، همان لحظه مستنداتش هم برود.
6. **پیش از تحویل، تست شود.** ابزار بررسی باید روی ورودی *خرابِ شناخته‌شده*
   اعتبارسنجی شود، نه فقط روی ورودی سالم. چند بار ابزارهای این پروژه
   «سبز» گزارش دادند در حالی که کور بودند.
7. **کامیت خودکار است** (اجازه‌ی دائمی کارفرما). push از ترمینال خود او انجام
   می‌شود چون گیت‌هاب از محیط دستیار مسدود است.
8. **پاسخ‌ها با گام‌های شماره‌دار روشن تمام شوند** — «دقیقاً چه کار کنم».

## معماری، در سه خط

Astro استاتیک (`output: 'static'`) + وردپرس هدلس با WPGraphQL و ACF Pro.
تمام واکشی داده در زمان build داخل `getStaticPaths()` انجام می‌شود؛ سایت
منتشرشده هیچ وابستگی زمان‌اجرا به وردپرس ندارد.
**وردپرس مرجع یگانه‌ی تاکسونومی است** — `src/data/taxonomy.generated.ts` یک
خروجی build است، نه فایلی که دستی ویرایش شود.

## دستورهای اصلی

```bash
npm run check          # بررسی‌های آفلاین — بدون نیاز به شبکه
npm run check:plugin   # هارنس افزونه‌ی وردپرس (به php نیاز دارد)
npm run build          # taxonomy + check + astro build
```

## دام‌هایی که قبلاً افتادیم

- **نردبان کوئری**: فیلد جدید هرگز نباید داخل `CORE_FIELDS` برود. محورِ
  تنزل‌پذیر خودش را بگیرد، وگرنه نبودش کل صفحه را خالی می‌کند.
- **تصویر داخل متن**: `set:html` رشته است؛ `astro:assets` داخلش را نمی‌بیند.
  بهینه‌سازی باید صریح با `getImage()` انجام شود.
- **ACF**: نام فایل JSON باید با کلید گروه یکی باشد، وگرنه هر ذخیره یک فایل
  تکراری می‌سازد.
- **هوک وردپرس**: پارامترهای کال‌بک باید مقدار پیش‌فرض داشته باشند؛ PHP 8
  وگرنه fatal می‌دهد.

## ⛔ ووکامرس — هرگز

ووکامرس نصب نمی‌شود و پیشنهاد هم نمی‌شود. کارفرما بارها گفته است.

دلیل فنی: ووکامرس نوع پست `product` خودش را دارد و با `product` + 
`productFields` ما تصادم می‌کند. پرداخت مستقیم از راه **زرین‌پال** انجام
می‌شود که درگاه است نه فروشگاه‌ساز، و به `productFields.price` و
`buyMode = cart` وصل می‌شود. استعلام هم از راه `quote-requests`.

اگر تحلیلی به «ووکامرس لازم است» رسید، آن تحلیل را با کارفرما مطرح کنید —
نصبش نکنید. او صریح گفته ترجیح می‌دهد بک‌اند را با جنگو/لاراول از نو
بسازد تا اینکه آن را برای ووکامرس خراب کند.

جزئیات کامل: `docs/architecture.md` بخش ۳.۵


## Communication Protocol (Caveman Mode)
- Be extremely terse and dense. Speak like an elite systems engineer under strict token constraints.
- Skip greetings, polite fluff, preambles, pedagogical explanations, and unsolicited summaries.
- Never reprint entire files. Return ONLY minimal unified diffs or isolated functions with exact line context.
- Plain technical facts only. Never explain why standard patterns work unless explicitly asked.

## Autonomous Testing Protocol
- NEVER ask the user to run tests, builds, or diagnostics. You have active terminal access.

## Performance & Visual Audit
- Use your native Browser tool to load `http://localhost:4321` and take screenshots to visually diagnose layout shifts (CLS) or responsive design issues.
- For strict performance metrics, autonomously execute `npx @lhci/cli collect --url=http://localhost:4321`, read the JSON report, and fix elements harming LCP or INP scores.

## SEO, Schema & Live Search Hack
- Do NOT ask for Search APIs or external connectors. When you need live competitor data, title tags, or PAA (People Also Ask) structures, autonomously use your native `Browser` tool.
- Navigate directly to `https://www.google.com/search?q=YOUR_KEYWORD`, read the parsed DOM, and extract real-time search results from page 1.
- Whenever modifying `src/lib/seo-meta.ts` or JSON-LD, validate the output against `schema.org/Product` and `schema.org/QAPage` standard rules.