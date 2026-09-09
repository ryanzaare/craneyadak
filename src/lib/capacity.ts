// src/lib/capacity.ts
// ---------------------------------------------------------------------------
// خواندن «ظرفیت» از متن آزادی که مدیر محتوا نوشته.
//
// ═══════════════════════════════════════════════════════════════════════════
// چرا این کار خطرناک است و چطور مهارش می‌کنیم
// ═══════════════════════════════════════════════════════════════════════════
// فیلد `capacity_note` متن آزاد است: «۳ تا ۳۲ تن»، «۱۲۵ کیلوگرم تا ۳ تن»،
// «۵۰۰ کیلوگرم تا ۵ تن». برای کشیدن نمودار باید عدد استخراج شود.
//
// و اینجا همان جایی است که می‌شود فاجعه ساخت: اگر تجزیه اشتباه کند، نمودار
// یک عددِ **غلط** را با اطمینان کامل نشان می‌دهد. خریدار جرثقیل بر اساس
// ظرفیت تصمیم می‌گیرد؛ نمودارِ غلط بدتر از نبودِ نمودار است.
//
// پس قاعده این است: **تجزیه یا مطمئن است یا اصلاً انجام نمی‌شود.**
// هر ردیفی که الگویش شناخته نشود `null` برمی‌گرداند و در نمودار نمی‌آید.
// اگر تعداد ردیف‌های قابل‌اعتماد کمتر از دو باشد، کل نمودار رسم نمی‌شود و
// فقط جدول می‌ماند.
// ---------------------------------------------------------------------------

export interface CapacityRange {
  /** حداقل ظرفیت، بر حسب تن. */
  minT: number;
  /** حداکثر ظرفیت، بر حسب تن. */
  maxT: number;
}

/** ارقام فارسی و عربی → لاتین. بدون این، هیچ عددی خوانده نمی‌شود. */
function latinDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[،٫]/g, '.');
}

type Unit = 't' | 'kg' | null;

const unitOf = (s: string): Unit => {
  if (/کیلوگرم|کیلو|kg/i.test(s)) return 'kg';
  if (/\bتن\b|ton/i.test(s)) return 't';
  return null;
};

const numberIn = (s: string): number | null => {
  const m = /(\d+(?:\.\d+)?)/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * «۱۲۵ کیلوگرم تا ۳ تن» → { minT: 0.125, maxT: 3 }
 *
 * ⚠️ اگر یک طرف واحد نداشته باشد، واحد طرف دیگر به آن نسبت داده می‌شود —
 * چون «۳ تا ۳۲ تن» یعنی هر دو تن‌اند. ولی اگر **هیچ** طرفی واحد نداشته
 * باشد، `null` برمی‌گردد: حدس زدن واحد یعنی ساختن عدد.
 */
export function parseCapacity(raw: string | null | undefined): CapacityRange | null {
  if (!raw) return null;
  const s = latinDigits(String(raw)).trim();
  if (!/\d/.test(s)) return null;

  const parts = s.split(/\s*(?:تا|-|–|—|to)\s*/i).filter((x) => /\d/.test(x));
  if (parts.length === 0) return null;

  const lo = parts[0];
  const hi = parts.length > 1 ? parts[parts.length - 1] : parts[0];

  const nLo = numberIn(lo);
  const nHi = numberIn(hi);
  if (nLo === null || nHi === null) return null;

  let uLo = unitOf(lo);
  let uHi = unitOf(hi);
  if (uLo === null && uHi === null) return null; // واحد نامعلوم → رد
  uLo ??= uHi;
  uHi ??= uLo;

  const toT = (n: number, u: Unit) => (u === 'kg' ? n / 1000 : n);
  const a = toT(nLo, uLo);
  const b = toT(nHi, uHi);

  const minT = Math.min(a, b);
  const maxT = Math.max(a, b);
  if (!(minT > 0) || !(maxT > 0)) return null;

  return { minT, maxT };
}

export interface CapacityBar extends CapacityRange {
  label: string;
  /** درصد از چپِ محور (۰ تا ۱۰۰) — از پیش محاسبه‌شده، بدون جاوااسکریپت. */
  left: number;
  /** عرض میله بر حسب درصد. */
  width: number;
}

export interface CapacityScale {
  bars: CapacityBar[];
  /** برچسب‌های محور، از کوچک به بزرگ. */
  ticks: { label: string; at: number }[];
}

const fmt = (t: number) => (t < 1 ? `${Math.round(t * 1000)} kg` : `${Number(t.toFixed(1))} t`);

/**
 * مقیاس **لگاریتمی** — و این انتخاب عمدی است.
 *
 * دامنه‌ی واقعی این داده از ۱۲۵ کیلوگرم تا ۳۲ تن است، یعنی ضریب ۲۵۶.
 * روی محور خطی، میله‌ی ۱۲۵ کیلوگرمی کمتر از نیم درصد عرض می‌گیرد و عملاً
 * نامرئی می‌شود — نموداری که یک ردیفش دیده نشود، جدول را بدتر کرده است.
 */
export function buildCapacityScale(rows: { label: string; capacity: string | null }[]): CapacityScale | null {
  const parsed = rows
    .map((r) => ({ label: r.label, range: parseCapacity(r.capacity) }))
    .filter((r): r is { label: string; range: CapacityRange } => r.range !== null);

  // با یک ردیف، «نمودار مقایسه‌ای» معنا ندارد.
  if (parsed.length < 2) return null;

  const lo = Math.min(...parsed.map((p) => p.range.minT));
  const hi = Math.max(...parsed.map((p) => p.range.maxT));
  if (!(hi > lo)) return null;

  const L = Math.log10(lo);
  const H = Math.log10(hi);
  const pos = (t: number) => ((Math.log10(t) - L) / (H - L)) * 100;

  const bars: CapacityBar[] = parsed.map((p) => {
    const left = pos(p.range.minT);
    // میله‌ی تک‌نقطه‌ای نامرئی می‌شود؛ حداقل عرض دیداری می‌گیرد.
    const width = Math.max(pos(p.range.maxT) - left, 1.5);
    return { label: p.label, ...p.range, left, width };
  });

  const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];
  const ticks = candidates
    .filter((t) => t >= lo && t <= hi)
    .map((t) => ({ label: fmt(t), at: pos(t) }));

  // همیشه دو سرِ محور برچسب داشته باشند.
  if (ticks.length === 0 || ticks[0].at > 2) ticks.unshift({ label: fmt(lo), at: 0 });
  if (ticks[ticks.length - 1].at < 98) ticks.push({ label: fmt(hi), at: 100 });

  return { bars, ticks };
}
