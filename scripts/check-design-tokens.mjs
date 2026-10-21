// scripts/check-design-tokens.mjs  [dir…]   (پیش‌فرض: src)
// ---------------------------------------------------------------------------
// کلاس‌ها و متغیرهای رنگ/گوشه‌ی قدیمی در src/ نباید باشند. اجرا در `npm run check`.
//
// چرا (Frontend v2، فاز ۰ — docs/frontend-v2.md §4b و §5):
//   • دو پالت هم‌زمان زنده بودند: `gray-*` پیش‌فرض Tailwind (×۲۸۲) و aliasهای `crane-*` (×۳۳۹) کنار
//     `steel-*`/`accent*`. هر قالب تازه یکی از سه نام را برمی‌داشت و «توکن در یک نقطه» عملاً سه نقطه بود.
//   • هرج‌ومرج گوشه‌ها: rounded-3xl ×۱۳، rounded-2xl ×۳۶، rounded-xl ×۴۱. قاعده‌ی v2 فقط ۴px
//     (چیپ، جدول) و ۶–۸px (کارت، دکمه، ورودی) است؛ rounded-full برای قرص/آواتار مجاز است.
//   ⚠️ rounded-xl (۱۲px) عمداً هم گرفته می‌شود، گرچه متن handover فقط 2xl/3xl را نام برده: قاعده‌ی
//     §4b «فقط ۴ و ۶–۸px» است و نگهبانی که xl را رها کند، همان هرج‌ومرج را یک پله پایین‌تر نگه می‌دارد.
//
// مهاجرت یک بار انجام شد؛ این نگهبان جلوی برگشت بی‌صدا را می‌گیرد. حافظه و «یادم می‌ماند» تضمین نیست.
//
// ⚠️ «crane-» به‌تنهایی گرفته نمی‌شود: اسلاگ‌ها (crane-hook، crane-wheel) و کلیدهای ذخیره (crane-yadak-…)
// با همین پیشوند شروع می‌شوند. نگهبانی که آن‌ها را بگیرد، مهاجرت را به تغییر URL و سبد کاربر هل می‌دهد.
// فقط چهار نام رنگی قدیمی (navy، orange، light، white) قدیمی‌اند.
//
// آزمون با ورودی خراب: scripts/check-design-tokens.test.mjs (پیش از پیاده‌سازی قرمز دیده شد).
// ---------------------------------------------------------------------------
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// پیشوند واریانت‌ها (hover:، md:، group-hover:، [&>*]: …) جزو توکن گزارش می‌شود تا پیام دقیقاً همان رشته‌ی
// قالب باشد و با جستجو پیدا شود.
const VARIANTS = String.raw`(?:[\w\[\]&>*@.-]+:)*`;
const PATTERNS = [
  // gray-50 … gray-950، با شفافیت اختیاری (/70)
  new RegExp(String.raw`(?<![\w-])${VARIANTS}[a-z]+(?:-[a-z]+)*-gray-\d{2,3}(?:\/\d{1,3})?(?![\w-])`, 'g'),
  new RegExp(String.raw`(?<![\w-])${VARIANTS}[a-z]+(?:-[a-z]+)*-crane-(?:navy|orange|light|white)(?:\/\d{1,3})?(?![\w-])`, 'g'),
  // متغیرهای CSS: تعریف alias در @theme و مصرف در var(...)
  /--color-(?:gray-\d{2,3}|orange-\d{2,3}|crane-(?:navy|orange|light|white))(?![\w-])/g,
  // orange-* پیش‌فرض Tailwind = نسخه‌ی دوم accent (orange-800 دقیقاً #9A3412 = accent-ink). نارنجی فقط از راه
  // توکن (§5). ⚠️ رنگ‌های وضعیت (red/emerald/amber/sky) عمداً آزادند تا توکن معنایی وضعیت ساخته شود (backlog).
  new RegExp(String.raw`(?<![\w-])${VARIANTS}[a-z]+(?:-[a-z]+)*-orange-\d{2,3}(?:\/\d{1,3})?(?![\w-])`, 'g'),
  // rounded-xl / 2xl / 3xl، با جهت اختیاری (t، se، bl …)
  new RegExp(String.raw`(?<![\w-])${VARIANTS}rounded(?:-(?:[tlrbxyse]|tl|tr|bl|br|ss|se|es|ee))?-(?:xl|2xl|3xl)(?![\w-])`, 'g'),
  // مقیاس تایپ: ۱۲/۱۴/۱۶/۲۰/۲۴/۳۲/۴۰ = xs/sm/base/xl/2xl/3xl/4xl (۳xl و ۴xl در @theme بازتعریف شده‌اند).
  // ⚠️ text-lg و text-5xl…9xl در @theme حذف شده‌اند: کلاس باقی‌مانده هیچ CSS نمی‌سازد و *بی‌صدا* بی‌اثر
  // می‌شود — دقیقاً همان شکستی که فقط نگهبان می‌بیند، نه بازبین.
  new RegExp(String.raw`(?<![\w-])${VARIANTS}text-(?:lg|[5-9]xl|\[[\d.]+(?:px|rem|em)\])(?![\w-])`, 'g'),
  // وزن‌ها: فقط ۴۰۰/۷۰۰/۹۰۰ (normal/bold/black)
  new RegExp(String.raw`(?<![\w-])${VARIANTS}font-(?:thin|extralight|light|medium|semibold|extrabold)(?![\w-])`, 'g'),
  // CSS دستی (global.css، <style>): وزن و اندازه‌ی بیرون از همان مقیاس. واحد pt (فقط چاپ) و em (نسبی) آزاد است.
  /font-weight:\s*(?:[1-35-68]00)\b(?!\s*\d)/g, // «100 900» در @font-face = بازه‌ی محور فونت متغیر، نه وزن
  /font-size:\s*(?!(?:0\.75|0\.875|1|1\.25|1\.5|2|2\.5)rem\b|(?:12|14|16|20|24|32|40)px\b)[\d.]+(?:rem|px)\b/g,
  // گوشه‌ی CSS دستی بزرگ‌تر از ۸px (0.5rem). ≥۱۰۰px یا درصد = قرص/دایره، مجاز.
  [/border-radius:\s*[^;}\n]+/g, (decl) => [...decl.matchAll(/([\d.]+)(rem|px)/g)].some(([, n, u]) => {
    const px = u === 'rem' ? +n * 16 : +n;
    return px > 8 && px < 100;
  })],
];

/** همه‌ی توکن‌های قدیمی در یک متن، به ترتیب ظهور، با شماره‌ی خط. منطق خالص (آزمون‌پذیر). */
export function findLegacyTokens(text) {
  const out = [];
  for (const entry of PATTERNS) {
    const [re, keep] = Array.isArray(entry) ? entry : [entry, () => true];
    for (const m of text.matchAll(re)) {
      const token = m[0].trimEnd();
      if (!keep(token)) continue;
      out.push({ token, index: m.index, line: text.slice(0, m.index).split('\n').length });
    }
  }
  return out.sort((a, b) => a.index - b.index).map(({ token, line }) => ({ token, line }));
}

const EXT = new Set(['.astro', '.ts', '.mts', '.mjs', '.js', '.css', '.html']);
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (EXT.has(path.extname(name))) yield p;
  }
}

function main() {
  const roots = process.argv.slice(2).length ? process.argv.slice(2) : ['src'];
  const problems = [];
  let files = 0;
  for (const root of roots) {
    for (const f of walk(root)) {
      files++;
      for (const h of findLegacyTokens(readFileSync(f, 'utf8'))) problems.push(`${f}:${h.line}  ${h.token}`);
    }
  }
  if (problems.length) {
    console.error(`❌ ${problems.length} توکن طراحی قدیمی در ${roots.join(', ')} (رنگ gray-*/crane-*، گوشه‌ی xl+، اندازه/وزن بیرون از مقیاس):`);
    for (const p of problems.slice(0, 40)) console.error('   ' + p);
    if (problems.length > 40) console.error(`   … و ${problems.length - 40} مورد دیگر`);
    console.error('   جایگزین: steel-* / accent / accent-ink؛ گوشه: rounded (۴px) یا rounded-md/lg (۶–۸px)؛ اندازه: xs/sm/base/xl/2xl/3xl/4xl؛ وزن: normal/bold/black. docs/frontend-v2.md §5');
    process.exit(1);
  }
  console.log(`✅ توکن‌های طراحی یکدست — ${files} فایل، بدون رنگ/گوشه/اندازه/وزن قدیمی.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
