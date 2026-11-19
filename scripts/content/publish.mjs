// scripts/content/publish.mjs
// ---------------------------------------------------------------------------
// سیستم محتوا — مرحله‌ی ۳: سند کامپایل‌شده ← وردپرس (docs/content-system.md).
//
//   ۱. هر تصویر (گالری + داخل متن): اثر انگشت SHA-256 → POST /crane-yadak/v1/content/media
//        exists / exists-unverified ← نشانی موجود؛ missing ← بارگذاری با /wp/v2/media + media-meta (اثر انگشت و alt)؛
//        conflict (هم‌نام، محتوای دیگر) ← توقف: نسخه‌ی تازه = نام تازه (قاعده‌ی ۴).
//   ۲. نشانگرهای {{asset:…}} در بدنه‌ی بلوک‌ها ← نشانی واقعی وردپرس.
//   ۳. POST /crane-yadak/v1/content/import — پیش‌فرض dry-run؛ نوشتن فقط با apply.
//
// احراز: «رمز برنامه»ی وردپرس (Application Password) از متغیرهای محیطی WP_APP_USER / WP_APP_PASSWORD — در GitHub
// Secrets، هرگز در مخزن و هرگز در خروجی چاپ نمی‌شود. fetch تزریق‌پذیر است تا بدون شبکه آزموده شود.
// ---------------------------------------------------------------------------
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif' };

export function authHeader(user, pass) {
  // رمز برنامه‌ی وردپرس با فاصله نمایش داده می‌شود؛ با یا بی فاصله پذیرفته است.
  return `Basic ${Buffer.from(`${user}:${String(pass).replace(/\s+/g, '')}`).toString('base64')}`;
}

/** ریشه‌ی REST از نشانی سایت وردپرس. */
export function restBase(siteUrl) {
  return `${String(siteUrl).replace(/\/+$/, '').replace(/\/(graphql|wp-json)$/, '')}/wp-json`;
}

async function call(fetchImpl, url, init, label) {
  const res = await fetchImpl(url, init);
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* بدنه‌ی غیر JSON */
  }
  if (!res.ok) {
    const msg = body?.message ?? body?.code ?? `HTTP ${res.status}`;
    throw new Error(`${label}: ${msg} (${res.status})`);
  }
  return body;
}

/**
 * @param {object} doc     خروجی compileFile (assets با abs)
 * @param {object} payload خروجی build برای همان سند
 * @param {{ fetch: typeof fetch, base: string, auth: string, apply?: boolean, create?: boolean, force?: boolean, read?: (p:string)=>Buffer, log?: (s:string)=>void }} opt
 */
export async function publishDoc(doc, payload, opt) {
  const { fetch: f, base, auth, apply = false, create = false, force = false, log = () => {} } = opt;
  const read = opt.read ?? ((p) => readFileSync(p));
  const json = { 'content-type': 'application/json', authorization: auth };

  // ── ۱. تصاویر ── (یکتا بر اساس نام فایل؛ گالری و داخل متن ممکن است یک فایل را دوبار ارجاع دهند)
  const byName = new Map();
  for (const a of doc.assets) {
    const name = path.posix.basename(a.file);
    if (byName.has(name)) continue;
    const buf = read(a.abs);
    byName.set(name, { ...a, name, buf, sha256: createHash('sha256').update(buf).digest('hex') });
  }
  const urls = new Map();
  const pending = new Set(); // dry-run: تصاویری که apply بارگذاری خواهد کرد
  if (byName.size) {
    const lookup = await call(f, `${base}/crane-yadak/v1/content/media`, { method: 'POST', headers: json, body: JSON.stringify({ files: [...byName.values()].map(({ name, sha256 }) => ({ name, sha256 })) }) }, 'وضعیت تصاویر');
    const answered = new Set((lookup.files ?? []).map((r) => r.name));
    const silent = [...byName.keys()].filter((n) => !answered.has(n));
    if (silent.length) throw new Error(`سرور درباره‌ی این تصاویر پاسخ نداد: ${silent.join('، ')}`);
    for (const r of lookup.files ?? []) {
      const a = byName.get(r.name);
      // ⚠️ وضعیت ناشناخته (یا تصویری که سرور اصلاً درباره‌اش پاسخ نداد) «ناموجود» فرض نمی‌شود — آزمون نشان داد نسخه‌ی اول
      // در این حالت بی‌صدا دوباره بارگذاری می‌کرد.
      if (!['exists', 'exists-unverified', 'missing', 'conflict'].includes(r.status)) throw new Error(`پاسخ ناشناخته برای تصویر «${r.name}»: ${r.status}`);
      if (r.status === 'conflict') throw new Error(`تصویر «${r.name}» با همین نام ولی محتوای دیگر در وردپرس هست — نسخه‌ی تازه نام تازه می‌خواهد`);
      if (r.status === 'exists' || r.status === 'exists-unverified') {
        urls.set(r.name, r.url);
        log(`   🖼  ${r.name} — موجود${r.status === 'exists-unverified' ? ' (بارگذاری دستی، بی اثر انگشت)' : ''}`);
        continue;
      }
      if (!apply) {
        pending.add(r.name);
        log(`   🖼  ${r.name} — بارگذاری می‌شود`);
        continue;
      }
      const up = await call(f, `${base}/wp/v2/media`, {
        method: 'POST',
        headers: { authorization: auth, 'content-type': MIME[path.extname(r.name).toLowerCase()] ?? 'application/octet-stream', 'content-disposition': `attachment; filename="${r.name}"` },
        body: a.buf,
      }, `بارگذاری ${r.name}`);
      const meta = await call(f, `${base}/crane-yadak/v1/content/media-meta`, { method: 'POST', headers: json, body: JSON.stringify({ id: up.id, sha256: a.sha256, alt: a.alt }) }, `اثر انگشت ${r.name}`);
      urls.set(r.name, meta.url ?? up.source_url);
      log(`   🖼  ${r.name} — بارگذاری شد (#${up.id})`);
    }
  }

  // ── ۲. نشانگرها ──
  const resolved = JSON.parse(JSON.stringify(payload));
  const unresolved = new Set();
  const swap = (s) =>
    s.replace(/\{\{asset:([^}]+)\}\}/g, (m, file) => {
      const u = urls.get(path.posix.basename(file));
      if (!u) unresolved.add(file);
      return u ?? m;
    });
  for (const root of ['products', 'brands', 'categories', 'articles']) {
    for (const entity of Object.values(resolved[root] ?? {})) {
      for (const b of entity.blocks ?? []) {
        if (b.body) b.body = swap(b.body);
        if (b.aside) b.aside = swap(b.aside);
      }
    }
  }
  // ⚠️ در apply هیچ نشانگری نباید بماند — <img src="{{asset:…}}"> روی سایت یعنی تصویر شکسته.
  if (apply && unresolved.size) throw new Error(`نشانی این تصاویر پیدا نشد: ${[...unresolved].join('، ')}`);

  // ⚠️ dry-run و تصویر گالری تازه (۲۹ آبان ۱۴۰۵): dry-run تصویری بارگذاری نمی‌کند، پس سرور گالری محصول تازه را «در
  // کتابخانه نیست» رد می‌کرد و workflow پیش از apply می‌ایستاد — اولین محصول با عکس تازه (فرستنده و گیرنده‌ی L12)
  // هرگز منتشر نمی‌شد. در dry-run همان ردیف‌ها از گالری ارسالی برداشته و جدا گزارش می‌شوند؛ apply هرگز چنین نمی‌کند
  // (آنجا پیش از این مرحله بارگذاری شده‌اند و هر کمبودی خطای واقعی است).
  if (!apply && pending.size) {
    for (const entity of Object.values(resolved.products ?? {})) {
      const g = entity?._product?.gallery;
      if (!Array.isArray(g)) continue;
      const kept = g.filter((x) => !pending.has(path.posix.basename(typeof x === 'string' ? x : x.file ?? '')));
      if (kept.length !== g.length) log(`   🖼  گالری: ${g.length - kept.length} تصویر تازه در apply بارگذاری و پیوست می‌شود`);
      entity._product.gallery = kept;
    }
  }

  // ── ۳. ورود ──
  const { _source, _assets, ...body } = resolved;
  return call(f, `${base}/crane-yadak/v1/content/import`, { method: 'POST', headers: json, body: JSON.stringify({ payload: body, apply, create, force }) }, 'ورود محتوا');
}
