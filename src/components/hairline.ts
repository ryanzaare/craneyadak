// src/components/hairline.ts
// ---------------------------------------------------------------------------
// شبکه‌ی «خط مو» سوئیسی (فاز ۳): `gap-px` روی زمینه‌ی steel-200 خطوط ۱px را می‌سازد.
// ⚠️ دامِ این تکنیک: هر خانه‌ی خالی ردیف آخر، یک لکه‌ی خاکستری است (۳ نشان در شبکه‌ی ۴ستونه — اسکرین‌شات فاز ۳؛
// ۱ دسته‌ی دارای کالا در ۴ ستون = سه‌چهارم ردیف خاکستری). پس ستون‌ها از روی تعداد، و آخرین خانه بقیه‌ی ردیف را می‌گیرد.
// کلاس‌ها لفظی‌اند: Tailwind فقط رشته‌ی کامل را در سورس می‌بیند.
// ---------------------------------------------------------------------------
const LG_COLS = ['', 'lg:grid-cols-1', 'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4'];
const LG_SPAN = ['', 'lg:col-span-1', 'lg:col-span-2', 'lg:col-span-3', 'lg:col-span-4'];

/** کلاس ظرف: ۱ ستون موبایل، ۲ از sm، تا ۴ از lg. */
export function hairlineGrid(n: number): string {
  return ['grid gap-px bg-steel-200 border border-steel-200 rounded-md overflow-hidden', n >= 2 ? 'sm:grid-cols-2' : '', LG_COLS[Math.min(Math.max(n, 1), 4)]].join(' ');
}

/** کلاس خانه‌ی i از n: آخرین خانه بقیه‌ی ردیف ناقص را پر می‌کند. */
export function hairlineCell(i: number, n: number): string {
  if (i !== n - 1) return 'bg-white';
  const out = ['bg-white'];
  if (n > 1 && n % 2 === 1) out.push('sm:col-span-2');
  const cols = Math.min(n, 4);
  const lastRow = n % cols || cols;
  out.push(LG_SPAN[cols - lastRow + 1]!);
  return out.join(' ');
}

/**
 * خانه‌های پرکننده‌ی سفید برای شبکه‌ی ۲/۴/۶ستونه (ویترین برندها): کلاس نمایش هر پرکننده در هر نقطه‌ی شکست.
 * پرکننده‌ی i فقط در نقطه‌ای دیده می‌شود که ردیف آخر به آن نیاز دارد.
 */
export function hairlineFillers(n: number): string[] {
  const need = (cols: number) => (cols - (n % cols)) % cols;
  const [b, m, l] = [need(2), need(4), need(6)];
  return Array.from({ length: Math.max(b, m, l) }, (_, i) =>
    [i < b ? 'block' : 'hidden', i < m ? 'md:block' : 'md:hidden', i < l ? 'lg:block' : 'lg:hidden', 'bg-white'].join(' '),
  );
}
