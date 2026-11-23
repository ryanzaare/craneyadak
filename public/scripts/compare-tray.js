// public/scripts/compare-tray.js — سینی شناور مقایسه (کارفرما، ۲ آذر ۱۴۰۵؛ الگوی دیجی‌کالا)
// ---------------------------------------------------------------------------
// «برای قابلیتی به این خوبی فقط یک متن ریز طراحی کردی؛ خودم مدت‌ها دنبالش گشتم». وقتی دست‌کم یک قطعه در فهرست مقایسه
// است، روی همه‌ی صفحه‌ها (جز /compare/) یک دکمه‌ی شناور «مقایسه (n)» دیده می‌شود. موبایل: بالای نوار پایین؛ دسکتاپ:
// گوشه‌ی پایین. بی جاوااسکریپت یا فهرست خالی = هیچ عنصری (fixed است، پس CLS ندارد).
//
// ⚠️ چرا فایل خام در public/ و نه ماژول باندل‌شده (۲ آذر ۱۴۰۵، هر گزینه اندازه‌گیری شد — Lighthouse موبایل، مرز ۰٫۹۹):
//   ۱) <script> ماژول جدا در کامپوننت: دو درخواست JS تازه روی همه‌ی صفحه‌ها ⇒ صفحه‌ی اصلی ۰٫۹۸.
//   ۲) is:inline با نشانه‌گذاری در HTML: +۸۴۴ بایت gzip روی HTML محصول ⇒ ۰٫۹۸.
//   ۳) import ایستا از Baskets: +۶۹۱ بایت روی تکه‌ای که همه‌ی صفحه‌ها بار می‌کنند ⇒ ۰٫۹۸.
//   ۴) import() پویا از Baskets: Vite تکه‌ی preload-helper را ایستا وارد می‌کند (یک درخواست عمق‌دو تازه) ⇒ ۰٫۹۸.
//   پایه‌ی صفحه‌ی محصول همین حالا روی لبه است: شبیه‌سازی Lantern با چند صد بایت یک رفت‌وبرگشت (۱۵۰ms) جابه‌جا می‌شود.
//   پس Baskets فقط وقتی فهرست مقایسه پر است این فایل را با یک <script src> می‌افزاید؛ بازدید اول (و Lighthouse) هیچ
//   بایتی از آن نمی‌گیرد. ⚠️ چون این فایل باندل نمی‌شود: (الف) کلاس‌های Tailwind آن با @source در global.css دیده
//   می‌شوند — آن خط را برندار؛ (ب) نام فایل هش ندارد، پس با هر تغییر ?v= را در Baskets.astro بالا ببر.
//   کلید و پالایش اسلاگ عیناً همان src/scripts/compare.ts است (۴ = COMPARE_MAX) — اگر آنجا عوض شد، این‌جا هم.
// ---------------------------------------------------------------------------
(() => {
  if (window.__cyCompareTray) return; // دو بار افزوده شدن اسکریپت بی‌خطر است
  window.__cyCompareTray = true;
  const KEY = 'cy-compare-v1';
  const MAX = 4;
  const count = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? Math.min(new Set(v.filter((s) => typeof s === 'string' && /^[a-z0-9-]+$/.test(s))).size, MAX) : 0;
    } catch {
      return 0;
    }
  };
  let tray = null;
  const sync = () => {
    const n = location.pathname.startsWith('/compare') ? 0 : count();
    if (n === 0) {
      if (tray) tray.hidden = true;
      return;
    }
    if (!tray) {
      tray = document.createElement('div');
      tray.className = 'fixed z-40 bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6 left-4 print:hidden';
      // نشانه‌گذاری ثابت؛ تنها داده‌ی پویا عدد است که با textContent می‌نشیند.
      tray.innerHTML =
        '<div class="flex items-center gap-1 rounded-full bg-steel-900 text-white shadow-lg ps-2 pe-1 py-1">' +
        '<a href="/compare/" class="inline-flex items-center gap-2 min-h-11 px-4 rounded-full text-sm font-bold hover:bg-steel-800">' +
        '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 4v16M15 4v16M4 9h5M15 15h5"/></svg>' +
        'مقایسه (<span data-n></span>)</a>' +
        '<button type="button" class="w-11 h-11 grid place-items-center rounded-full hover:bg-steel-800" aria-label="خالی کردن فهرست مقایسه">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button></div>';
      tray.querySelector('button').addEventListener('click', () => {
        try { localStorage.setItem(KEY, '[]'); } catch { /* حالت خصوصی */ }
        window.dispatchEvent(new CustomEvent('cy-compare'));
      });
      document.body.appendChild(tray);
    }
    tray.querySelector('[data-n]').textContent = n.toLocaleString('fa-IR');
    tray.hidden = false;
  };
  window.addEventListener('cy-compare', sync);
  window.addEventListener('storage', sync);
  sync();
})();
