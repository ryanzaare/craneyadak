// src/lib/urls.mjs
// ---------------------------------------------------------------------------
// شکل واحد نشانی صفحه‌ها: **با «/» پایانی**.
//
// ⚠️ چرا: خروجی Astro برای هر صفحه یک پوشه با index.html است و sitemap
// نشانی‌ها را با «/» می‌نویسد (`/about/`). Apache نشانی بدون «/» را با ۳۰۱ به
// نسخه‌ی «/» می‌برد. canonical بدون «/» یعنی canonical به نشانیِ
// ریدایرکت‌شونده اشاره می‌کند و با sitemap نمی‌خواند — ۷۰ از ۷۱ صفحه این
// حالت را داشت. این فایل .mjs است تا هم Layout و هم اسکریپت‌های postbuild
// (بدون هیچ پرچم node) آن را بخوانند.
// ---------------------------------------------------------------------------

/** مسیر (یا نشانی کامل) صفحه با «/» پایانی. فایل‌ها (`x.jpg`)، query و hash دست‌نخورده. */
export function withTrailingSlash(input) {
  const s = String(input);
  const cut = s.search(/[?#]/);
  const head = cut === -1 ? s : s.slice(0, cut);
  const tail = cut === -1 ? '' : s.slice(cut);
  if (head === '' || head.endsWith('/')) return s;
  const last = head.slice(head.lastIndexOf('/') + 1);
  // «https://craneyadak.com» (بدون مسیر) آخرین بخشش «craneyadak.com» است، نه فایل.
  if (/^[a-z]+:\/\/[^/]+$/i.test(head)) return `${head}/${tail}`;
  if (last.includes('.')) return s;
  return `${head}/${tail}`;
}

/**
 * فقط `<a href="/…">` داخلی. نشانی خارجی، `//cdn`، `tel:`، `#hash`، فایل‌ها و
 * نشانی‌های پرس‌وجودار (برای خروجی‌های ساخته‌شده با JS) دست‌نخورده می‌مانند.
 * @returns {{ html: string, changed: number }}
 */
export function normalizeInternalLinks(html) {
  let changed = 0;
  const out = html.replace(/(<a\s[^>]*?\bhref=)(["'])(\/(?!\/)[^"'#?]*)\2/gi, (m, pre, q, path) => {
    const fixed = withTrailingSlash(path);
    if (fixed === path) return m;
    changed++;
    return `${pre}${q}${fixed}${q}`;
  });
  return { html: out, changed };
}

/**
 * در JSON-LD فقط مقادیر کلیدهای `url` و `item` (نشانی صفحه) اصلاح می‌شوند.
 * `@id` عمداً دست‌نخورده است: شناسه است، نه نشانی‌ای که خزیده شود، و
 * ارجاع‌هایش به یکدیگر باید همان رشته بماند. `urlTemplate` هم دارای
 * پارامتر جستجوست.
 */
export function normalizeJsonLdUrls(node, origin) {
  if (Array.isArray(node)) return node.map((n) => normalizeJsonLdUrls(n, origin));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      if ((k === 'url' || k === 'item') && typeof v === 'string' && (v.startsWith(`${origin}/`) || v === origin)) {
        out[k] = withTrailingSlash(v);
      } else {
        out[k] = normalizeJsonLdUrls(v, origin);
      }
    }
    return out;
  }
  return node;
}
