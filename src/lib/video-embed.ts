// src/lib/video-embed.ts
// ---------------------------------------------------------------------------
// نشانی ویدیو (آپارات / یوتیوب) ← نشانی iframe برای پخش داخل خود سایت.
//
// چرا (کارفرما، ۲۵ آبان ۱۴۰۵): بلوک ویدیو فقط لینکی به آپارات در زبانه‌ی تازه بود؛ بازدیدکننده سایت را ترک می‌کرد.
// حالا قاب ویدیو تا کلیک کاربر یک «جلد» سبک است (هیچ iframe و اسکریپت بیرونی بار نمی‌شود — قفل سرعت) و با کلیک،
// همین تابع نشانی جاسازی را می‌دهد.
//
// ⚠️ فقط شکل‌های شناخته‌شده پذیرفته می‌شوند. نشانی ناشناخته null می‌گیرد و قاب همان لینک زبانه‌ی تازه می‌ماند —
// iframe به نشانی دلخواه یعنی سایت دیگری داخل صفحه‌ی ما، بدون اینکه بدانیم چیست.
// ---------------------------------------------------------------------------

export interface VideoEmbed {
  provider: 'aparat' | 'youtube';
  id: string;
  /** نشانی iframe؛ با کلیک کاربر ساخته می‌شود، پس پخش خودکار پس از همان کلیک مجاز است. */
  embedUrl: string;
}

export function parseVideoUrl(raw: string | null | undefined): VideoEmbed | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^www\./, '').toLowerCase();

  // آپارات: /v/<hash> (لینک اشتراک) یا /video/video/embed/videohash/<hash>/vt/frame (کد جاسازی)
  if (host === 'aparat.com') {
    const m = /^\/v\/([A-Za-z0-9]+)\/?/.exec(u.pathname) ?? /\/videohash\/([A-Za-z0-9]+)(?:\/|$)/.exec(u.pathname);
    if (!m) return null;
    const id = m[1]!;
    return { provider: 'aparat', id, embedUrl: `https://www.aparat.com/video/video/embed/videohash/${id}/vt/frame?autoplay=true` };
  }

  // یوتیوب: watch?v=، youtu.be/، shorts/، embed/ — جاسازی با دامنه‌ی بی‌کوکی
  let yt: string | null = null;
  if (host === 'youtu.be') yt = u.pathname.slice(1).split('/')[0] ?? null;
  else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    yt = u.searchParams.get('v') ?? /^\/(?:shorts|embed)\/([^/?#]+)/.exec(u.pathname)?.[1] ?? null;
  }
  if (yt && /^[A-Za-z0-9_-]{11}$/.test(yt)) {
    return { provider: 'youtube', id: yt, embedUrl: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0` };
  }
  return null;
}

/** بلوک‌هایی که ویدیو دارند اول، بقیه با همان ترتیب (کارفرما: «بلوک ویدیو بالای هر محتوا»). مرتب‌سازی پایدار. */
export function videoBlocksFirst<T extends { media?: readonly { kind: string; videoUrl: string | null }[] }>(blocks: readonly T[]): T[] {
  const hasVideo = (b: T) => (b.media ?? []).some((m) => m.kind === 'video' && Boolean(m.videoUrl));
  return [...blocks.filter(hasVideo), ...blocks.filter((b) => !hasVideo(b))];
}
