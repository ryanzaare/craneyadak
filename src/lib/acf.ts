// src/lib/acf.ts
// ---------------------------------------------------------------------------
// تنها مرز بین ACF/WPGraphQL و بقیه‌ی سایت. **بدون هیچ وابستگی.**
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا این فایل وجود دارد
// ═══════════════════════════════════════════════════════════════════════════
// ACF فیلد `select` را — حتی وقتی `multiple = 0` است — از WPGraphQL به شکل
// **آرایه‌ی یک‌عضوی** برمی‌گرداند:
//
//     "brandClass": ["oem"]        نه   "oem"
//     "blockType":  ["table"]      نه   "table"
//
// این یک واقعیت ثابت است، نه یک استثنا. ولی هر ماژول تبدیل خودش را نوشت و
// فقط **یکی** از شش‌تا درست بود — `wp.ts`، که حتی کامنت توضیحی هم داشت:
// «select تک‌مقداری گاهی آرایه‌ی یک‌عضوی برمی‌گرداند».
//
// یعنی این دانش در همین مخزن نوشته شده بود و به پنج ماژول دیگر نرسید.
// نتیجه‌اش دو باگ زنده بود که هر دو *بی‌صدا* بودند:
//
//   • گروه برند: ویرایش در پنل خوانده و دور ریخته می‌شد، و مقدار
//     هاردکدشده جایش می‌نشست. کارفرما تغییر می‌داد و هیچ اتفاقی نمی‌افتاد.
//   • نوع بلوک: ۴ بلوک از ۷ بلوک صفحه‌ی دماگ نامرئی شد.
//
// درسِ ساختاری: مسئله «دانستن» نبود، «یک‌جا بودن» بود. پس از این، هر مقدار
// ACF از همین‌جا رد می‌شود. اگر ماژولی تبدیل خودش را بنویسد،
// `check-architecture.mjs` می‌افتد.
// ---------------------------------------------------------------------------

/**
 * مقدار ACF → رشته.
 *
 * آرایه‌ی یک‌عضوی باز می‌شود (select)، عدد و بولین به رشته تبدیل می‌شوند،
 * و خالی یعنی `null` نه `''` — تا `??` و `||` در مصرف‌کننده درست کار کنند.
 */
export function acfString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.length ? acfString(value[0]) : null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

/** همان `acfString` ولی همیشه رشته — برای جاهایی که `null` معنا ندارد. */
export const acfText = (value: unknown): string => acfString(value) ?? '';

/**
 * مقدار ACF → یکی از گزینه‌های مجاز، وگرنه پیش‌فرض.
 *
 * ⚠️ این تابع جای «تبدیل رشته بعد includes» را می‌گیرد، چون همان‌جا بود که
 * آرایه‌ها بی‌صدا به پیش‌فرض تنزل می‌کردند و کسی نمی‌فهمید.
 */
export function acfChoice<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = acfString(value);
  return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/** فیلد `true_false` — که برخلاف select، بولین واقعی برمی‌گرداند. */
export function acfBool(value: unknown): boolean {
  if (Array.isArray(value)) return value.length ? acfBool(value[0]) : false;
  return value === true || value === 1 || value === '1' || value === 'true';
}

/** عدد مثبت، وگرنه `null`. صفر و منفی برای ابعاد و قیمت بی‌معنا هستند. */
export function acfNumber(value: unknown): number | null {
  const raw = acfString(value);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** فیلد `checkbox` — چندمقداری واقعی. همیشه آرایه‌ی رشته‌ی تمیز. */
export function acfList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const one = acfString(value);
    return one === null ? [] : [one];
  }
  return value.map(acfString).filter((v): v is string => v !== null);
}

/** ردیف‌های یک ریپیتر — همیشه آرایه‌ای از شیء، هرگز `null`. */
export function acfRows(value: unknown): Record<string, unknown>[] {
  return (Array.isArray(value) ? value : []).filter(
    (row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object',
  );
}

/**
 * فیلد Image/File: نسخه‌ی ۲ افزونه پوسته‌ی `node` دارد، نسخه‌ی ۱ ندارد.
 * هر دو پذیرفته می‌شوند تا ارتقای افزونه صفحه را خالی نکند.
 */
export function acfNode(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  return o.node && typeof o.node === 'object' ? (o.node as Record<string, unknown>) : o;
}

/**
 * فیلد Taxonomy: گاهی connection، گاهی آرایه، گاهی شیء تنها.
 * اولین ترم را برمی‌گرداند؛ نبودنش خطا نیست.
 */
export function acfFirstTerm(value: unknown): { slug: string | null; name: string | null } {
  const list = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { nodes?: unknown[] }).nodes)
      ? (value as { nodes: unknown[] }).nodes
      : value && typeof value === 'object'
        ? [value]
        : [];

  const first = list.find((x) => x && typeof x === 'object') as Record<string, unknown> | undefined;
  return { slug: acfString(first?.slug), name: acfString(first?.name) };
}
