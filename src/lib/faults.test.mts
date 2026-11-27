// src/lib/faults.test.mts — npm run test:faults (در check)
// یابنده‌ی خرابی از وردپرس (قاعده‌ی ۱۰). دو چیز: (۱) buildFaultGroups نشانه‌ی ناقص را کنار می‌گذارد — ورودی خراب
// عمداً (قاعده‌ی ۶)؛ (۲) داده‌ی ورود یک‌باره‌ی افزونه (fault-seed-v1.json) خودش سالم است — همان ۲۵ نشانه‌ای که به
// وردپرس می‌رود: منبع، بند، دسته‌ی موجود، راهنمای موجود.
import { buildFaultGroups, faultProblems, type Fault, type RawFault } from './fault-shape.ts';
import { existsSync, readFileSync } from 'node:fs';

const SLUGS = new Set([...readFileSync('src/data/taxonomy.generated.ts', 'utf8').matchAll(/slug: '([a-z0-9-]+)'/g)].map((m) => m[1]));
let failed = 0;
const t = (name: string, ok: boolean) => { console.log(`  ${ok ? '✓' : '✗'} ${name}`); if (!ok) failed++; };

console.log('── buildFaultGroups');
const ok: RawFault = { title: 'نشانه', menuOrder: 2, faultFields: { meaning: 'م', action: 'ا', category: 'remote-control', guide: '', sourceTitle: 'منبع', sourceUrl: 'https://x.org', sourceRef: '1' }, craneFaultGroups: { nodes: [{ slug: 'remote', name: 'ریموت', faultGroupFields: { order: 2 } }] } };
const first: RawFault = { ...ok, title: 'اول', menuOrder: 1 };
const other: RawFault = { ...ok, title: 'دیگر', craneFaultGroups: { nodes: [{ slug: 'rope', name: 'سیم‌بکسل', faultGroupFields: { order: 1 } }] } };
const bad: RawFault = { title: 'خراب', faultFields: { meaning: '', action: 'ا', category: 'no-such', guide: '/blog/x', sourceTitle: '', sourceUrl: 'ftp://x', sourceRef: '' }, craneFaultGroups: { nodes: [] } };
const r = buildFaultGroups([ok, bad, first, other], SLUGS);
t('گروه‌ها به ترتیب فیلد order (rope=1 پیش از remote=2)', r.groups.map((g) => g.id).join() === 'rope,remote');
t('نشانه‌ها به ترتیب menuOrder', r.groups[1].faults.map((f) => f.symptom).join() === 'اول,نشانه');
t('ورودی خراب کنار رفت و گزارش شد', r.rejected.length === 1 && r.groups.flatMap((g) => g.faults).every((f) => f.symptom !== 'خراب'));
const badF: Fault = { symptom: 'x', meaning: '', action: 'y', category: 'no-such', guide: '/blog/x', sourceTitle: '', sourceUrl: 'ftp://x', ref: '' };
t('faultProblems: ۵ مشکل ورودی خراب', faultProblems(badF, SLUGS).length === 5);

console.log('── داده‌ی ورود یک‌باره‌ی افزونه');
const seed = JSON.parse(readFileSync('wordpress-plugin/crane-yadak-headless/includes/data/fault-seed-v1.json', 'utf8'));
const all = seed.groups.flatMap((g: { faults: unknown[] }) => g.faults) as { symptom: string; meaning: string; action: string; category: string; guide: string; source_title: string; source_url: string; source_ref: string }[];
for (const f of all) {
  const p = faultProblems({ symptom: f.symptom, meaning: f.meaning, action: f.action, category: f.category, guide: f.guide || null, sourceTitle: f.source_title, sourceUrl: f.source_url, ref: f.source_ref }, SLUGS);
  if (f.guide && !existsSync(`content/articles/${f.guide.split('/')[2]}/index.md`) && !['calibration-brake-pad-demag', 'wire-rope-wear-signs'].includes(f.guide.split('/')[2])) p.push(`راهنمای ناموجود ${f.guide}`);
  t(`«${f.symptom.slice(0, 40)}…» ${p.length ? p.join('، ') : 'سالم'}`, p.length === 0);
}
t('نشانه‌ی تکراری نیست', new Set(all.map((f) => f.symptom)).size === all.length);

if (failed) { console.error(`\n❌ ${failed} مورد ناموفق`); process.exit(1); }
console.log('\n✅ یابنده‌ی خرابی: منطق و داده‌ی ورود یک‌باره سالم.');
