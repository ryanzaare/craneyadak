<?php
/**
 * CORS برای REST API و WPGraphQL.
 *
 * چرا این فایل لازم است؟ در معماری Headless، فرانت‌اند Astro روی یک دامنه
 * (مثلاً craneyadak.com) و بک‌اند وردپرس روی یک ساب‌دامین دیگر (مثلاً
 * cms.craneyadak.com) میزبانی می‌شود. بدون هدرهای CORS صریح، مرورگر کاربر
 * درخواست fetch از فرانت‌اند به این دو اندپوینت را به‌طور پیش‌فرض بلاک
 * می‌کند (خطای classic «has been blocked by CORS policy» در Console).
 *
 * نکته امنیتی مهم: به‌جای Access-Control-Allow-Origin: '*' (که هر دامنه‌ای
 * را مجاز می‌کند و برای اندپوینتی که فرم تماس را می‌پذیرد خطرناک است)،
 * فقط دامنه‌های صراحتاً مجاز (از option قابل تنظیم در پنل ادمین) پذیرفته
 * می‌شوند.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * لیست دامنه‌های مجاز برای CORS. مقدار پیش‌فرض شامل دامنه‌ی اصلی سایت و
 * لوکال‌هاست‌های رایج توسعه (Astro dev server) است. مدیر سایت می‌تواند از
 * تنظیمات «Crane Yadak» در پنل ادمین (class-admin-settings.php) این لیست
 * را ویرایش کند.
 */
function cyh_get_allowed_origins() {
	$default = [
		'https://craneyadak.com',
		'https://www.craneyadak.com',
		'http://localhost:4321', // Astro dev server پیش‌فرض
	];

	$configured = get_option( 'cyh_allowed_origins', '' );

	if ( empty( $configured ) ) {
		return $default;
	}

	$lines = array_filter( array_map( 'trim', explode( "\n", $configured ) ) );

	return ! empty( $lines ) ? $lines : $default;
}

function cyh_send_cors_headers() {
	$origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_ORIGIN'] ) ) : '';

	if ( $origin && in_array( $origin, cyh_get_allowed_origins(), true ) ) {
		header( 'Access-Control-Allow-Origin: ' . $origin );
		header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
		/* ⚠️ هر هدری که فرانت‌اند می‌فرستد باید اینجا باشد، وگرنه مرورگر
		   preflight را رد می‌کند و fetch بی‌صدا شکست می‌خورد. نبودِ
		   X-Crane-Token (توکن حساب کاربری) یک حلقه‌ی «ورود ← حساب من ←
		   ورود» ساخت. scripts/check-cors-headers.mjs این سطر را با
		   fetchهای src/ مقایسه می‌کند — این سطر را به شکل رشته‌ی ادبی
		   نگه دارید تا آن بررسی بتواند بخواندش. */
		header( 'Access-Control-Allow-Headers: Content-Type, X-WP-Nonce, X-Crane-Token, Authorization' );
		header( 'Access-Control-Allow-Credentials: false' );
		header( 'Vary: Origin' );
	}
}

/**
 * CORS برای REST API — از فیلتر rest_pre_serve_request استفاده می‌کنیم که
 * دقیقاً برای این منظور در WordPress core طراحی شده (نه یک هوک عمومی‌تر که
 * ممکن است روی درخواست‌های غیر-REST هم اجرا شود و رفتار غیرمنتظره بسازد).
 */
add_filter(
	'rest_pre_serve_request',
	function ( $served ) {
		cyh_send_cors_headers();
		return $served;
	}
);

/**
 * پیش‌درخواست OPTIONS (Preflight) باید قبل از هر ولیدیشن دیگری با ۲۰۰
 * پاسخ داده شود، وگرنه مرورگر کل درخواست POST فرم تماس را لغو می‌کند.
 *
 * ⚠️ رفع باگ (یافته‌شده در بازبینی امنیتی): نسخه‌ی قبلی این هوک روی
 * request_method === OPTIONS بدون هیچ بررسی مسیری فعال می‌شد — یعنی
 * درخواست OPTIONS به *هر* آدرسی در کل سایت (نه فقط اندپوینت این پلاگین)
 * متوقف و کوتاه‌بسته می‌شد. این می‌توانست رفتار سایر افزونه‌ها/مسیرهای
 * REST دیگر (یا حتی خودِ /graphql) را که به OPTIONS تکیه می‌کنند، بدون
 * هیچ ارتباطی به این پلاگین مختل کند. اکنون فقط برای مسیرهای شناخته‌شده‌ی
 * خودِ ما (REST API زیر /wp-json/ و اندپوینت /graphql) فعال می‌شود.
 */
add_action(
	'init',
	function () {
		if ( ! isset( $_SERVER['REQUEST_METHOD'] ) || 'OPTIONS' !== $_SERVER['REQUEST_METHOD'] ) {
			return;
		}

		$request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
		$rest_prefix = trailingslashit( rest_get_url_prefix() ); // پیش‌فرض: 'wp-json/'

		$is_our_scope = ( false !== strpos( $request_uri, '/' . $rest_prefix ) ) || ( false !== strpos( $request_uri, '/graphql' ) );

		if ( ! $is_our_scope ) {
			return; // به سایر مسیرهای سایت (وردپرس اصلی، افزونه‌های دیگر) کاری نداریم.
		}

		cyh_send_cors_headers();
		status_header( 200 );
		exit;
	},
	0
);

/**
 * CORS برای WPGraphQL — این افزونه هدر Access-Control-Allow-Origin خودش را
 * ندارد مگر با این فیلتر رسمی که خودِ WPGraphQL برای این منظور ارائه می‌دهد.
 */
add_filter(
	'graphql_response_headers_to_send',
	function ( $headers ) {
		$origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_ORIGIN'] ) ) : '';

		if ( $origin && in_array( $origin, cyh_get_allowed_origins(), true ) ) {
			$headers['Access-Control-Allow-Origin'] = $origin;
			$headers['Vary']                        = 'Origin';
		}

		return $headers;
	}
);
