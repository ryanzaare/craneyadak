#!/usr/bin/env node
// scripts/check-stretched-links.mjs
// ---------------------------------------------------------------------------
// «پیوند کشیده» (stretched link): <a class="before:absolute before:inset-0"> که با ::before کل کارت را قابل‌کلیک
// می‌کند. ::before با position:absolute به **نزدیک‌ترین نیای positioned** می‌چسبد، نه به کارت.
//
// ⚠️ باگ واقعی (۲۸ آبان ۱۴۰۵): <article> کارت‌های /blog/ کلاس relative نداشت. لایه‌ی ::before هر سه کارت به نیای
// positioned بالاتر (کل صفحه) کشیده شد، لایه‌ها روی هم افتادند و آخرین کارت برنده شد — کلیک روی هر مقاله
// «calibration-brake-pad-demag» را باز می‌کرد. build، Lighthouse و ممیزی همه سبز بودند؛ کارفرما پیدایش کرد.
//
// قاعده: نزدیک‌ترین نیای positioned (relative/absolute/fixed/sticky) پیوند کشیده باید خودِ کارت باشد —
// <article> یا <li> — در همان فایل. نبودنش یا رسیدن به <section>/<div> = خطا.
//
// آزمون روی ورودی خراب (قاعده‌ی ۶): `node scripts/check-stretched-links.mjs --self-test`.
// ---------------------------------------------------------------------------
import { readFileSync, globSync } from 'node:fs';

const POSITIONED = /(^|\s)(relative|absolute|fixed|sticky)(\s|$)/;
const STRETCH = /before:absolute/;
const CARD = new Set(['article', 'li']);
const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'source', 'path', 'circle', 'rect', 'line', 'polyline', 'use']);

/** خطاهای یک تمپلیت: [{line, msg}] */
export function checkStretched(src) {
  const body = src.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const stack = [];
  const errs = [];
  const re = /<(\/?)([a-zA-Z][\w.-]*)((?:[^>"'{]|"[^"]*"|'[^']*'|\{[^}]*\})*?)(\/?)>/g;
  let m;
  while ((m = re.exec(body))) {
    const [, close, tag, attrs, self] = m;
    const t = tag.toLowerCase();
    if (close) {
      const i = stack.map((s) => s.t).lastIndexOf(t);
      if (i >= 0) stack.length = i;
      continue;
    }
    const cls = (attrs.match(/class(?::list)?=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/) || []).slice(1).find(Boolean) ?? '';
    if (t === 'a' && STRETCH.test(cls)) {
      const line = body.slice(0, m.index).split('\n').length;
      const anc = [...stack].reverse().find((s) => POSITIONED.test(s.cls));
      if (!anc) errs.push({ line, msg: 'پیوند کشیده بی نیای positioned در این فایل' });
      else if (!CARD.has(anc.t)) errs.push({ line, msg: `نزدیک‌ترین نیای positioned <${anc.t}> است، نه کارت (<article>/<li>) — به کارت relative بدهید` });
    }
    if (!self && !VOID.has(t)) stack.push({ t, cls });
  }
  return errs;
}

if (process.argv.includes('--self-test')) {
  const bad = `<section class="relative"><div class="grid">{posts.map((p) => (\n<article class="bg-white flex">\n<h2><a href="/x/" class="before:absolute before:inset-0">x</a></h2></article>))}</div></section>`;
  const none = `<div><article class="flex"><a class="before:absolute before:inset-0">x</a></article></div>`;
  const good = `<section class="relative"><article class="flex relative">\n<img src="a" />\n<h2><a class="before:absolute before:inset-0">x</a></h2></article></section>`;
  const cases = [
    [checkStretched(bad).length === 1, 'کارت بی relative زیر section relative = خطا (همان باگ /blog/)'],
    [checkStretched(none).length === 1, 'بی هیچ نیای positioned = خطا'],
    [checkStretched(good).length === 0, 'article relative = سالم'],
  ];
  let f = 0;
  for (const [ok, msg] of cases) { console.log(`  ${ok ? '✓' : '✗'} ${msg}`); if (!ok) f++; }
  process.exit(f ? 1 : 0);
}

let failed = 0;
for (const file of globSync('src/**/*.astro')) {
  for (const e of checkStretched(readFileSync(file, 'utf8'))) {
    console.error(`❌ ${file} (~خط ${e.line} بدنه): ${e.msg}`);
    failed++;
  }
}
if (failed) process.exit(1);
console.log('✅ پیوندهای کشیده: هر کدام به کارت خودش محدود است.');
