// src/lib/video-embed.test.mts — npm run test:video
// ورودی خراب شناخته‌شده عمداً هست (قاعده‌ی ۶): نشانی ناشناخته نباید iframe بگیرد.
import { parseVideoUrl, videoBlocksFirst } from './video-embed.ts';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  if (!ok) failed++;
};

console.log('── آپارات');
// نشانی واقعی که کارفرما در وردپرس گذاشت (۲۵ آبان ۱۴۰۵)
eq('لینک اشتراک /v/', parseVideoUrl('https://www.aparat.com/v/inl6nb2')?.embedUrl, 'https://www.aparat.com/video/video/embed/videohash/inl6nb2/vt/frame?autoplay=true');
eq('بدون www و با / پایانی', parseVideoUrl('https://aparat.com/v/inl6nb2/')?.id, 'inl6nb2');
eq('کد جاسازی', parseVideoUrl('https://www.aparat.com/video/video/embed/videohash/inl6nb2/vt/frame')?.id, 'inl6nb2');
eq('صفحه‌ی کانال آپارات ویدیو نیست', parseVideoUrl('https://www.aparat.com/craneyadak'), null);

console.log('── یوتیوب');
eq('watch?v=', parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.embedUrl, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0');
eq('youtu.be', parseVideoUrl('https://youtu.be/dQw4w9WgXcQ?t=3')?.id, 'dQw4w9WgXcQ');
eq('shorts', parseVideoUrl('https://youtube.com/shorts/dQw4w9WgXcQ')?.id, 'dQw4w9WgXcQ');
eq('شناسه‌ی کوتاه/خراب', parseVideoUrl('https://www.youtube.com/watch?v=abc'), null);

console.log('── نشانی‌های خراب');
eq('دامنه‌ی دلخواه iframe نمی‌گیرد', parseVideoUrl('https://evil.example/v/inl6nb2'), null);
eq('javascript:', parseVideoUrl('javascript:alert(1)'), null);
eq('دامنه‌ی شبیه آپارات', parseVideoUrl('https://aparat.com.evil.example/v/inl6nb2'), null);
eq('رشته‌ی خالی', parseVideoUrl(''), null);
eq('null', parseVideoUrl(null), null);

console.log('── ترتیب بلوک‌ها');
const b = (h: string, video = false) => ({ heading: h, media: video ? [{ kind: 'video', videoUrl: 'https://aparat.com/v/x' }] : [] });
eq('ویدیو اول، بقیه با همان ترتیب', videoBlocksFirst([b('a'), b('b'), b('v', true), b('c')]).map((x) => x.heading), ['v', 'a', 'b', 'c']);
eq('بلوک تصویری ویدیو حساب نمی‌شود', videoBlocksFirst([b('a'), { heading: 'img', media: [{ kind: 'image', videoUrl: null }] }]).map((x) => x.heading), ['a', 'img']);
eq('ویدیو بی‌نشانی ویدیو حساب نمی‌شود', videoBlocksFirst([b('a'), { heading: 'e', media: [{ kind: 'video', videoUrl: null }] }]).map((x) => x.heading), ['a', 'e']);

if (failed) {
  console.error(`\n❌ ${failed} مورد ناموفق`);
  process.exit(1);
}
console.log('\n✅ همه‌ی آزمون‌های ویدیو گذشت.');
