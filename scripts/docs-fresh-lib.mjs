// scripts/docs-fresh-lib.mjs
// ---------------------------------------------------------------------------
// منطق خالص نگهبان مستندات (بدون دیسک) — آزمون: scripts/docs-fresh.test.mjs.
//
// ⚠️ چرا این فایل ساخته شد (۲۹ مهر ۱۴۰۵): نگهبان قبلی فقط یک *فهرست سیاه دستی* (RETIRED) داشت. هر
// تابع PHP، گروه ACF یا دکمه‌ای که حذف می‌شد و کسی نامش را دستی به RETIRED نمی‌افزود، از دید نگهبان
// پنهان می‌ماند. دقیقاً همین‌طور `categoryContent`، `cyh_repair_slugs` و `cyh_build_hierarchy` ماه‌ها
// در مستندات «زنده» ماندند در حالی که در کد نبودند (بازبینی Gemini).
//
// حالا جهت برعکس هم بررسی می‌شود — **مستندات با کد زنده سنجیده می‌شود (فهرست سفید از خود کد):**
//   • هر `cyh_*` در بک‌تیک باید در PHP افزونه وجود داشته باشد؛
//   • هر نام گروه ACF (`…Fields`، `contentBlocks`، `authorProfile`، `categoryMeta`، …) و هر `group_cyh_*`
//     باید در تعریف زنده‌ی ACF (acf-json یا PHP) باشد؛
//   • هر `npm run <نام>` باید در scripts ‌ِ package.json باشد.
// نام ناموجود فقط وقتی مجاز است که *همان خط* بگوید رفته (خط‌خورده، «حذف شد»، ✅ …) یا خط در بخشی
// تاریخی باشد **و** زمان آینده نگوید («حذف پس از آخرین اجرا» یعنی هنوز ادعای وجود — همان دروغ).
// ---------------------------------------------------------------------------

/** کلماتی که یک *بخش* یا *پنجره‌ی* متن را «درباره‌ی حذف» می‌کنند (همان معنای نگهبان قدیمی). */
export const REMOVAL_WORDS = /(حذف|بازنشسته|پاک ?شد|تاریخچه|removed|deleted|retired|history|changelog|no longer|دیگر وجود ندارد)/i;
/** گذشته‌ی قطعی: خطی که خودش می‌گوید این نام رفته است. */
export const PAST_MARKERS = /(~~|✅|حذف شد|حذف شدند|پاک شد|بازنشسته شد|بازنشسته|جایگزین شد|removed|deleted|retired|دیگر وجود ندارد|دیگر نیست)/i;
/** آینده یا وعده: هنوز ادعا می‌کند چیزی وجود دارد که قرار است برود. هرگز معافیت نمی‌گیرد. */
export const FUTURE_MARKERS = /(پس از آخرین اجرا|حذف می‌شود|حذف خواهد|پاک می‌شو|خواهد شد|will be removed|to be removed|\bTODO\b)/i;

/** آیا خط زیر تیتری است که خودش اعلام می‌کند درباره‌ی حذف است؟ (تا تیتر هم‌سطح یا بالاتر بعدی) */
export function headingRemovalSections(lines) {
  const flags = new Array(lines.length).fill(false);
  let depth = 0;
  let active = false;
  lines.forEach((line, i) => {
    const h = /^(#{1,6})\s/.exec(line);
    if (h) {
      const level = h[1].length;
      if (REMOVAL_WORDS.test(line)) {
        active = true;
        depth = level;
      } else if (active && level <= depth) {
        active = false;
      }
    }
    flags[i] = active;
  });
  return flags;
}

/** آیا ذکرِ یک نامِ ناموجود در این خط مجاز است؟ */
export function mayNameMissing(line, inHistoricalSection) {
  if (FUTURE_MARKERS.test(line)) return false;
  if (PAST_MARKERS.test(line)) return true;
  return Boolean(inHistoricalSection);
}

const CYH = /`(cyh_[a-z0-9_]+)`/g;
const GROUP_KEY = /`(group_cyh_[a-z0-9_]+)`/g;
/** نام‌های گراف‌کیوال گروه‌های ACF: camelCase که به یکی از این پسوندها ختم می‌شود. */
const ACF_NAME = /`([a-z][a-zA-Z]*(?:Fields|Blocks|Profile|Meta|Content|Settings))`/g;

/**
 * مستندات را با کد زنده می‌سنجد.
 * @param {string} file نام سند (برای پیام)
 * @param {string} text متن سند
 * @param {{ php: string, acfNames: Set<string>, acfKeys: Set<string>, npmScripts: Record<string,string>|null }} live
 */
export function liveSymbolProblems(file, text, live) {
  const lines = text.split('\n');
  const hist = headingRemovalSections(lines);
  const out = [];
  lines.forEach((line, i) => {
    const where = `${file}:${i + 1}`;
    for (const m of line.matchAll(CYH)) {
      const sym = m[1];
      // ⚠️ نه \b: «admin_post_cyh_hub_import» نام را پس از «_» دارد و \b آن را نمی‌دید؛ ولی «cyh_x_handler» نباید «cyh_x» شمرده شود.
      if (!new RegExp(`(?<![A-Za-z0-9])${sym}(?![A-Za-z0-9_])`).test(live.php) && !mayNameMissing(line, hist[i])) {
        out.push(`${where} — «${sym}» در PHP افزونه نیست (حذف شده؟ خط را خط‌خورده/«حذف شد» کنید یا اصلاح کنید)`);
      }
    }
    for (const m of line.matchAll(GROUP_KEY)) {
      if (!live.acfKeys.has(m[1]) && !mayNameMissing(line, hist[i])) {
        out.push(`${where} — گروه ACF «${m[1]}» در تعریف زنده‌ی ACF نیست`);
      }
    }
    for (const m of line.matchAll(ACF_NAME)) {
      if (!live.acfNames.has(m[1]) && !mayNameMissing(line, hist[i])) {
        out.push(`${where} — نام گراف‌کیوال ACF «${m[1]}» در تعریف زنده نیست (زنده: ${[...live.acfNames].sort().join('، ')})`);
      }
    }
  });
  if (live.npmScripts) {
    for (const m of text.matchAll(/npm run ([a-z0-9:_-]+)/g)) {
      if (!(m[1] in live.npmScripts)) out.push(`${file} — «npm run ${m[1]}» در package.json نیست`);
    }
  }
  return out;
}

/**
 * کامنت‌های PHP را خنثی می‌کند تا «نام‌بردن» با «وجود داشتن» یکی نشود.
 * ⚠️ بدون این، `cyh_repair_slugs` و `cyh_build_hierarchy` «زنده» شمرده می‌شدند — فقط چون کامنتی توضیح می‌داد
 * چرا حذف شده‌اند. همان کور بودنی که این نگهبان برای رفعش نوشته شد.
 */
export function stripPhpComments(src) {
  return String(src)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[\s;{}])\/\/[^\n]*/g, '$1')
    .replace(/(^|[\s;{}])#[^\n[]*/g, '$1');
}

/** نام‌ها و کلیدهای زنده‌ی ACF از JSONها + `graphql_field_name`/`key`های ثبت‌شده در PHP. */
export function acfLiveSets(jsonTexts, php) {
  const acfNames = new Set();
  const acfKeys = new Set();
  for (const t of jsonTexts) {
    try {
      const j = JSON.parse(t);
      if (j.graphql_field_name) acfNames.add(j.graphql_field_name);
      if (j.key) acfKeys.add(j.key);
    } catch {
      /* JSON خراب را check-architecture می‌گیرد */
    }
  }
  for (const m of php.matchAll(/'graphql_field_name'\s*=>\s*'([A-Za-z]+)'/g)) acfNames.add(m[1]);
  for (const m of php.matchAll(/'key'\s*=>\s*'(group_cyh_[a-z0-9_]+)'/g)) acfKeys.add(m[1]);
  return { acfNames, acfKeys };
}
