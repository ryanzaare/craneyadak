// src/lib/faults.ts — یابنده‌ی خرابی از وردپرس (CPT cyh_fault + تاکسونومی cyh_fault_group، افزونه ۳.۳۳.۰)
// ---------------------------------------------------------------------------
// ⚠️ CLAUDE.md قاعده‌ی ۱۰ (کارفرما ۶ آذر ۱۴۰۵): وردپرس تنها منبع حقیقت محتواست. این داده تا ۷ آذر در
// src/data/faults.ts بود — حذف شد. کارفرما نشانه را در پنل «یابنده‌ی خرابی» می‌افزاید و با build بعدی منتشر می‌شود.
// ⚠️ کوئری جدا (نردبان کوئری): افزونه‌ی قدیمی‌تر نوع CraneFault را ندارد؛ آن‌وقت خطای build می‌دهیم، نه صفحه‌ی خالی —
// صفحه‌ای با H1 «۰ نشانه» بدتر از build شکسته است. (پیش از نصب ۳.۳۳.۰ این کد روی main نمی‌آید.)
// ---------------------------------------------------------------------------
import { wpQueryPublic } from './wp';
import { ALL_CATEGORIES } from '../data/taxonomy';
import { buildFaultGroups, type FaultGroup, type RawFault } from './fault-shape';
export type { Fault, FaultGroup } from './fault-shape';

const QUERY = /* GraphQL */ `
  query Faults($first: Int!) {
    craneFaults(first: $first, where: { status: PUBLISH }) {
      nodes {
        title
        menuOrder
        faultFields { meaning action category guide sourceTitle sourceUrl sourceRef }
        craneFaultGroups { nodes { slug name faultGroupFields { order } } }
      }
    }
  }
`;

let memo: Promise<FaultGroup[]> | null = null;

export function getFaultGroups(): Promise<FaultGroup[]> {
  return (memo ??= (async () => {
    const data = await wpQueryPublic<{ craneFaults?: { nodes?: RawFault[] } }>(QUERY, { first: 500 });
    const { groups, rejected } = buildFaultGroups(data?.craneFaults?.nodes ?? [], new Set(ALL_CATEGORIES.map((c) => c.slug)));
    if (rejected.length) console.warn(`\n⚠️ یابنده‌ی خرابی: ${rejected.length} نشانه منتشر نشد (قاعده‌ی ۲):\n  ${rejected.join('\n  ')}\n`);
    if (!groups.length) throw new Error('یابنده‌ی خرابی: هیچ نشانه‌ی معتبری در وردپرس نیست (افزونه‌ی ۳.۳۳.۰ نصب و ورود یک‌باره انجام شده؟)');
    return groups;
  })());
}
