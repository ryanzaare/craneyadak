#!/usr/bin/env node
// scripts/run-lhci.mjs — `npm run lighthouse` (پس از `npm run build`)
// ---------------------------------------------------------------------------
// Lighthouse CI روی خروجی ساخته‌شده‌ی dist/ (سرور استاتیک خودِ lhci)، دسکتاپ و موبایل، ۳ اجرا
// برای هر صفحه (میانه). ⚠️ هرگز روی `astro dev` نه (CLAUDE.md). گزارش‌ها در .astro/lhci-* (خارج از git).
//
// چرا روی dist و نه سایت زنده: این گیت «رگرسیون کد» را می‌گیرد (CLS، JS بلاک‌کننده، آلت و متای سئو)
// بدون نویز شبکه/سرور. موارد وابسته به سرور (فشرده‌سازی، کش، TTFB، HTTPS) عمداً در assertions نیست؛
// آن‌ها را verify-deploy روی دامنه‌ی زنده می‌سنجد. آستانه‌ها در lighthouserc.json (یک منبع).
// ---------------------------------------------------------------------------
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pickChangedUrls } from './lhci-changed.mjs';

// ⚠️ فقط صفحه‌های تغییرکرده (LHCI_ONLY_CHANGED=1، در workflow انتشار) — دلیل و ضمانت‌ها در scripts/lhci-changed.mjs.
// اجرای محلی `npm run lighthouse` همیشه همه را می‌سنجد.
const MANIFEST = '.astro/lhci-passed.json';
const sha = (s) => createHash('sha256').update(s).digest('hex');

if (!existsSync('dist/index.html')) {
  console.error('❌ dist/ نیست — اول `npm run build`.');
  process.exit(1);
}
let failed = 0;
try {
  // ⚠️ یک منبع برای آستانه‌ها: lighthouserc.json. دو فایل desktop/mobile قبلی ۹۸٪ یکسان بودند و هر تغییر باید
  // دو بار تکرار می‌شد (یک بار هم نشد = گیت ناهمخوان). تفاوت فقط preset و پوشه‌ی گزارش است و اینجا اعمال می‌شود.
  // ⚠️ preset 'mobile' در lhci نامعتبر است؛ موبایل = پیش‌فرض Lighthouse (بدون preset).
  const base = JSON.parse(readFileSync('lighthouserc.json', 'utf8'));
  mkdirSync('.astro', { recursive: true });
  const allUrls = base.ci.collect.url;
  const hashes = Object.fromEntries(allUrls.map((u) => [u, existsSync(`dist${u}`) ? sha(readFileSync(`dist${u}`)) : '']));
  const configHash = sha(readFileSync('lighthouserc.json', 'utf8') + readFileSync(new URL(import.meta.url), 'utf8'));
  let prev = null;
  try { prev = JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch { /* نیست = همه */ }
  const pick = process.env.LHCI_ONLY_CHANGED === '1' ? pickChangedUrls(allUrls, hashes, prev, configHash) : { urls: allUrls, reason: 'اجرای کامل (همه‌ی صفحه‌ها)' };
  console.log(`Lighthouse: ${pick.reason}${pick.urls.length && pick.urls.length < allUrls.length ? ` — ${pick.urls.join(' ')}` : ''}`);
  base.ci.collect.url = pick.urls;
  const writeManifest = () => writeFileSync(MANIFEST, JSON.stringify({ configHash, pages: hashes, at: new Date().toISOString() }, null, 2));
  if (pick.urls.length === 0) {
    writeManifest();
    console.log('\n✅ Lighthouse CI: هیچ صفحه‌ی سنجیدنی از آخرین اجرای سبز تغییر نکرده — گیت بی‌تغییر گذشت.');
    process.exit(0);
  }
  process.on('exit', (code) => { if (code === 0) writeManifest(); });
  for (const preset of ['desktop', 'mobile']) {
    console.log(`\n── Lighthouse CI (${preset}) ──`);
    const cfg = structuredClone(base);
    if (preset === 'desktop') cfg.ci.collect.settings = { ...cfg.ci.collect.settings, preset: 'desktop' };
    cfg.ci.upload.outputDir = `./.astro/lhci-${preset}`;
    // ⚠️ فقط گزارش آخرین اجرا نگه داشته می‌شود (۲۷ آبان ۱۴۰۵): گزارش‌ها هر بار انباشته می‌شدند و پوشه به ۱ گیگابایت
    // (۷۷۵ فایل) رسیده بود. تاریخچه‌ی امتیاز در لاگ CI هست؛ این پوشه فقط برای بازکردن گزارش همین اجراست.
    rmSync(cfg.ci.upload.outputDir, { recursive: true, force: true });
    const file = `.astro/lighthouserc.${preset}.json`;
    writeFileSync(file, JSON.stringify(cfg, null, 2));
    const r = spawnSync('npx', ['lhci', 'autorun', `--config=./${file}`], { stdio: 'inherit' });
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
