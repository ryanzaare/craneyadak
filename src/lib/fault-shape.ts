// src/lib/fault-shape.ts — شکل و اعتبار داده‌ی یابنده‌ی خرابی از وردپرس (خالص، بی import؛ آزمون: faults.test.mts)
// ---------------------------------------------------------------------------
// ⚠️ قاعده‌ی ۲ (هرگز چیزی از خودت نساز): نشانه‌ی بی معنی/اقدام/منبع/بند، با دسته‌ی ناموجود، یا راهنمای بدشکل
// منتشر نمی‌شود — کنار می‌رود و build نامش را هشدار می‌دهد (نه شکستن کل build برای یک غلط تایپی کارفرما در پنل).
// ---------------------------------------------------------------------------
export interface Fault {
  symptom: string;
  meaning: string;
  action: string;
  category: string;
  guide: string | null;
  sourceTitle: string;
  sourceUrl: string;
  ref: string;
}
export interface FaultGroup {
  id: string;
  title: string;
  order: number;
  faults: Fault[];
}

export interface RawFault {
  title?: string | null;
  menuOrder?: number | null;
  faultFields?: { meaning?: string | null; action?: string | null; category?: string | null; guide?: string | null; sourceTitle?: string | null; sourceUrl?: string | null; sourceRef?: string | null } | null;
  craneFaultGroups?: { nodes?: { slug?: string | null; name?: string | null; faultGroupFields?: { order?: number | null } | null }[] | null } | null;
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function faultProblems(f: Fault, categorySlugs: ReadonlySet<string>): string[] {
  const p: string[] = [];
  if (!f.symptom) p.push('نشانه خالی');
  if (!f.meaning) p.push('معنی خالی');
  if (!f.action) p.push('اقدام خالی');
  if (!f.ref) p.push('بند منبع خالی');
  if (!f.sourceTitle || !/^https?:\/\//.test(f.sourceUrl)) p.push('منبع ناقص');
  if (!categorySlugs.has(f.category)) p.push(`دسته‌ی ناموجود «${f.category}»`);
  if (f.guide && !/^\/blog\/[a-z0-9-]+\/$/.test(f.guide)) p.push(`راهنمای بدشکل «${f.guide}»`);
  return p;
}

/** نوشته‌های cyh_fault ⇒ گروه‌های مرتب. نامعتبرها در `rejected` (برای هشدار build). */
export function buildFaultGroups(raw: RawFault[], categorySlugs: ReadonlySet<string>): { groups: FaultGroup[]; rejected: string[] } {
  const groups = new Map<string, FaultGroup & { orders: number[] }>();
  const rejected: string[] = [];
  for (const r of raw) {
    const ff = r.faultFields ?? {};
    const f: Fault = {
      symptom: s(r.title), meaning: s(ff.meaning), action: s(ff.action), category: s(ff.category),
      guide: s(ff.guide) || null, sourceTitle: s(ff.sourceTitle), sourceUrl: s(ff.sourceUrl), ref: s(ff.sourceRef),
    };
    const g = r.craneFaultGroups?.nodes?.[0];
    const problems = faultProblems(f, categorySlugs);
    if (!g?.slug) problems.push('بی گروه');
    if (problems.length) { rejected.push(`«${f.symptom || '؟'}»: ${problems.join('، ')}`); continue; }
    const key = s(g!.slug);
    const entry = groups.get(key) ?? { id: key, title: s(g!.name) || key, order: Number(g!.faultGroupFields?.order ?? 999), faults: [], orders: [] };
    entry.faults.push(f);
    entry.orders.push(Number(r.menuOrder ?? 0));
    groups.set(key, entry);
  }
  const out = [...groups.values()].map(({ orders, ...g }) => {
    const idx = g.faults.map((_, i) => i).sort((a, b) => orders[a] - orders[b] || a - b);
    return { ...g, faults: idx.map((i) => g.faults[i]) };
  });
  out.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'fa'));
  return { groups: out, rejected };
}
