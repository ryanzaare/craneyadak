#!/usr/bin/env node
// scripts/diagnose-author.mjs
// ---------------------------------------------------------------------------
// چرا جعبه‌ی نویسنده روی صفحه نیست؟
//
// این پرسش سه جواب کاملاً متفاوت دارد و از روی صفحه نمی‌شود تشخیص داد
// کدام است:
//
//   ۱) کاربر در گراف‌کیوال **دیده نمی‌شود** — WPGraphQL کاربرِ بدون
//      نوشته‌ی منتشرشده را عمداً پنهان می‌کند (جلوگیری از شمارش کاربران).
//   ۲) کاربر دیده می‌شود ولی **نام نمایشی یا زندگی‌نامه خالی است**.
//   ۳) گروه ACF «پروفایل کارشناس» هنوز در اسکیما نیست.
//
// اجرا:  node scripts/diagnose-author.mjs
// ---------------------------------------------------------------------------

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

for (const line of existsSync(resolve(ROOT, '.env')) ? readFileSync(resolve(ROOT, '.env'), 'utf8').split('\n') : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}

const BASE = (process.env.WP_GRAPHQL_URL || '').replace(/\/+$/, '');
if (!BASE) { console.error('❌ WP_GRAPHQL_URL تنظیم نشده است.'); process.exit(1); }

const gql = async (query) => {
  const res = await fetch(`${BASE}/graphql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { first: 20 } }),
  });
  return res.json().catch(() => null);
};

const H = (s) => console.log(`\n═══ ${s} ${'═'.repeat(Math.max(0, 58 - s.length))}`);

// ── ۱. آیا اصلاً کاربری در گراف‌کیوال هست؟ ─────────────────────────────────
H('۱. کاربران قابل مشاهده در گراف‌کیوال');
const basic = await gql(`query { users(first: 20) { nodes { slug name description avatar(size:96){url} } } }`);

if (basic?.errors) {
  console.error('   ❌', basic.errors.map((e) => e.message).join(' | '));
  process.exit(1);
}

const users = basic?.data?.users?.nodes ?? [];
console.log(`   ${users.length} کاربر دیده شد.`);

if (users.length === 0) {
  console.log('\n   🔴 هیچ کاربری برنگشت. این تقریباً همیشه یک علت دارد:');
  console.log('      WPGraphQL کاربری را که هیچ نوشته‌ی *منتشرشده* ندارد پنهان می‌کند.');
  console.log('      راه‌حل: یک محصول یا نوشته را به نام همان کاربر منتشر کنید.');
  process.exit(1);
}

for (const u of users) {
  const bio = (u.description ?? '').trim();
  console.log(`\n   • ${u.name || '(بدون نام نمایشی)'}  [${u.slug}]`);
  console.log(`     ${u.name ? '✅' : '🔴'} نام نمایشی`);
  console.log(`     ${bio ? '✅' : '⬜'} زندگی‌نامه ${bio ? `(${bio.length} کاراکتر)` : '— خالی'}`);
  console.log(`     ${u.avatar?.url ? '✅' : '⬜'} تصویر`);
  if (bio && !bio.includes('—')) {
    console.log('     ⚠️  بدون «—»: اگر فیلد «عنوان شغلی» پر نشده باشد، عنوان به');
    console.log('        «کارشناس فنی» پیش‌فرض می‌افتد و کل این متن به‌عنوان بیوگرافی می‌آید.');
  }
}

// ── ۲. آیا گروه ACF پروفایل کارشناس در اسکیما هست؟ ────────────────────────
H('۲. گروه ACF «پروفایل کارشناس»');
const withAcf = await gql(`query {
  users(first: 20) { nodes { slug authorProfile { jobTitle yearsExperience profileUrl credentials { title } } } }
}`);

if (withAcf?.errors) {
  console.log('   ⬜ در اسکیما نیست:', withAcf.errors.map((e) => e.message).join(' | ').slice(0, 120));
  console.log('      افزونه‌ی کرین یدک ۱.۱۱.۰ نصب است؟ و «WPGraphQL for ACF» فعال؟');
  console.log('      سایت بدون این هم کار می‌کند — عنوان شغلی از زندگی‌نامه خوانده می‌شود.');
} else {
  console.log('   ✅ در اسکیما هست.');
  for (const u of withAcf.data.users.nodes) {
    const p = u.authorProfile ?? {};
    const creds = (p.credentials ?? []).map((c) => c.title).filter(Boolean);
    console.log(`   • ${u.slug}`);
    console.log(`     ${p.jobTitle ? '✅' : '⬜'} عنوان شغلی: ${p.jobTitle || '—'}`);
    console.log(`     ${creds.length ? '✅' : '⬜'} تخصص‌ها: ${creds.join('، ') || '—'}`);
    console.log(`     ${p.yearsExperience ? '✅' : '⬜'} سابقه: ${p.yearsExperience || '—'}`);
    if (p.profileUrl && /admin\.|\/wp-admin/i.test(p.profileUrl)) {
      console.log('     🔴 آدرس پروفایل به پنل مدیریت اشاره می‌کند — منتشر نمی‌شود.');
    }
  }
}

H('نتیجه');
const ready = users.some((u) => u.name && (u.description ?? '').trim());
console.log(ready
  ? '   ✅ دست‌کم یک نویسنده‌ی قابل نمایش وجود دارد. `npm run build` را بزنید.'
  : '   🔴 هنوز هیچ نویسنده‌ای نام و زندگی‌نامه‌ی کامل ندارد — جعبه رندر نمی‌شود.');
