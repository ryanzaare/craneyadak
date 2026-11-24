// src/scripts/search-overlay.ts — جستجوی فوری درجا (O32؛ کارفرما ۴ آذر ۱۴۰۵)
// ---------------------------------------------------------------------------
// «جستجو باید نتیجه را درجا و سریع نشان دهد؛ بردن کاربر به صفحه‌ی دیگر ایده‌ی خوبی نیست» و «تکرارها را حذف کن».
// پیش از این سه جستجوی جدا بود: فرم ساده‌ی هدر (بی پیشنهاد، Enter ⇒ /search/)، SearchBox هیرو/قطعه‌یاب/صفحه‌ی
// جستجو با فهرست کشویی ضعیف (بی تصویر، نام بریده، زیر نوار پایین موبایل). حالا یک جستجو در کل سایت: همان ورودی
// هدر، و این پنل زیر آن.
//
//   • موبایل: پنل تمام‌صفحه زیر هدر (fixed، top = --hdr-h)؛ ورودی همان ورودی هدر می‌ماند تا صفحه‌کلید با اولین
//     لمس باز شود (ورودی تازه داخل پنل در iOS بی لمس دوم صفحه‌کلید باز نمی‌کند).
//   • دسکتاپ: پنل بزرگ زیر ورودی.
//   • خالی: جستجوهای اخیر (فقط localStorage همین مرورگر) + میان‌برهای دسته‌های دارای کالا.
//   • نتیجه: گروه‌بندی‌شده — قطعه‌ها (تصویر ۱۶۰px خود سایت، کد فنی، برند، موجود/اصل)، دسته‌ها، برندها؛ همان موتور
//     «هرگز خالی» (src/lib/search-score.ts suggestAlways، آزمون npm run test:search) با برچسب صادقانه‌ی پله‌ی تقریبی.
//   • Enter: نتیجه‌ها درجا می‌مانند (صفحه‌کلید بسته می‌شود تا دیده شوند)؛ با پیشنهاد انتخاب‌شده (فلش‌ها) همان را باز
//     می‌کند. «همه‌ی نتایج» تنها راه /search/ است (جستجوی تمام‌متن Pagefind، پیوند اشتراکی، بی‌جاوااسکریپت).
//
// ⚠️ بار تنبل: این ماژول با اولین تماس با ورودی هدر import می‌شود (Header.astro)، و داده (/search-index.json) با
// همان. هیچ بایتی از آن در مسیر بحرانی LCP نیست (backlog O23 — صفحه‌ی محصول روی لبه‌ی ۰٫۹۹ است).
// ⚠️ textContent/esc برای هر داده: نام‌ها از وردپرس و جستجوهای اخیر از localStorage می‌آیند.
// ---------------------------------------------------------------------------
import { suggestAlways, type SuggestEntry, type SearchMode } from '../lib/search-score';

const RECENT_KEY = 'cy-search-recent-v1';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
// خط تیره‌ی نشکن در کد فنی (U+2011) — «SAGA1-L10» سر خط نشکند و راست‌به‌چپ وارونه خوانده نشود.
const nb = (s: string) => s.replace(/([A-Za-z0-9])-([A-Za-z0-9])/g, '$1‑$2');

let data: SuggestEntry[] | null = null;
let loading: Promise<SuggestEntry[]> | null = null;
const load = () =>
  (loading ??= fetch('/search-index.json')
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
    .then((list) => (data = Array.isArray(list) ? list : [])));

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.length <= 80).slice(0, 6) : [];
  } catch { return []; }
}
function pushRecent(q: string) {
  const t = q.trim();
  if (!t) return;
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([t, ...readRecent().filter((x) => x !== t)].slice(0, 6))); } catch { /* حالت خصوصی */ }
}

const NOTE: Partial<Record<SearchMode, string>> = {
  approximate: 'عبارت دقیق پیدا نشد — نزدیک‌ترین نتایج:',
  popular: 'عبارت دقیق پیدا نشد — پرکاربردها:',
};
const GROUP: Record<SuggestEntry['kind'], string> = { product: 'قطعه‌ها', category: 'دسته‌ها', silo: 'گروه‌ها', brand: 'برندها' };

let mounted = false;
function mountSearch(input: HTMLInputElement): void {
  if (mounted) return;
  mounted = true;
  const form = input.closest('form');
  const panel = document.createElement('div');
  panel.id = 'cy-search-panel';
  panel.className = 'cy-search-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'نتیجه‌های جستجو');
  panel.innerHTML = '<div class="cy-search-inner"><ul role="listbox" id="cy-search-list" aria-label="پیشنهادهای جستجو"></ul></div>';
  document.body.appendChild(panel);
  const list = panel.querySelector<HTMLUListElement>('#cy-search-list')!;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-controls', 'cy-search-list');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');

  let active = -1;
  const options = () => [...list.querySelectorAll<HTMLElement>('[role="option"]')];
  const place = () => {
    // دسکتاپ: درست زیر ورودی، هم‌راستا با لبه‌ی راست آن. موبایل: CSS تمام‌صفحه زیر هدر.
    const r = input.closest('form')!.getBoundingClientRect();
    panel.style.setProperty('--sp-top', `${Math.round(r.bottom + 6)}px`);
    panel.style.setProperty('--sp-right', `${Math.round(window.innerWidth - r.right)}px`);
    const hb = input.closest('header')?.getBoundingClientRect().bottom ?? r.bottom;
    panel.style.setProperty('--sp-hb', `${Math.max(0, Math.round(hb))}px`);
  };
  const open = () => {
    place();
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('cy-search-open');
  };
  const close = () => {
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    document.documentElement.classList.remove('cy-search-open');
    active = -1;
  };

  const option = (e: SuggestEntry, i: number) => {
    const thumb = e.kind === 'product'
      ? (e.image ? `<img src="${esc(e.image)}" alt="" width="56" height="56" loading="lazy" class="w-14 h-14 shrink-0 object-contain rounded bg-white border border-steel-200">`
        : '<span class="w-14 h-14 shrink-0 rounded bg-steel-100"></span>')
      : `<span class="w-10 h-10 shrink-0 rounded-md bg-steel-100 text-steel-600 grid place-items-center" aria-hidden="true"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="${e.kind === 'brand' ? 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z' : 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z'}"/></svg></span>`;
    const badges = e.kind === 'product'
      ? (e.stock === 'in_stock' ? '<span class="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-1.5">موجود</span>' : '') +
        (e.original ? '<span class="text-xs font-bold text-steel-800 bg-steel-100 border border-steel-300 rounded px-1.5">اصل</span>' : '')
      : '';
    return `<li role="option" id="cy-sopt-${i}" aria-selected="false" class="aria-selected:bg-steel-100"><a href="${esc(e.href)}" tabindex="-1" class="flex items-center gap-3 px-4 py-3 hover:bg-steel-50">
      ${thumb}<span class="min-w-0 flex-1"><span class="block text-base font-bold text-steel-900 leading-7">${esc(nb(e.label))}</span>
      <span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-steel-600">${e.code ? `<code class="font-mono font-bold text-steel-900" dir="ltr">${esc(e.code)}</code>` : ''}<span>${esc(e.context)}</span>${badges}</span></span></a></li>`;
  };

  const head = (t: string) => `<li role="presentation" class="px-4 pt-4 pb-1 text-sm font-bold text-steel-600">${t}</li>`;

  function renderEmpty() {
    const recent = readRecent();
    // فقط دسته‌های دارای کالا (count از /search-index.json) — پیشنهاد دسته‌ی خالی وعده‌ی توخالی است.
    const cats = (data ?? []).filter((e) => e.kind === 'category' && (e.count ?? 0) > 0).slice(0, 6);
    list.innerHTML =
      (recent.length ? head('جستجوهای اخیر') + `<li role="presentation" class="px-4 pb-2 flex flex-wrap gap-2">${recent.map((q) =>
        `<button type="button" data-recent="${esc(q)}" class="min-h-10 px-3 rounded-full border border-steel-300 text-sm text-steel-800 hover:border-action">${esc(q)}</button>`).join('')}
        <button type="button" data-recent-clear class="min-h-10 px-2 text-sm font-bold text-accent-ink hover:underline">پاک کردن</button></li>` : '') +
      head('کد را ندارید؟') +
      `<li role="presentation" class="px-4 pb-3"><a href="/part-finder/" class="flex items-center justify-between gap-3 min-h-12 px-4 rounded-md border-2 border-dashed border-steel-300 text-base font-bold text-steel-900 hover:border-action">عکس پلاک را بفرستید — قطعه‌یاب<span aria-hidden="true">←</span></a></li>` +
      (cats.length ? head('دسته‌های دارای کالا') + cats.map((e, i) => option(e, 100 + i)).join('') : '');
    active = -1;
  }

  function render() {
    const q = input.value;
    if (!q.trim()) { renderEmpty(); return; }
    const { items, mode, corrected } = suggestAlways(data ?? [], q, 12);
    const note = mode === 'layout' ? `منظورتان «${esc(corrected ?? '')}» بود؟` : NOTE[mode] ? esc(NOTE[mode]!) : '';
    // گروه‌بندی با حفظ ترتیب امتیاز داخل هر گروه؛ قطعه اول (کالای قابل سفارش بر صفحه‌ی دسته مقدم است).
    const order: SuggestEntry['kind'][] = ['product', 'category', 'brand', 'silo'];
    let i = 0;
    const groups = order.map((k) => {
      const g = items.filter((e) => e.kind === k);
      return g.length ? head(GROUP[k]) + g.map((e) => option(e, i++)).join('') : '';
    }).join('');
    list.innerHTML = (note ? `<li role="presentation" class="px-4 py-2 text-sm font-bold text-amber-900 bg-amber-50">${note}</li>` : '') +
      (groups || `<li role="presentation" class="px-4 py-6 text-base text-steel-700 leading-8">موردی پیدا نشد. <a href="/part-finder/" class="font-bold text-accent-ink underline">عکس پلاک را بفرستید</a>.</li>`) +
      `<li role="presentation" class="sticky bottom-0 bg-white border-t border-steel-200"><a href="/search/?q=${encodeURIComponent(q.trim())}" data-all class="flex items-center justify-between gap-3 px-4 min-h-12 text-base font-bold text-accent-ink hover:bg-steel-50">همه‌ی نتایج برای «${esc(q.trim())}» (جستجو در متن صفحه‌ها)<span aria-hidden="true">←</span></a></li>`;
    active = -1;
    input.removeAttribute('aria-activedescendant');
  }

  const highlight = (next: number) => {
    const opts = options();
    if (!opts.length) return;
    opts[active]?.setAttribute('aria-selected', 'false');
    active = (next + opts.length) % opts.length;
    opts[active].setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', opts[active].id);
    opts[active].scrollIntoView({ block: 'nearest' });
  };

  const refresh = () => { render(); if (panel.hidden) open(); };
  input.addEventListener('input', () => { refresh(); if (!data) load().then(() => { if (!panel.hidden) render(); }); });
  input.addEventListener('focus', () => { load().then(() => { if (!panel.hidden) render(); }); refresh(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (panel.hidden) refresh(); highlight(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
  });
  // ⚠️ Enter = نتیجه درجا (کارفرما: «به صفحه‌ی دیگر نبر»)، نه ارسال فرم. با پیشنهاد انتخاب‌شده، همان را باز می‌کند.
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const link = active >= 0 ? options()[active]?.querySelector('a') : null;
    pushRecent(input.value);
    if (link) { location.href = link.getAttribute('href')!; return; }
    refresh();
    input.blur(); // صفحه‌کلید موبایل بسته شود تا نتیجه‌ها دیده شوند
  });
  panel.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const r = t.closest<HTMLElement>('[data-recent]');
    if (r) { input.value = r.dataset.recent!; input.focus(); refresh(); return; }
    if (t.closest('[data-recent-clear]')) { try { localStorage.removeItem(RECENT_KEY); } catch { /* */ } renderEmpty(); return; }
    if (t.closest('a')) pushRecent(input.value);
  });
  // بیرون از پنل و ورودی = بستن. لمس پس‌زمینه‌ی تیره‌ی دسکتاپ هم.
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as Node;
    if (panel.hidden || panel.querySelector('.cy-search-inner')!.contains(t) || form?.contains(t)) return;
    close();
  });
  window.addEventListener('resize', () => { if (!panel.hidden) place(); });
  // ⚠️ داده همین حالا: باندل پس از اولین لمس می‌رسد و کاربر ممکن است تا آن لحظه تایپ کرده باشد — رویداد input
  // دیگری نمی‌آید که واکشی را راه بیندازد (دیده‌شده ۴ آذر ۱۴۰۵: «پیدا نشد» برای «saga l12» با داده‌ی خالی).
  load().then(() => { if (!panel.hidden) render(); });
  if (document.activeElement === input) refresh();
}

// باندل IIFE است (astro.config.mjs): با رسیدن، خودش ورودی هدر را سوار می‌کند. اگر کاربر تا این لحظه فوکوس کرده یا
// تایپ کرده، mountSearch همان را با refresh نشان می‌دهد.
const headerInput = document.getElementById('header-search');
if (headerInput instanceof HTMLInputElement) mountSearch(headerInput);
