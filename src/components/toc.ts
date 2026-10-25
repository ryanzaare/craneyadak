// src/components/toc.ts
// ---------------------------------------------------------------------------
// فهرست مطالب مقاله (Frontend v2، فاز ۵) از <h2>های HTML ویرایشگر وردپرس، در زمان build.
// خالص و بی‌import (آزمون: toc.test.mts — npm run test:toc).
// ⚠️ id موجود نویسنده حفظ می‌شود (پیوندی که کسی به #wear داده نباید بشکند)؛ فقط h2 بی‌id شماره‌ی «h-N» می‌گیرد.
// شماره بر اساس جایگاه h2 است، نه متن — اسلاگ فارسی در URL ناخوانا و شکننده است.
// ---------------------------------------------------------------------------

export interface TocItem {
  id: string;
  text: string;
}

const decode = (t: string) =>
  t.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');

export function buildToc(html: string): { html: string; items: TocItem[] } {
  const items: TocItem[] = [];
  let n = 0;
  const out = html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi, (whole, attrs: string | undefined, inner: string) => {
    n++;
    const text = decode(inner.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (!text) return whole;
    const existing = attrs?.match(/\sid=["']([^"']+)["']/i)?.[1];
    const id = existing ?? `h-${n}`;
    items.push({ id, text });
    return existing ? whole : `<h2 id="${id}"${attrs ?? ''}>${inner}</h2>`;
  });
  return { html: out, items };
}
