<?php
/**
 * هارنس تست محلی — نه بخشی از پلاگین، فقط برای اجرای واقعی کد PHP در این
 * سندباکس بدون نصب کامل وردپرس (که به‌دلیل محدودیت شبکه‌ی این محیط ممکن
 * نیست). هر تابع/کلاس وردپرسی که پلاگین به آن نیاز دارد را با یک نسخه‌ی
 * حداقلی stub می‌کند تا بتوانیم فایل‌های واقعی پلاگین را require کنیم و
 * مطمئن شویم هیچ فراخوانی تابع اشتباه/nonexisting یا خطای منطقی ساده‌ای
 * وجود ندارد — یک لایه‌ی تایید بسیار فراتر از صرفاً php -l (syntax check).
 */

define( 'ABSPATH', __DIR__ . '/' );
define( 'MINUTE_IN_SECONDS', 60 );

$GLOBALS['cyh_test_options']    = [];
$GLOBALS['cyh_test_actions']    = [];
$GLOBALS['cyh_test_filters']    = [];
$GLOBALS['cyh_test_post_types'] = [];
$GLOBALS['cyh_test_taxonomies'] = [];
$GLOBALS['cyh_test_routes']     = [];
$GLOBALS['cyh_test_posts']      = [];
$GLOBALS['cyh_test_transients'] = [];

function add_action( $hook, $cb, $priority = 10, $args = 1 ) {
	$GLOBALS['cyh_test_actions'][ $hook ][] = $cb;
}
function add_filter( $hook, $cb, $priority = 10, $args = 1 ) {
	$GLOBALS['cyh_test_filters'][ $hook ][] = $cb;
}
function do_action( $hook, ...$args ) {
	foreach ( $GLOBALS['cyh_test_actions'][ $hook ] ?? [] as $cb ) {
		call_user_func_array( $cb, $args );
	}
}
function apply_filters( $hook, $value, ...$args ) {
	foreach ( $GLOBALS['cyh_test_filters'][ $hook ] ?? [] as $cb ) {
		$value = call_user_func_array( $cb, array_merge( [ $value ], $args ) );
	}
	return $value;
}
function register_post_type( $slug, $args ) {
	if ( ! is_string( $slug ) || empty( $args['labels']['name'] ) ) {
		throw new Exception( "register_post_type($slug): invalid args" );
	}
	$GLOBALS['cyh_test_post_types'][ $slug ] = $args;
	return (object) [ 'name' => $slug ];
}
function register_taxonomy( $slug, $obj_type, $args ) {
	if ( empty( $args['labels']['name'] ) ) {
		throw new Exception( "register_taxonomy($slug): invalid args" );
	}
	$GLOBALS['cyh_test_taxonomies'][ $slug ] = $args;
}
function register_rest_route( $namespace, $route, $args ) {
	if ( ! is_callable( $args['callback'] ) && ! function_exists( $args['callback'] ) ) {
		throw new Exception( "register_rest_route($namespace$route): callback not callable" );
	}
	$GLOBALS['cyh_test_routes'][ $namespace . $route ] = $args;
}
function register_activation_hook( $file, $cb ) {}
function register_deactivation_hook( $file, $cb ) {}
function plugin_dir_path( $file ) { return dirname( $file ) . '/'; }
function plugin_dir_url( $file ) { return 'https://cms.example.com/wp-content/plugins/crane-yadak-headless/'; }
function flush_rewrite_rules() {}
function esc_html( $s ) { return htmlspecialchars( (string) $s ); }
function esc_attr( $s ) { return htmlspecialchars( (string) $s ); }
function esc_url_raw( $s ) { return filter_var( $s, FILTER_SANITIZE_URL ); }
function esc_textarea( $s ) { return htmlspecialchars( (string) $s ); }
function sanitize_text_field( $s ) { return trim( strip_tags( (string) $s ) ); }
function sanitize_textarea_field( $s ) { return trim( strip_tags( (string) $s ) ); }
function sanitize_email( $s ) { return filter_var( $s, FILTER_SANITIZE_EMAIL ); }
function wp_unslash( $s ) { return $s; }
function get_option( $key, $default = false ) { return $GLOBALS['cyh_test_options'][ $key ] ?? $default; }
function update_option( $key, $value ) { $GLOBALS['cyh_test_options'][ $key ] = $value; return true; }
function delete_option( $key ) { unset( $GLOBALS['cyh_test_options'][ $key ] ); return true; }
function add_options_page( ...$args ) {}
function register_setting( ...$args ) {}
function settings_fields( $group ) {}
function submit_button( $label = '' ) { echo $label; }
function current_user_can( $cap ) { return true; }
function admin_url( $path = '' ) { return 'https://cms.example.com/wp-admin/' . $path; }
function status_header( $code ) {}
function get_transient( $key ) { return $GLOBALS['cyh_test_transients'][ $key ] ?? false; }
function set_transient( $key, $value, $expiration ) { $GLOBALS['cyh_test_transients'][ $key ] = $value; return true; }
function delete_transient( $key ) { unset( $GLOBALS['cyh_test_transients'][ $key ] ); return true; }
function wp_insert_post( $args ) {
	if ( empty( $args['post_type'] ) ) {
		throw new Exception( 'wp_insert_post: missing post_type' );
	}
	$id                                = count( $GLOBALS['cyh_test_posts'] ) + 1;
	$GLOBALS['cyh_test_posts'][ $id ] = $args;
	return $id;
}
function is_wp_error( $thing ) { return $thing instanceof WP_Error; }
function wp_mail( $to, $subject, $body ) { return true; }
function get_post_type( $id ) { return $GLOBALS['cyh_test_posts'][ $id ]['post_type'] ?? false; }
function wp_get_upload_dir() { return [ 'baseurl' => 'https://cms.example.com/wp-content/uploads', 'basedir' => '/tmp/uploads' ]; }
function function_exists_acf_stub() { return false; }
function rest_ensure_response( $data ) { return $data; }
function current_time( $type = 'mysql' ) { return '2026-08-06 12:00:00'; }
function checked( $checked, $current = true, $echo = true ) { $r = ( (string) $checked === (string) $current ) ? ' checked="checked"' : ''; if ( $echo ) echo $r; return $r; }
function wp_nonce_field( ...$args ) {}
function wp_verify_nonce( $nonce, $action = -1 ) { return true; }
function wp_is_post_autosave( $post_id ) { return $GLOBALS['cyh_test_is_autosave'][ $post_id ] ?? false; }
function wp_is_post_revision( $post_id ) { return $GLOBALS['cyh_test_is_revision'][ $post_id ] ?? false; }

$GLOBALS['cyh_test_cron_events'] = [];
function wp_next_scheduled( $hook ) { return $GLOBALS['cyh_test_cron_events'][ $hook ] ?? false; }
function wp_schedule_single_event( $timestamp, $hook ) { $GLOBALS['cyh_test_cron_events'][ $hook ] = $timestamp; return true; }
function wp_unschedule_event( $timestamp, $hook ) { unset( $GLOBALS['cyh_test_cron_events'][ $hook ] ); return true; }

$GLOBALS['cyh_test_remote_post_calls'] = [];
function wp_remote_post( $url, $args = [] ) {
	$GLOBALS['cyh_test_remote_post_calls'][] = [ 'url' => $url, 'args' => $args ];
	if ( ! filter_var( $url, FILTER_VALIDATE_URL ) ) {
		return new WP_Error( 'http_request_failed', 'آدرس نامعتبر' );
	}
	return [ 'response' => [ 'code' => 200 ] ]; // شبیه‌سازی موفقیت — این تابع در تست واقعاً به هیچ سروری وصل نمی‌شود
}

class WP_Post {
	public $post_type;
	public $post_status;
	public function __construct( $post_type, $post_status ) {
		$this->post_type   = $post_type;
		$this->post_status = $post_status;
	}
}

class WP_Error {
	public $code;
	public $message;
	public $data;
	public function __construct( $code = '', $message = '', $data = [] ) {
		$this->code    = $code;
		$this->message = $message;
		$this->data    = $data;
	}
}

class WP_REST_Request {
	private $params;
	public function __construct( $params ) {
		$this->params = $params;
	}
	public function get_param( $key ) {
		return $this->params[ $key ] ?? null;
	}
}

// --------------------------------------------------------------------
// اجرای واقعی فایل‌های پلاگین
// --------------------------------------------------------------------
$plugin_dir = __DIR__ . '/crane-yadak-headless/';

function acf_add_options_page( $args ) {
	if ( empty( $args['menu_slug'] ) ) {
		throw new Exception( 'acf_add_options_page: missing menu_slug' );
	}
	$GLOBALS['cyh_test_options_pages'][ $args['menu_slug'] ] = $args;
	return $args;
}

require $plugin_dir . 'includes/class-post-types.php';
require $plugin_dir . 'includes/class-cors.php';
require $plugin_dir . 'includes/class-rest-contact.php';
require $plugin_dir . 'includes/class-admin-settings.php';
require $plugin_dir . 'includes/class-options-page.php';
require $plugin_dir . 'includes/class-deploy-webhook.php';

// هوک init را واقعاً «اجرا» می‌کنیم تا register_post_type/register_taxonomy
// واقعاً فراخوانی شوند، نه فقط تعریف.
do_action( 'init' );
do_action( 'rest_api_init' );
do_action( 'admin_menu' );
do_action( 'admin_init' );
do_action( 'acf/init' );

$errors = [];

if ( empty( $GLOBALS['cyh_test_options_pages']['crane-site-settings'] ) ) {
	$errors[] = 'ACF Options Page ثبت نشد (crane-site-settings)';
}

// بررسی ۱: همه‌ی CPTهای مورد انتظار ثبت شده‌اند؟
$expected_cpts = [ 'product', 'brand', 'industry', 'datasheet', 'inquiry' ];
foreach ( $expected_cpts as $cpt ) {
	if ( ! isset( $GLOBALS['cyh_test_post_types'][ $cpt ] ) ) {
		$errors[] = "CPT ثبت نشد: $cpt";
	}
}

// بررسی ۲: تکسونومی crane_category ثبت شده؟
if ( ! isset( $GLOBALS['cyh_test_taxonomies']['crane_category'] ) ) {
	$errors[] = 'تکسونومی crane_category ثبت نشد';
}

// بررسی ۳: مسیر REST ثبت شده؟
if ( ! isset( $GLOBALS['cyh_test_routes']['crane/v1/inquiry'] ) ) {
	$errors[] = 'مسیر REST crane/v1/inquiry ثبت نشد';
}

// بررسی ۴: فراخوانی واقعی هندلر REST با داده‌ی معتبر باید موفق باشد
$valid_request = new WP_REST_Request(
	[
		'name'    => 'مهندس رضایی',
		'phone'   => '09121234567',
		'company' => 'فولاد کویر',
		'sku'     => 'DMG-1024',
		'message' => 'نیاز به استعلام قیمت موتور گیربکس دارم.',
		'website' => '', // honeypot خالی = انسان واقعی
	]
);
$result = cyh_handle_contact_submission( $valid_request );
if ( is_wp_error( $result ) ) {
	$errors[] = 'درخواست معتبر رد شد: ' . $result->message;
} elseif ( empty( $result['success'] ) ) {
	$errors[] = 'درخواست معتبر success=true برنگرداند';
} else {
	echo "✓ درخواست معتبر با موفقیت پردازش شد (post_id ذخیره‌شده در inquiry CPT)\n";
}

// بررسی ۵: هانی‌پات باید ربات را بی‌سروصدا رد کند (بدون درج در دیتابیس)
$posts_before = count( $GLOBALS['cyh_test_posts'] );
$bot_request  = new WP_REST_Request(
	[
		'name'    => 'Bot',
		'phone'   => '09121234567',
		'message' => 'spam message',
		'website' => 'http://spam.example.com', // هانی‌پات پر شده
	]
);
$bot_result = cyh_handle_contact_submission( $bot_request );
if ( is_wp_error( $bot_result ) ) {
	$errors[] = 'هانی‌پات باید پاسخ موفق جعلی برگرداند نه خطا';
}
if ( count( $GLOBALS['cyh_test_posts'] ) !== $posts_before ) {
	$errors[] = 'درخواست هانی‌پات نباید در دیتابیس ذخیره شود';
} else {
	echo "✓ هانی‌پات به‌درستی ربات را رد کرد بدون ذخیره در دیتابیس\n";
}

// بررسی ۶: شماره موبایل نامعتبر باید رد شود
$invalid_phone_request = new WP_REST_Request(
	[
		'name'    => 'تست',
		'phone'   => '12345',
		'message' => 'پیام تست معتبر',
		'website' => '',
	]
);
$invalid_result = cyh_handle_contact_submission( $invalid_phone_request );
if ( ! is_wp_error( $invalid_result ) ) {
	$errors[] = 'شماره موبایل نامعتبر باید رد شود اما رد نشد';
} else {
	echo "✓ شماره موبایل نامعتبر به‌درستی رد شد\n";
}

// بررسی ۷: rate limiting بعد از ۵ درخواست باید بلاک کند
for ( $i = 0; $i < 5; $i++ ) {
	cyh_handle_contact_submission( $valid_request );
}
$rate_limited_result = cyh_handle_contact_submission( $valid_request );
if ( ! is_wp_error( $rate_limited_result ) || 'cyh_rate_limited' !== $rate_limited_result->code ) {
	$errors[] = 'Rate limiting بعد از ۵+ درخواست فعال نشد';
} else {
	echo "✓ Rate limiting به‌درستی بعد از حد مجاز فعال شد\n";
}

// بررسی ۸ (تست رگرسیون رفع باگ): فیلد بیش از حد بلند باید رد شود
// نکته: قبل از این تست، Rate Limit مربوط به IP تستی را ریست می‌کنیم چون
// بررسی ۷ (بالا) عمداً همان bucket را تا سقف مصرف کرده — بدون این ریست،
// تست فعلی به‌جای بررسی «طول فیلد»، خطای «Rate Limited» می‌گرفت که یک
// false positive در خودِ تست است، نه باگی در پلاگین.
delete_transient( 'cyh_rl_' . md5( '0.0.0.0' ) );
$too_long_request = new WP_REST_Request(
	[
		'name'    => 'تست',
		'phone'   => '09121234567',
		'message' => str_repeat( 'الف', 6000 ), // بیش از سقف ۵۰۰۰ کاراکتری
		'website' => '',
	]
);
$too_long_result = cyh_handle_contact_submission( $too_long_request );
if ( ! is_wp_error( $too_long_result ) || 'cyh_field_too_long' !== $too_long_result->code ) {
	$errors[] = 'پیام بیش‌ازحد بلند باید رد شود اما رد نشد';
} else {
	echo "✓ پیام بیش‌ازحد بلند به‌درستی رد شد (رفع باگ حداکثر طول)\n";
}

// بررسی ۹ (تست رگرسیون رفع باگ امنیتی): جعل X-Forwarded-For نباید Rate
// Limiting را دور بزند وقتی cyh_trust_proxy_headers فعال نیست (پیش‌فرض)
delete_transient( 'cyh_rl_' . md5( '0.0.0.0' ) ); // ریست وضعیت از بررسی‌های قبلی
for ( $i = 0; $i < 5; $i++ ) {
	// هر بار یک IP جعلی متفاوت در هدر می‌فرستیم — اگر باگ برطرف نشده بود،
	// این باعث می‌شد سیستم هرگز محدود نشود.
	$_SERVER['HTTP_X_FORWARDED_FOR'] = '203.0.113.' . $i;
	cyh_handle_contact_submission( $valid_request );
}
$spoofed_result = cyh_handle_contact_submission( $valid_request );
unset( $_SERVER['HTTP_X_FORWARDED_FOR'] );
if ( ! is_wp_error( $spoofed_result ) || 'cyh_rate_limited' !== $spoofed_result->code ) {
	$errors[] = 'جعل X-Forwarded-For توانست Rate Limiting را دور بزند (باگ امنیتی رفع نشده)';
} else {
	echo "✓ جعل هدر X-Forwarded-For نتوانست Rate Limiting را دور بزند (رفع باگ امنیتی تایید شد)\n";
}

// بررسی ۱۰: CORS فقط دامنه‌ی مجاز را می‌پذیرد
$allowed = cyh_get_allowed_origins();
if ( ! in_array( 'https://craneyadak.com', $allowed, true ) ) {
	$errors[] = 'دامنه‌ی پیش‌فرض craneyadak.com در allowed origins نیست';
} else {
	echo "✓ لیست پیش‌فرض CORS شامل craneyadak.com است\n";
}

// بررسی ۱۱: وبهوک دیپلوی — اگر غیرفعال است، هیچ رویدادی نباید زمان‌بندی شود
update_option( 'cyh_deploy_hook_enabled', false );
update_option( 'cyh_deploy_hook_url', 'https://api.example.com/deploy-hook/abc123' );
$product_post = new WP_Post( 'product', 'publish' );
cyh_on_post_save( 101, $product_post );
if ( wp_next_scheduled( CYH_DEPLOY_CRON_HOOK ) ) {
	$errors[] = 'وبهوک غیرفعال است اما رویداد دیپلوی زمان‌بندی شد';
} else {
	echo "✓ وقتی Auto-Deploy غیرفعال است، هیچ دیپلویی زمان‌بندی نمی‌شود\n";
}

// بررسی ۱۲: با فعال‌بودن + URL معتبر، انتشار محصول باید دیپلوی را زمان‌بندی کند
update_option( 'cyh_deploy_hook_enabled', true );
cyh_on_post_save( 101, $product_post );
if ( ! wp_next_scheduled( CYH_DEPLOY_CRON_HOOK ) ) {
	$errors[] = 'انتشار محصول باید دیپلوی را زمان‌بندی کند اما نکرد';
} else {
	echo "✓ انتشار محصول به‌درستی یک رویداد دیپلوی زمان‌بندی کرد\n";
}

// بررسی ۱۳ (Debounce): ویرایش دوم پشت‌سرهم نباید رویداد دومی اضافه کند
$scheduled_before = wp_next_scheduled( CYH_DEPLOY_CRON_HOOK );
cyh_on_post_save( 101, $product_post );
$scheduled_after = wp_next_scheduled( CYH_DEPLOY_CRON_HOOK );
if ( $scheduled_before !== $scheduled_after ) {
	$errors[] = 'Debounce کار نمی‌کند — ویرایش دوم زمان دیپلوی را عوض کرد (باید فقط یک رویداد در صف بماند)';
} else {
	echo "✓ Debounce به‌درستی کار می‌کند — چند ویرایش پشت‌سرهم فقط یک دیپلوی نتیجه می‌دهد\n";
}

// بررسی ۱۴: پیش‌نویس (draft) نباید دیپلوی را فعال کند
$GLOBALS['cyh_test_cron_events'] = []; // ریست برای تست تمیز
$draft_post = new WP_Post( 'product', 'draft' );
cyh_on_post_save( 102, $draft_post );
if ( wp_next_scheduled( CYH_DEPLOY_CRON_HOOK ) ) {
	$errors[] = 'ذخیره‌ی پیش‌نویس (draft) نباید دیپلوی را فعال کند اما فعال کرد';
} else {
	echo "✓ ذخیره‌ی پیش‌نویس (draft) به‌درستی دیپلوی را فعال نکرد\n";
}

// بررسی ۱۵: CPT «inquiry» (لیدهای مشتری) نباید هرگز دیپلوی را فعال کند
$inquiry_post = new WP_Post( 'inquiry', 'publish' );
cyh_on_post_save( 103, $inquiry_post );
if ( wp_next_scheduled( CYH_DEPLOY_CRON_HOOK ) ) {
	$errors[] = 'ذخیره‌ی یک inquiry نباید دیپلوی را فعال کند اما فعال کرد';
} else {
	echo "✓ CPT «inquiry» به‌درستی از فعال‌سازی دیپلوی مستثنا است\n";
}

// بررسی ۱۶: اجرای واقعی وبهوک باید wp_remote_post را با URL درست فراخوانی کند
$GLOBALS['cyh_test_remote_post_calls'] = [];
cyh_execute_deploy_webhook();
if ( empty( $GLOBALS['cyh_test_remote_post_calls'] ) ) {
	$errors[] = 'cyh_execute_deploy_webhook هیچ درخواستی نفرستاد';
} elseif ( $GLOBALS['cyh_test_remote_post_calls'][0]['url'] !== 'https://api.example.com/deploy-hook/abc123' ) {
	$errors[] = 'وبهوک به آدرس اشتباهی فراخوانی شد';
} else {
	echo "✓ اجرای وبهوک به‌درستی به آدرس تنظیم‌شده POST می‌زند\n";
}

echo "\n----------------------------------------\n";
if ( empty( $errors ) ) {
	echo "✅ همه‌ی بررسی‌ها با موفقیت گذشت (بدون هیچ خطا).\n";
	exit( 0 );
} else {
	echo '❌ ' . count( $errors ) . " خطا پیدا شد:\n";
	foreach ( $errors as $e ) {
		echo " - $e\n";
	}
	exit( 1 );
}
