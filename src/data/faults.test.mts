// src/data/faults.test.mts — npm run test:faults (در check)
// قاعده‌ی ۲: هر نشانه منبع خواندنی، بند دقیق و دسته‌ی موجود دارد. ورودی خراب هم سنجیده می‌شود.
import { FAULT_GROUPS, FAULT_SOURCES, type Fault } from './faults.ts';
import { existsSync, readFileSync } from 'node:fs';
// taxonomy.ts بی پسوند import می‌کند و در Node خام اجرا نمی‌شود؛ اسلاگ‌ها از خروجی build خوانده می‌شوند.
const SLUGS = new Set([...readFileSync('src/data/taxonomy.generated.ts', 'utf8').matchAll(/slug: '([a-z0-9-]+)'/g)].map((m) => m[1]));

let failed = 0;
const t = (name: string, ok: boolean) => { console.log(`  ${ok ? '✓' : '✗'} ${name}`); if (!ok) failed++; };

export function faultProblems(f: Fault): string[] {
  const p: string[] = [];
  for (const k of ['symptom', 'meaning', 'action', 'ref'] as const) if (!f[k]?.trim()) p.push(`${k} خالی`);
  if (!FAULT_SOURCES[f.source]) p.push(`منبع ناشناخته ${f.source}`);
  if (!SLUGS.has(f.category)) p.push(`دسته‌ی ناموجود ${f.category}`);
  if (f.guide && !/^\/blog\/[a-z0-9-]+\/$/.test(f.guide)) p.push(`پیوند راهنما ${f.guide}`);
  else if (f.guide && !existsSync(`content/articles/${f.guide.split('/')[2]}/index.md`) && !['calibration-brake-pad-demag', 'wire-rope-wear-signs'].includes(f.guide.split('/')[2])) p.push(`راهنمای ناموجود ${f.guide}`);
  return p;
}

const all = FAULT_GROUPS.flatMap((g) => g.faults);
for (const f of all) {
  const p = faultProblems(f);
  t(`«${f.symptom.slice(0, 40)}…» ${p.length ? p.join('، ') : 'سالم'}`, p.length === 0);
}
t('نشانه‌ی تکراری نیست', new Set(all.map((f) => f.symptom)).size === all.length);
const bad: Fault = { symptom: 'x', meaning: '', action: 'y', category: 'no-such', source: 'nope' as never, ref: '', guide: '/blog/x' };
t('ورودی خراب: ۵ مشکل گرفته می‌شود', faultProblems(bad).length === 5);

if (failed) { console.error(`\n❌ ${failed} مورد ناموفق`); process.exit(1); }
console.log('\n✅ داده‌ی یابنده‌ی خرابی سالم است.');
