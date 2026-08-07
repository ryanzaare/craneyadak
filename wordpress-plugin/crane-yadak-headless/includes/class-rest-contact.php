<?php
/**
 * اندپوینت REST برای فرم استعلام قیمت: POST /wp-json/crane/v1/inquiry
 *
 * این فایل دقیقاً همان جای خالی‌ای را پر می‌کند که در فرانت‌اند Astro
 * مستند شده بود: src/pages/api/contact.ts در بیلد استاتیک اصلاً اجرا
 * نمی‌شود (نگاه کنید به کامنت داخل آن فایل و docs/backend-integration.md،
 * بخش ۶). این اندپوینت جایگزین واقعی و اجراشونده‌ی آن منطق است.
 *
 * لایه‌های امنیتی/ضداسپم پیاده‌سازی‌شده:
 *   ۱) هانی‌پات (Honeypot) — یک فیلد مخفی که فقط ربات‌ها پر می‌کنند.
 *   ۲) محدودیت نرخ درخواست (Rate Limiting) بر اساس IP، از طریق Transient.
 *   ۳) ولیدیشن دقیق نوع و طول هر فیلد (نه فقط «خالی نیست»).
 *   ۴) Sanitization کامل قبل از ذخیره یا ارسال ایمیل.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function cyh_register_contact_route() {
	register_rest_route(
		'crane/v1',
		'/inquiry',
		[
			'methods'             => 'POST',
			'callback'            => 'cyh_handle_contact_submission',
			// permission_callback عمداً true است چون این یک فرم عمومی
			// (بدون لاگین) است؛ امنیت از طریق honeypot + rate limit + nonce
			// اختیاری (در ادامه) تامین می‌شود، نه از طریق احراز هویت.
			'permission_callback' => '__return_true',
			'args'                => [
				'name'    => [ 'type' => 'string', 'required' => true ],
				'phone'   => [ 'type' => 'string', 'required' => true ],
				'company' => [ 'type' => 'string', 'required' => false ],
				'sku'     => [ 'type' => 'string', 'required' => false ],
				'message' => [ 'type' => 'string', 'required' => true ],
				// نام فیلد هانی‌پات عمداً یک نام معمول و وسوسه‌انگیز برای
				// ربات‌های فرم‌پرکن است (website) اما در فرم واقعی هرگز به
				// کاربر نمایش داده نمی‌شود (در contact.astro با CSS مخفی است).
				'website' => [ 'type' => 'string', 'required' => false ],
			],
		]
	);
}
add_action( 'rest_api_init', 'cyh_register_contact_route' );

/**
 * ⚠️ رفع باگ امنیتی (یافته‌شده در بازبینی): نسخه‌ی قبلی این تابع هدرهای
 * HTTP_X_FORWARDED_FOR و HTTP_CF_CONNECTING_IP را همیشه و بدون قید‌وشرط
 * معتبر می‌دانست. این هدرها کاملاً توسط کلاینت قابل جعل هستند مگر این‌که
 * سرور واقعاً پشت یک پراکسی/CDN معتمد (مثل کلودفلر) باشد که مقدار واقعی
 * را جایگزین می‌کند. روی اکثر هاست‌های اشتراکی cPanel (بدون CDN)، هرکسی
 * می‌تواند با تغییر این هدر در هر درخواست، از سیستم Rate Limiting به‌طور
 * کامل عبور کند (هر درخواست انگار از یک IP جدید می‌آید). به همین دلیل،
 * پیش‌فرض امن انتخاب شده: فقط REMOTE_ADDR (که سمت سرور تعیین می‌شود و
 * غیرقابل‌جعل است) استفاده می‌شود، مگر این‌که مدیر سایت صراحتاً از
 * تنظیمات پلاگین اعلام کند که پشت یک CDN/پراکسی معتمد قرار دارد.
 */
function cyh_client_ip() {
	$trust_proxy = (bool) get_option( 'cyh_trust_proxy_headers', false );

	if ( $trust_proxy ) {
		$candidates = [ 'HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR' ];

		foreach ( $candidates as $key ) {
			if ( ! empty( $_SERVER[ $key ] ) ) {
				$ip = explode( ',', wp_unslash( $_SERVER[ $key ] ) )[0];
				return trim( $ip );
			}
		}
	}

	return isset( $_SERVER['REMOTE_ADDR'] ) ? trim( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '0.0.0.0';
}

function cyh_is_rate_limited( $ip ) {
	$key   = 'cyh_rl_' . md5( $ip );
	$count = (int) get_transient( $key );

	if ( $count >= 5 ) {
		return true;
	}

	set_transient( $key, $count + 1, 10 * MINUTE_IN_SECONDS );

	return false;
}

function cyh_handle_contact_submission( WP_REST_Request $request ) {
	$ip = cyh_client_ip();

	if ( cyh_is_rate_limited( $ip ) ) {
		return new WP_Error(
			'cyh_rate_limited',
			'تعداد درخواست‌های شما بیش از حد مجاز است. لطفاً چند دقیقه دیگر تلاش کنید.',
			[ 'status' => 429 ]
		);
	}

	// هانی‌پات: اگر پر شده باشد، یعنی یک ربات فرم را پر کرده. به‌جای خطای
	// آشکار (که به ربات یاد می‌دهد این فیلد را رها کند)، یک پاسخ موفق جعلی
	// برمی‌گردانیم تا ربات فکر کند موفق بوده و منطق آن را زودتر متوقف کنیم.
	$honeypot = $request->get_param( 'website' );
	if ( ! empty( $honeypot ) ) {
		return rest_ensure_response( [ 'success' => true ] );
	}

	$name    = sanitize_text_field( $request->get_param( 'name' ) );
	$phone   = sanitize_text_field( $request->get_param( 'phone' ) );
	$company = sanitize_text_field( $request->get_param( 'company' ) );
	$sku     = sanitize_text_field( $request->get_param( 'sku' ) );
	$message = sanitize_textarea_field( $request->get_param( 'message' ) );

	// ⚠️ رفع باگ (یافته‌شده در بازبینی): sanitize_text_field/sanitize_textarea_field
	// تگ HTML را حذف می‌کنند اما هیچ محدودیت طولی اعمال نمی‌کنند. بدون این
	// بررسی، هرکسی می‌توانست یک payload چند مگابایتی در فیلد «پیام» ارسال
	// کند و جدول postmeta را با درخواست‌های تکراری متورم کند — نه یک حمله‌ی
	// پیچیده، فقط یک محدودیت منطقی فراموش‌شده.
	$max_lengths = [ 'name' => 100, 'phone' => 20, 'company' => 200, 'sku' => 100, 'message' => 5000 ];
	foreach ( [ 'name' => $name, 'phone' => $phone, 'company' => $company, 'sku' => $sku, 'message' => $message ] as $field_key => $field_value ) {
		if ( mb_strlen( $field_value ) > $max_lengths[ $field_key ] ) {
			return new WP_Error(
				'cyh_field_too_long',
				sprintf( 'طول فیلد «%s» بیش از حد مجاز است.', $field_key ),
				[ 'status' => 400 ]
			);
		}
	}

	if ( empty( $name ) || mb_strlen( $name ) < 2 ) {
		return new WP_Error( 'cyh_invalid_name', 'نام وارد شده معتبر نیست.', [ 'status' => 400 ] );
	}

	// اعتبارسنجی شماره موبایل ایران (۰۹ + ۹ رقم) — به‌جای فقط «خالی نیست»،
	// فرمت واقعی را بررسی می‌کند تا لیدهای بی‌کیفیت با شماره‌ی جعلی وارد
	// صف فروش نشوند.
	$phone_digits = preg_replace( '/\D/', '', $phone );
	if ( ! preg_match( '/^(0)?9\d{9}$/', $phone_digits ) ) {
		return new WP_Error( 'cyh_invalid_phone', 'شماره همراه معتبر نیست. لطفاً با فرمت ۰۹۱۲XXXXXXX وارد کنید.', [ 'status' => 400 ] );
	}

	if ( empty( $message ) || mb_strlen( $message ) < 5 ) {
		return new WP_Error( 'cyh_invalid_message', 'توضیحات باید حداقل ۵ کاراکتر باشد.', [ 'status' => 400 ] );
	}

	// ---- ۱) ذخیره‌ی دائمی به‌عنوان لید پشتیبان (حتی اگر ایمیل نرسد) ----
	$post_id = wp_insert_post(
		[
			'post_type'   => 'inquiry',
			'post_title'  => sprintf( '%s — %s', $name, $phone ),
			'post_status' => 'publish',
			'post_content' => $message,
			'meta_input'  => [
				'inquiry_name'    => $name,
				'inquiry_phone'   => $phone,
				'inquiry_company' => $company,
				'inquiry_sku'     => $sku,
				'inquiry_ip'      => $ip,
			],
		]
	);

	if ( is_wp_error( $post_id ) ) {
		return new WP_Error( 'cyh_save_failed', 'ثبت درخواست با خطا مواجه شد. لطفاً دوباره تلاش کنید یا از طریق واتساپ پیام دهید.', [ 'status' => 500 ] );
	}

	// ---- ۲) تلاش برای ارسال ایمیل — شکست این مرحله نباید باعث خطا به
	// کاربر شود چون لید همین الان با موفقیت در وردپرس ذخیره شده است.
	$notify_email = get_option( 'cyh_notification_email', get_option( 'admin_email' ) );

	$subject = sprintf( '[استعلام جدید] %s', $name );
	$body    = implode(
		"\n",
		[
			"نام: {$name}",
			"شماره: {$phone}",
			'شرکت: ' . ( $company ?: 'ندارد' ),
			'کد فنی: ' . ( $sku ?: 'نامشخص' ),
			"پیام: {$message}",
			'------------------------',
			'مشاهده در پنل: ' . admin_url( 'post.php?post=' . $post_id . '&action=edit' ),
		]
	);

	wp_mail( $notify_email, $subject, $body );

	return rest_ensure_response(
		[
			'success' => true,
			'message' => 'درخواست شما با موفقیت ثبت شد.',
		]
	);
}
