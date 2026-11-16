// scripts/lhci-changed.mjs
// ---------------------------------------------------------------------------
// کدام صفحه‌ها باید دوباره Lighthouse بخورند؟ فقط آن‌هایی که HTML‌شان از آخرین انتشارِ *سبز* تغییر کرده.
//
// چرا (کارفرما، ۲۶ آبان ۱۴۰۵: «چرا صفحه‌هایی را که عوض نکردیم دوباره می‌سازیم؟»): زمان‌سنجی واقعی انتشار #—:
// build کل سایت ۷۷ ثانیه، **Lighthouse ۵۴۹ ثانیه (۷۴٪)**، آپلود ۸ ثانیه (FTP خودش فقط فایل تغییرکرده را می‌فرستد).
// ساختن دوباره‌ی همه‌ی صفحه‌ها ارزان و لازم است — یک محصول تازه منو، دسته، برند، هاب‌ها و sitemap را عوض می‌کند —
// ولی سنجیدن دوباره‌ی صفحه‌ای که حتی یک بایت HTML‌اش عوض نشده، هر شب ۹ دقیقه هدر بود.
//
// ⚠️ چرا هش HTML کافی است: CSS درون HTML است (inlineStylesheets: 'always')، JS و تصویر و فونت با نام هش‌دار در HTML
// ارجاع می‌شوند — هر تغییری در هر کدام، HTML را عوض می‌کند. build قطعی است (دو build پشت سر هم، هش یکسان؛ سنجیده ۲۶ آبان).
// ⚠️ تغییر آستانه‌ها (lighthouserc.json) یا خود اسکریپت = همه‌ی صفحه‌ها دوباره (configHash).
// ⚠️ مانیفست فقط پس از گذر Lighthouse نوشته و در CI فقط پس از اجرای موفق کش می‌شود — صفحه‌ی شکست‌خورده هرگز «سنجیده» ثبت نمی‌شود.
// ---------------------------------------------------------------------------

/**
 * @param {string[]} urls                        مسیرهای lighthouserc (مثل "/index.html")
 * @param {Record<string,string>} hashes         هش فعلی HTML هر مسیر
 * @param {unknown} prev                         مانیفست آخرین اجرای سبز ({configHash, pages}) یا هر چیز خراب
 * @param {string} configHash                    هش آستانه‌ها + اسکریپت
 * @returns {{ urls: string[], reason: string }}
 */
export function pickChangedUrls(urls, hashes, prev, configHash) {
  const p = /** @type {any} */ (prev);
  if (!p || typeof p !== 'object' || typeof p.pages !== 'object' || p.pages === null) {
    return { urls: [...urls], reason: 'مانیفست قبلی نیست یا خراب است — همه‌ی صفحه‌ها' };
  }
  if (p.configHash !== configHash) return { urls: [...urls], reason: 'آستانه‌ها یا اسکریپت Lighthouse عوض شده — همه‌ی صفحه‌ها' };
  const changed = urls.filter((u) => !hashes[u] || p.pages[u] !== hashes[u]);
  return { urls: changed, reason: changed.length ? `${changed.length} صفحه از ${urls.length} تغییر کرده` : 'هیچ صفحه‌ی سنجیدنی تغییر نکرده' };
}
