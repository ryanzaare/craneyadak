// src/components/business-hours.ts
// ---------------------------------------------------------------------------
// «الان در ساعت کاری هستیم؟» — برای نقطه‌ی سبز «خط ویژه تامین» هدر (Frontend v2، فاز ۳).
//
// ⚠️ چرا نقطه همیشه سبز نیست (قاعده‌ی ۲ — هرگز توانمندی تجاری نساز): نقطه‌ی سبزِ ثابت یعنی «همین الان کسی جواب
// می‌دهد»، ساعت ۲ بامداد جمعه هم. پس HTML ایستا نقطه را خنثی (steel) می‌فرستد و این تابع در مرورگر، فقط داخل
// ساعت کاری ثبت‌شده در وردپرس، آن را سبز می‌کند. بدون جاوااسکریپت یا بدون ساعت کاری = خنثی، نه سبز.
// ⚠️ به وقت تهران (Intl، نه getHours مرورگر): خریدار خارج از ایران یا گوشیِ با منطقه‌ی زمانی غلط نباید «باز»
// ببیند وقتی دفتر بسته است. داده: همان site-options.hours که openingHoursSpecification صفحه‌ی اصلی را می‌سازد.
// آزمون: business-hours.test.mts (npm run test:hours). خالص و بی‌import تا مرورگر و Node هر دو اجرا کنند.
// ---------------------------------------------------------------------------

export interface HoursRow {
  dayOfWeek: string[];
  opens: string;
  closes: string;
}

const HHMM = /^(\d{1,2}):(\d{2})/;
const minutes = (t: string): number | null => {
  const m = HHMM.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export function isOpenAt(hours: HoursRow[], at: Date, timeZone = 'Asia/Tehran'): boolean {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = get('weekday');
  const now = Number(get('hour')) * 60 + Number(get('minute'));
  return hours.some((row) => {
    // «https://schema.org/Saturday» یا «Saturday» — هر دو شکلی که ACF/JSON-LD می‌دهد.
    if (!row.dayOfWeek.some((d) => d.replace(/^.*\//, '') === day)) return false;
    const open = minutes(row.opens);
    const close = minutes(row.closes);
    return open !== null && close !== null && now >= open && now < close;
  });
}
