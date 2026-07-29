// src/pages/api/contact.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, redirect }) => {
  // این کد دیتاهای فرم را می‌گیرد
  const data = await request.formData();
  const name = data.get('name');
  const phone = data.get('phone');
  const company = data.get('company');
  const sku = data.get('sku');
  const message = data.get('message');

  // ولیدیشن اولیه
  if (!name || !phone || !message) {
    return new Response(
      JSON.stringify({ error: 'لطفاً فیلدهای ضروری را پر کنید.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // --- در آینده: اتصال این بخش به پنل وردپرس یا سرویس ایمیل ---
  console.log('--- درخواست استعلام جدید ---');
  console.log(`نام: ${name}`);
  console.log(`شماره: ${phone}`);
  console.log(`شرکت: ${company || 'ندارد'}`);
  console.log(`کد فنی: ${sku || 'نامشخص'}`);
  console.log(`پیام: ${message}`);
  console.log('----------------------------');

  // پس از ثبت موفق، کاربر را به صفحه‌ی تشکر یا همان صفحه برمی‌گردانیم
  // برای سئوی بهتر می‌توانیم یک صفحه /thank-you بسازیم. فعلاً به صفحه اصلی ریدایرکت می‌کنیم.
  return redirect('/?status=success', 302);
};