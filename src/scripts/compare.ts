// src/scripts/compare.ts — فهرست مقایسه در localStorage (صفحه‌ی محصول ↔ /compare/)
// ⚠️ هر خطای ذخیره‌سازی (حالت خصوصی) بی‌صدا؛ فقط اسلاگ‌های [a-z0-9-] — ورودی دست‌کاری‌شده چیزی جز اسلاگ نمی‌سازد.
export const COMPARE_MAX = 4;
const KEY = 'cy-compare-v1';

export function readCompare(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? [...new Set(v.filter((s) => typeof s === 'string' && /^[a-z0-9-]+$/.test(s)))].slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

export function writeCompare(slugs: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(slugs)].slice(0, COMPARE_MAX)));
  } catch {
    /* حالت خصوصی */
  }
}
