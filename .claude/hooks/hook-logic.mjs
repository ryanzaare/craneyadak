// .claude/hooks/hook-logic.mjs
// ---------------------------------------------------------------------------
// منطق خالص دو هوک پروژه (آزمون‌شده در hooks.test.mjs — قاعده‌ی ۶ CLAUDE.md).
//
// چرا این دو هوک: «قاعده‌ی نوشته‌شده در CLAUDE.md» یک بار با npm run check قرمز کامیت
// شد (نگاه کنید به توضیح .claude/settings.json). هوک، *مانع* است؛ متن، فقط یادآور.
// ---------------------------------------------------------------------------

/** دستور Bash که (در هر جای زنجیره‌ی &&/;) `git commit` دارد؟ `git commit-tree` و … نه. */
export function isGitCommit(command) {
  return /(^|[\s;&|(])git\s+(?:(?:-c\s+\S+|-C\s+\S+|-[^\s]+)\s+)*commit(\s|$)/.test(command);
}

/** اضطراری صریح و دیده‌شونده در خودِ دستور: SKIP_PRECOMMIT_CHECK=1 git commit … */
export function hasSkipFlag(command) {
  return /(^|[\s;&|(])SKIP_PRECOMMIT_CHECK=1(\s|$)/.test(command);
}

const rel = (p, root) => {
  const s = String(p ?? '').replace(/\\/g, '/');
  const r = String(root ?? '').replace(/\\/g, '/').replace(/\/$/, '');
  return r && s.startsWith(`${r}/`) ? s.slice(r.length + 1) : s.replace(/^\.\//, '');
};

/**
 * @returns {string|null} دلیل مسدودشدن، یا null اگر ویرایش مجاز است.
 * فایل‌های تولیدی یا مرده که ویرایش دستی‌شان دقیقاً همان باگ‌هایی است که قبلاً خوردیم.
 */
export function protectedReason(filePath, projectRoot = '') {
  const p = rel(filePath, projectRoot);
  if (p === 'src/data/taxonomy.generated.ts') {
    return 'taxonomy.generated.ts خروجی build است (وردپرس مرجع است). ویرایشش دستی نکنید؛ `npm run taxonomy` یا build آن را می‌سازد.';
  }
  if (p === 'dist' || p.startsWith('dist/')) {
    return 'dist/ خروجی build است و روی هر build پاک می‌شود. منبع را در src/ یا scripts/ ویرایش کنید.';
  }
  if (p === 'public/_redirects') {
    return 'public/_redirects (قالب Netlify) عمداً حذف شد و روی Apache بی‌اثر است. ریدایرکت‌ها فقط در src/data/legacy-redirects.mjs.';
  }
  if (/(^|\/)\.env(\..+)?$/.test(p) && !/(^|\/)\.env\.example$/.test(p)) {
    return '.env محرمانه است و ویرایشش بدون کارفرما ممنوع است؛ نمونه‌ی متغیرها در .env.example.';
  }
  if (p === '.git' || p.startsWith('.git/')) {
    return 'پوشه‌ی .git را مستقیم ویرایش نکنید؛ از دستورهای git استفاده کنید.';
  }
  return null;
}
