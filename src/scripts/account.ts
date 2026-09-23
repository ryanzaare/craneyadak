// src/scripts/account.ts
// ---------------------------------------------------------------------------
// کلاینت حساب کاربری — سمت مرورگر، برای هدر و صفحات src/pages/account/*.
//
// سایت استاتیک است؛ وضعیت ورود فقط در مرورگر (localStorage) وجود دارد و
// هر درخواست با هدر X-Crane-Token به وردپرس می‌رود.
//
// ⚠️ چرا X-Crane-Token و نه Authorization: روی بسیاری از هاست‌های
// اشتراکی Apache هدر Authorization پیش از رسیدن به PHP حذف می‌شود. سرور
// هر دو را می‌خواند (class-customer-accounts.php)، ولی این هدر سفارشی آن
// ریسک را ندارد. هر هدر تازه‌ای که اینجا اضافه شود، باید در
// class-cors.php هم مجاز شود — scripts/check-cors-headers.mjs این را
// بررسی می‌کند. نبودنش یک بار حلقه‌ی «ورود ← حساب من ← ورود» ساخت.
//
// ⚠️ کلید TOKEN_KEY در اسکریپت‌های درون‌خطی login/register/reset هم
// تکرار شده (آن‌ها با define:vars ساخته شده‌اند و import ندارند). تغییرش
// یعنی تغییر در همه‌ی آن‌ها.
// ---------------------------------------------------------------------------

export const TOKEN_KEY = 'cy-account-token-v1';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): boolean {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* مرورگری که localStorage را بسته، از ابتدا توکنی نداشت. */
  }
}

/** آدرس وردپرس از data-wp-base روی صفحه — متغیر محیطی build به مرورگر نمی‌رسد. */
export function wpBase(): string | null {
  return document.querySelector<HTMLElement>('[data-wp-base]')?.dataset.wpBase || null;
}

export interface ApiResult<T = Record<string, any>> {
  ok: boolean;
  status: number;
  data: T;
  /**
   * درخواست اصلاً به سرور نرسید (شبکه، CORS، نبودِ wpBase).
   * ⚠️ این با «وارد نشده‌اید» یکی نیست. نسخه‌ی اول صفحه‌ی حساب هر دو را
   * «وارد نشده‌اید» نشان می‌داد، و خطای CORS را به یک حلقه‌ی ورود بی‌پایان
   * تبدیل کرد که کاربر هیچ راهی برای فهمیدنش نداشت.
   */
  network: boolean;
}

export async function api<T = Record<string, any>>(
  path: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown; auth?: boolean } = {},
): Promise<ApiResult<T>> {
  const base = wpBase();
  if (!base) return { ok: false, status: 0, data: {} as T, network: true };

  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth) {
    const token = getToken();
    if (token) headers['X-Crane-Token'] = token;
  }

  try {
    const res = await fetch(`${base}/wp-json/crane-yadak/v1${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const data = (await res.json().catch(() => ({}))) as T;
    // فقط ۴۰۱ یعنی نشست مرده. خطای ۵۰۰ کاربر را بیرون نمی‌اندازد.
    if (res.status === 401 && opts.auth) clearToken();
    return { ok: res.ok, status: res.status, data, network: false };
  } catch {
    return { ok: false, status: 0, data: {} as T, network: true };
  }
}

/**
 * صفحه‌ی محافظت‌شده بدون توکن → مستقیم به ورود، با بازگشت به همین صفحه.
 *
 * ⚠️ جایگزین کادر «برای دیدن این صفحه وارد شوید» شد: آن کادر یک دکمه‌ی
 * «ورود» داشت که کاربرِ تازه‌واردشده را — وقتی خطای شبکه با «وارد
 * نشده‌اید» یکی گرفته می‌شد — در حلقه نگه می‌داشت.
 */
export function requireLogin(): boolean {
  if (getToken()) return true;
  location.replace(`/account/login?next=${encodeURIComponent(location.pathname)}`);
  return false;
}

/**
 * ⚠️ خروج منتظر سرور نمی‌ماند. نسخه‌ی اول ابتدا درخواست خروج را await
 * می‌کرد و بعد توکن محلی را پاک می‌کرد — روی سرور کند یا در دسترس‌نبودن،
 * کاربر روی «خروج» می‌زد و چند ثانیه هیچ اتفاقی نمی‌افتاد (در آزمون
 * preview دیده شد). حالا: پاک‌کردن محلی فوری، ابطال سمت سرور در پس‌زمینه
 * با keepalive (تا با رفتن به صفحه‌ی بعد لغو نشود).
 */
export function logout(): void {
  const token = getToken();
  const base = wpBase();
  clearToken();
  if (token && base) {
    fetch(`${base}/wp-json/crane-yadak/v1/account/logout`, {
      method: 'POST',
      headers: { 'X-Crane-Token': token },
      keepalive: true,
    }).catch(() => {
      /* اگر نرسید، توکن سرور با انقضای خودش (۳۰ روز) می‌میرد. */
    });
  }
  location.href = '/account/login';
}

/** پیام خطای خوانا از پاسخ وردپرس (WP_Error → { message }). */
export function errorMessage(result: ApiResult, fallback: string): string {
  if (result.network) return 'ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید.';
  const msg = (result.data as { message?: unknown }).message;
  return typeof msg === 'string' && msg ? msg : fallback;
}
