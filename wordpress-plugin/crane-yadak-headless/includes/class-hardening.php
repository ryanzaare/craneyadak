<?php
/**
 * سخت‌سازی وردپرس headless — بستن درهایی که این سایت هیچ‌وقت از آن‌ها استفاده نمی‌کند.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * چرا این فایل وجود دارد (سنجیده روی admin.craneyadak.com، ۱۹ آبان ۱۴۰۵)
 * ═══════════════════════════════════════════════════════════════════════════
 * افزونه اندپوینت‌های *خودش* را از اول با honeypot و rate limit بسته بود، ولی
 * درهای پیش‌فرض خودِ وردپرس باز مانده بودند:
 *
 *   • `/wp-json/wp/v2/users` بدون ورود، نام کاربری مدیر را می‌داد (slug = نام ورود).
 *   • `/?author=1` به `/author/<نام ورود>/` ریدایرکت می‌شد — همان نشت، از راه دیگر.
 *   • `xmlrpc.php` فعال بود: رایج‌ترین مسیر حدس رمز انبوه (system.multicall) و
 *     تقویت حمله با pingback. سایت headless هیچ مصرف‌کننده‌ی XML-RPC ندارد.
 *   • صفحه‌ی ورود وردپرس هیچ سقفی برای تلاش ناموفق نداشت.
 *   • هر پاسخ PHP نسخه‌ی دقیق PHP را در `X-Powered-By` اعلام می‌کرد.
 *
 * ⚠️ آنچه این فایل *نمی‌بندد* و چرا:
 *   • GraphQL هنوز `users { slug }` را می‌دهد، چون build سایت نویسنده‌ی مقاله را با
 *     همین slug تطبیق می‌دهد (`src/lib/authors.ts`). پس نام کاربری راز نیست؛ سپر
 *     واقعی رمز قوی + سقف تلاش ورودِ همین فایل است. بستن REST و ?author= فقط
 *     اسکنرهای انبوه را کور می‌کند که دقیقاً همین دو مسیر را می‌زنند.
 *   • فهرست پوشه‌ی `/wp-content/uploads/` را سرور می‌دهد، نه PHP — از cPanel
 *     بسته می‌شود (Indexes ← No Indexing)، نه از افزونه.
 *
 * هر تابع خالص یا با ورودی صریح است تا در هارنس با ورودی خرابِ شناخته‌شده
 * آزموده شود (قاعده‌ی ۶).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** سقف تلاش ناموفق ورود از یک IP، و پنجره‌ی آن. */
define( 'CYH_LOGIN_MAX_FAILS', 10 );
define( 'CYH_LOGIN_WINDOW', 15 * MINUTE_IN_SECONDS );

/* ───────────────────────── ۱) XML-RPC ───────────────────────── */

add_filter( 'xmlrpc_enabled', '__return_false' );

/**
 * هیچ متدی، نه فقط متدهای نیازمند ورود: `xmlrpc_enabled` به‌تنهایی `pingback.ping`
 * و `system.multicall` را باز می‌گذارد.
 */
function cyh_hardening_no_xmlrpc_methods( $methods = [] ) {
	return [];
}
add_filter( 'xmlrpc_methods', 'cyh_hardening_no_xmlrpc_methods' );

function cyh_hardening_strip_pingback( $headers = [] ) {
	if ( is_array( $headers ) ) {
		unset( $headers['X-Pingback'] );
	}
	return $headers;
}
add_filter( 'wp_headers', 'cyh_hardening_strip_pingback' );

/* ───────────────── ۲) فهرست کاربران از REST، فقط برای کارکنان ───────────────── */

/**
 * ⚠️ معیار `edit_posts` است نه «وارد شده»: مشتری‌های سایت هم حساب وردپرس دارند و
 * نباید با ورود، فهرست نویسنده‌ها را بگیرند. ویرایشگر بلوک برای منوی «نویسنده»
 * همین مسیر را می‌خواهد و هر کسی که نوشته ویرایش می‌کند این توانایی را دارد.
 */
function cyh_hardening_rest_endpoints( $endpoints = [] ) {
	if ( ! is_array( $endpoints ) || current_user_can( 'edit_posts' ) ) {
		return $endpoints;
	}
	foreach ( array_keys( $endpoints ) as $route ) {
		if ( 0 === strpos( (string) $route, '/wp/v2/users' ) ) {
			unset( $endpoints[ $route ] );
		}
	}
	return $endpoints;
}
add_filter( 'rest_endpoints', 'cyh_hardening_rest_endpoints' );

/* ───────────────── ۳) شمارش نام کاربری از راه ?author=N ───────────────── */

/**
 * اولویت ۱: پیش از `redirect_canonical` (اولویت ۱۰) که همان ریدایرکتِ افشاگر را می‌سازد.
 * قالب وردپرس در این معماری اصلاً بازدیدکننده ندارد، پس ۴۰۴ هیچ صفحه‌ی واقعی را نمی‌بندد.
 */
function cyh_hardening_block_author_archive() {
	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- فقط وجود پارامتر سنجیده می‌شود.
	if ( ! is_author() && ! isset( $_GET['author'] ) ) {
		return;
	}
	if ( current_user_can( 'edit_posts' ) ) {
		return;
	}
	wp_die( 'Not found.', '', [ 'response' => 404 ] );
}
add_action( 'template_redirect', 'cyh_hardening_block_author_archive', 1 );

/* ───────────────────── ۴) سقف تلاش ناموفق ورود ───────────────────── */

function cyh_login_fail_key( $ip ) {
	return 'cyh_lf_' . md5( (string) $ip );
}

/**
 * ⚠️ هر شکست، پنجره را از نو شروع می‌کند (پنجره‌ی لغزان): تا وقتی حمله ادامه دارد
 * قفل می‌ماند. قفل فقط به IP است، نه به نام کاربری — وگرنه هر کسی می‌توانست با
 * ده رمز غلط، مدیر را از هر جای دنیا بیرون نگه دارد.
 */
function cyh_login_record_failure( $username = '', $error = null ) {
	$key = cyh_login_fail_key( cyh_client_ip() );
	set_transient( $key, (int) get_transient( $key ) + 1, CYH_LOGIN_WINDOW );
}
add_action( 'wp_login_failed', 'cyh_login_record_failure', 10, 2 );

function cyh_login_clear_failures( $user_login = '', $user = null ) {
	delete_transient( cyh_login_fail_key( cyh_client_ip() ) );
}
add_action( 'wp_login', 'cyh_login_clear_failures', 10, 2 );

/**
 * اولویت ۹۹: پس از بررسی رمز هسته (۲۰) — در حالت قفل، رمز *درست* هم رد می‌شود،
 * وگرنه سقف هیچ جلوی حدس‌زدن را نمی‌گرفت.
 *
 * ⚠️ نام کاربری خالی = بارگذاری ساده‌ی wp-login.php (هسته `wp_signon` را روی GET هم
 * صدا می‌زند). اگر آن‌جا خطا برگردد، صفحه‌ی ورود پیش از هر تلاشی پیام قفل نشان می‌دهد.
 */
function cyh_login_throttle( $user = null, $username = '', $password = '' ) {
	if ( '' === trim( (string) $username ) ) {
		return $user;
	}
	if ( (int) get_transient( cyh_login_fail_key( cyh_client_ip() ) ) >= CYH_LOGIN_MAX_FAILS ) {
		return new WP_Error(
			'cyh_login_locked',
			'تلاش ناموفق زیاد از این اتصال ثبت شد. ۱۵ دقیقه‌ی دیگر دوباره امتحان کنید.'
		);
	}
	return $user;
}
add_filter( 'authenticate', 'cyh_login_throttle', 99, 3 );

/* ───────────────────────── ۵) هدرهای پاسخ ───────────────────────── */

/**
 * HSTS فقط روی HTTPS (روی HTTP مرورگر نادیده‌اش می‌گیرد و فقط گمراه‌کننده است)،
 * شش‌ماهه و بدون includeSubDomains/preload — هم‌سو با dist/.htaccess سایت.
 */
function cyh_hardening_headers( $is_ssl = false ) {
	$headers = [
		'X-Content-Type-Options' => 'nosniff',
		'Referrer-Policy'        => 'strict-origin-when-cross-origin',
	];
	if ( $is_ssl ) {
		$headers['Strict-Transport-Security'] = 'max-age=15552000';
	}
	return $headers;
}

function cyh_hardening_send_headers() {
	if ( headers_sent() ) {
		return;
	}
	header_remove( 'X-Powered-By' );
	foreach ( cyh_hardening_headers( is_ssl() ) as $name => $value ) {
		header( $name . ': ' . $value );
	}
}
// init با اولویت ۰: برای REST، GraphQL، پنل و قالب یکسان اجرا می‌شود؛ `send_headers` فقط قالب را می‌بیند.
add_action( 'init', 'cyh_hardening_send_headers', 0 );
