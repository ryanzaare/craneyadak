// scripts/content/publish.test.mjs — بخشی از npm run test:content
// fetch ساختگی؛ هر قاعده روی پاسخ خراب هم آزموده می‌شود (قاعده‌ی ۶).
import { publishDoc, authHeader, restBase } from './publish.mjs';

let failed = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed++;
};
const rejects = async (p, re, msg) => {
  try {
    await p;
    ok(false, `${msg} (خطا نداد)`);
  } catch (e) {
    ok(re.test(e.message), `${msg}${re.test(e.message) ? '' : ` → ${e.message}`}`);
  }
};

const doc = { assets: [
  { file: 'images/a.jpg', abs: '/x/images/a.jpg', alt: 'الف', role: 'gallery' },
  { file: 'images/a.jpg', abs: '/x/images/a.jpg', alt: 'الف', role: 'inline' },
  { file: 'images/b.jpg', abs: '/x/images/b.jpg', alt: 'ب', role: 'inline' },
] };
const payload = { _source: 'x', _assets: [], products: { p: { blocks: [{ type: 'text', body: '<img src="{{asset:images/a.jpg}}"><img src="{{asset:images/b.jpg}}">' }] } } };
const read = () => Buffer.from('img');

/** سرور ساختگی: وضعیت هر نام از statuses؛ همه‌ی درخواست‌ها ثبت می‌شوند. */
function server(statuses, { importStatus = 200 } = {}) {
  const calls = [];
  let id = 100;
  const fetch = async (url, init) => {
    calls.push({ url, init });
    const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
    if (url.endsWith('/content/media')) {
      const files = JSON.parse(init.body).files;
      return reply(200, { files: files.filter((x) => x.name in statuses).map((x) => ({ name: x.name, status: statuses[x.name], url: statuses[x.name]?.startsWith('exists') ? `https://wp/${x.name}` : null })) });
    }
    if (url.endsWith('/wp/v2/media')) return reply(201, { id: ++id, source_url: `https://wp/up-${id}.jpg` });
    if (url.endsWith('/content/media-meta')) return reply(200, { url: `https://wp/meta-${JSON.parse(init.body).id}.jpg` });
    if (url.endsWith('/content/import')) return reply(importStatus, importStatus < 400 ? { ok: true, sent: JSON.parse(init.body) } : { message: 'دسترسی ندارید' });
    return reply(404, {});
  };
  return { fetch, calls };
}
const base = 'https://admin.example/wp-json';

console.log('── انتشار');
ok(authHeader('u', 'abcd efgh') === `Basic ${Buffer.from('u:abcdefgh').toString('base64')}`, 'رمز برنامه با فاصله پذیرفته و فاصله‌ها حذف می‌شود');
ok(restBase('https://admin.craneyadak.com/graphql') === 'https://admin.craneyadak.com/wp-json', 'ریشه‌ی REST از نشانی graphql');

{
  const s = server({ 'a.jpg': 'exists', 'b.jpg': 'missing' });
  const r = await publishDoc(doc, payload, { fetch: s.fetch, base, auth: 'Basic x', read });
  ok(!s.calls.some((c) => c.url.endsWith('/wp/v2/media')), 'dry-run هیچ تصویری بارگذاری نمی‌کند');
  ok(r.sent.apply === false, 'dry-run با apply=false به سرور می‌رود');
  ok(JSON.parse(s.calls[0].init.body).files.length === 2, 'تصویر تکراری (گالری + متن) یک بار پرسیده می‌شود');
  ok(!('_source' in r.sent.payload) && !('_assets' in r.sent.payload), 'کلیدهای داخلی (_source، _assets) به سرور نمی‌روند');
}
{
  const s = server({ 'a.jpg': 'exists', 'b.jpg': 'missing' });
  const r = await publishDoc(doc, payload, { fetch: s.fetch, base, auth: 'Basic x', read, apply: true });
  const ups = s.calls.filter((c) => c.url.endsWith('/wp/v2/media'));
  ok(ups.length === 1 && ups[0].init.headers['content-disposition'] === 'attachment; filename="b.jpg"', 'apply: فقط تصویر ناموجود بارگذاری می‌شود');
  const meta = JSON.parse(s.calls.find((c) => c.url.endsWith('/media-meta')).init.body);
  ok(/^[a-f0-9]{64}$/.test(meta.sha256) && meta.alt === 'ب', 'apply: اثر انگشت و alt پس از بارگذاری ثبت می‌شود');
  const body = r.sent.payload.products.p.blocks[0].body;
  ok(body === '<img src="https://wp/a.jpg"><img src="https://wp/meta-101.jpg">', 'نشانگرها با نشانی واقعی جایگزین شدند');
  ok(s.calls.every((c) => c.init.headers.authorization === 'Basic x'), 'هر درخواست احراز دارد');
}
await rejects(publishDoc(doc, payload, { fetch: server({ 'a.jpg': 'conflict', 'b.jpg': 'exists' }).fetch, base, auth: 'x', read, apply: true }), /محتوای دیگر/, 'هم‌نام با محتوای دیگر = توقف (نسخه‌ی تازه نام تازه)');
await rejects(publishDoc(doc, payload, { fetch: server({ 'a.jpg': 'exists', 'b.jpg': 'exists' }, { importStatus: 403 }).fetch, base, auth: 'x', read, apply: true }), /دسترسی ندارید.*403/, 'خطای سرور (۴۰۳) پیام سرور را می‌دهد، نه سکوت');
{
  const s = server({ 'a.jpg': 'exists' }); // سرور درباره‌ی b.jpg پاسخ نمی‌دهد
  await rejects(publishDoc(doc, payload, { fetch: s.fetch, base, auth: 'x', read, apply: true }), /پاسخ نداد/, 'تصویری که سرور درباره‌اش پاسخ نداد = توقف، نه بارگذاری دوباره');
  ok(!s.calls.some((c) => c.url.endsWith('/content/import') || c.url.endsWith('/wp/v2/media')), 'و نه بارگذاری، نه ورود');
}
await rejects(publishDoc(doc, payload, { fetch: server({ 'a.jpg': 'exists', 'b.jpg': 'weird' }).fetch, base, auth: 'x', read }), /پاسخ ناشناخته/, 'وضعیت ناشناخته = توقف');
{
  const s = server({ 'a.jpg': 'exists', 'b.jpg': 'exists' });
  const orphan = { ...payload, products: { p: { blocks: [{ type: 'text', body: '<img src="{{asset:images/zzz.jpg}}">' }] } } };
  await rejects(publishDoc(doc, orphan, { fetch: s.fetch, base, auth: 'x', read, apply: true }), /نشانی این تصاویر پیدا نشد/, 'apply با نشانگر حل‌نشده = توقف (تصویر شکسته روی سایت نمی‌رود)');
  ok(!s.calls.some((c) => c.url.endsWith('/content/import')), 'و ورود اصلاً فراخوانده نمی‌شود');
}

{
  // dry-run با تصویر گالری تازه: سرور نباید آن را «در کتابخانه نیست» ببیند (باگ انتشار فرستنده/گیرنده‌ی L12).
  const gdoc = { assets: [{ file: 'images/new.jpg', abs: '/x/images/new.jpg', alt: 'تازه', role: 'gallery' }, { file: 'images/old.jpg', abs: '/x/images/old.jpg', alt: 'قدیم', role: 'gallery' }] };
  const gpay = { _source: 'x', _assets: [], products: { p: { _product: { gallery: [{ file: 'images/new.jpg', alt: 'تازه' }, { file: 'images/old.jpg', alt: 'قدیم' }] }, blocks: [] } } };
  const dry = await publishDoc(gdoc, gpay, { fetch: server({ 'new.jpg': 'missing', 'old.jpg': 'exists' }).fetch, base, auth: 'x', read });
  ok(JSON.stringify(dry.sent.payload.products.p._product.gallery) === JSON.stringify([{ file: 'images/old.jpg', alt: 'قدیم' }]), 'dry-run: تصویر گالری تازه به سرور نمی‌رود، تصویر موجود می‌رود');
  const wet = await publishDoc(gdoc, gpay, { fetch: server({ 'new.jpg': 'missing', 'old.jpg': 'exists' }).fetch, base, auth: 'x', read, apply: true });
  ok(wet.sent.payload.products.p._product.gallery.length === 2, 'apply: گالری کامل (تصویر تازه پیش از ورود بارگذاری شده)');
  ok(gpay.products.p._product.gallery.length === 2, 'payload ورودی دست نخورد (کپی، نه جهش)');
}

if (failed) {
  console.error(`\n❌ ${failed} مورد ناموفق`);
  process.exit(1);
}
console.log('\n✅ همه‌ی آزمون‌های انتشار گذشت.');
