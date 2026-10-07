#!/usr/bin/env node
// scripts/run-lhci.mjs — `npm run lighthouse` (پس از `npm run build`)
// ---------------------------------------------------------------------------
// Lighthouse CI روی خروجی ساخته‌شده‌ی dist/ (سرور استاتیک خودِ lhci)، دسکتاپ و موبایل، ۳ اجرا
// برای هر صفحه (میانه). ⚠️ هرگز روی `astro dev` نه (CLAUDE.md). گزارش‌ها در .astro/lhci-* (خارج از git).
//
// چرا روی dist و نه سایت زنده: این گیت «رگرسیون کد» را می‌گیرد (CLS، JS بلاک‌کننده، آلت و متای سئو)
// بدون نویز شبکه/سرور. موارد وابسته به سرور (فشرده‌سازی، کش، TTFB، HTTPS) عمداً در assertions نیست؛
// آن‌ها را verify-deploy روی دامنه‌ی زنده می‌سنجد. آستانه‌ها در lighthouserc.{desktop,mobile}.json.
// ---------------------------------------------------------------------------
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

if (!existsSync('dist/index.html')) {
  console.error('❌ dist/ نیست — اول `npm run build`.');
  process.exit(1);
}
let failed = 0;
try {
  for (const preset of ['desktop', 'mobile']) {
    console.log(`\n── Lighthouse CI (${preset}) ──`);
    const r = spawnSync('npx', ['lhci', 'autorun', `--config=./lighthouserc.${preset}.json`], { stdio: 'inherit' });
    if (r.status !== 0) failed++;
  }
} finally {
  rmSync('.lighthouseci', { recursive: true, force: true }); // خروجی خام lhci؛ .gitignore کارفرما را دست نمی‌زنیم
}
if (failed) {
  console.error(`\n❌ Lighthouse CI در ${failed} پیکربندی شکست خورد.`);
  process.exit(1);
}
console.log('\n✅ Lighthouse CI: دسکتاپ و موبایل هر دو از آستانه‌ها گذشتند.');
