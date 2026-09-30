<?php
/**
 * هارنس تست محلی — نه بخشی از پلاگین، فقط برای اجرای واقعی کد PHP در این
 * سندباکس بدون نصب کامل وردپرس (که به‌دلیل محدودیت شبکه‌ی این محیط ممکن
 * نیست). هر تابع/کلاس وردپرسی که پلاگین به آن نیاز دارد را با یک نسخه‌ی
 * حداقلی stub می‌کند تا بتوانیم فایل‌های واقعی پلاگین را require کنیم و
 * مطمئن شویم هیچ فراخوانی تابع اشتباه/nonexisting یا خطای منطقی ساده‌ای
 * وجود ندارد — یک لایه‌ی تایید بسیار فراتر از صرفاً php -l (syntax check).
 */

/* ⚠️ اخطار PHP = شکست.
 *
 * هارنس یک بار «✅ همه‌ی بررسی‌ها با موفقیت گذشت» چاپ کرد در حالی که
 * هم‌زمان هشت بار `Undefined variable $k×` می‌داد. یعنی سبز بودنش دروغ
 * بود: یک باگ واقعیِ درون‌یابی رشته وجود داشت و گزارش، آن را «موفق»
 * نامید.
 *
 * در وردپرس واقعی همان اخطار یا در لاگ دفن می‌شود یا وسط صفحه‌ی پنل
 * چاپ می‌شود. هیچ‌کدام قابل قبول نیست. اینجا هر notice/warning به
 * استثنا تبدیل می‌شود تا آزمون واقعاً بیفتد.
 */
set_error_handler( function ( $no, $msg, $file, $line ) {
	throw new ErrorException( "$msg  ← " . basename( $file ) . ":$line", 0, $no, $file, $line );
}, E_ALL );

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
	// ⚠️ اولویت واقعاً ذخیره می‌شود. ووکامرس `product` را با اولویت ۵ ثبت
	// می‌کند و ما با ۱۰ — اگر هارنس ترتیب را نادیده بگیرد، دقیقاً همان
	// تصادمی که می‌خواهیم اثبات کنیم حل شده، آزمایش نشده باقی می‌ماند.
	$GLOBALS['cyh_test_actions_pri'][ $hook ][ $priority ][] = $cb;
	$GLOBALS['cyh_test_actions'][ $hook ][] = $cb;
	// ⚠️ نسخه‌ی قبلی این هارنس $args را دور می‌ریخت. به همین دلیل هرگز
	// نمی‌توانست ناسازگاری امضای هوک را تشخیص بدهد — دقیقاً همان باگی که
	// نسخه‌ی ۱.۳.۰ افزونه را کشت. حالا ثبت می‌شود.
	$GLOBALS['cyh_test_hook_reg'][] = [ 'hook' => $hook, 'cb' => $cb, 'accepted' => (int) $args, 'kind' => 'action' ];
}
function add_filter( $hook, $cb, $priority = 10, $args = 1 ) {
	$GLOBALS['cyh_test_filters'][ $hook ][] = $cb;
	$GLOBALS['cyh_test_hook_reg'][] = [ 'hook' => $hook, 'cb' => $cb, 'accepted' => (int) $args, 'kind' => 'filter' ];
}
function do_action( $hook, ...$args ) {
	$buckets = $GLOBALS['cyh_test_actions_pri'][ $hook ] ?? [];
	ksort( $buckets, SORT_NUMERIC );
	foreach ( $buckets as $cbs ) {
		foreach ( $cbs as $cb ) {
			call_user_func_array( $cb, $args );
		}
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
	// هسته این فیلتر را اعمال می‌کند؛ بدون آن، تزریق تنظیمات گراف‌کیوال
	// روی محصول ووکامرس اصلاً آزمایش نمی‌شود.
	$args = apply_filters( 'register_post_type_args', $args, $slug );
	$GLOBALS['cyh_test_post_types'][ $slug ] = $args;
	return (object) [ 'name' => $slug ];
}
function register_taxonomy( $slug, $obj_type, $args ) {
	if ( empty( $args['labels']['name'] ) ) {
		throw new Exception( "register_taxonomy($slug): invalid args" );
	}
	$GLOBALS['cyh_test_taxonomies'][ $slug ] = $args;
	// ⚠️ $obj_type قبلاً دور ریخته می‌شد. بدون نگه‌داشتنش،
	// is_object_in_taxonomy() نمی‌توانست همان تصادم اولویت هوک را که این
	// پروژه دو بار سوزاند (تاکسونومی روی ۱۰، اتصال CPT روی ۵) آزمایش کند.
	$GLOBALS['cyh_test_tax_object_types'][ $slug ] = (array) $obj_type;
}
function is_object_in_taxonomy( $object_type, $taxonomy ) {
	return in_array( $object_type, $GLOBALS['cyh_test_tax_object_types'][ $taxonomy ] ?? [], true );
}
function register_rest_route( $namespace, $route, $args ) {
	// وردپرس واقعی هم یک endpoint می‌پذیرد و هم فهرستی از آن‌ها (GET و
	// POST روی یک مسیر). هر کدام باید کال‌بک معتبر داشته باشد.
	$endpoints = isset( $args['callback'] ) ? [ $args ] : $args;
	foreach ( $endpoints as $endpoint ) {
		$cb = $endpoint['callback'] ?? null;
		if ( ! is_callable( $cb ) ) {
			throw new Exception( "register_rest_route($namespace$route): callback not callable" );
		}
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
/* وردپرس: add_option اگر کلید باشد false برمی‌گرداند (INSERT یکتا) — قفل
   callback پرداخت (class-checkout.php) دقیقاً روی همین رفتار بنا شده. */
function add_option( $key, $value = '', $deprecated = '', $autoload = 'yes' ) {
	if ( array_key_exists( $key, $GLOBALS['cyh_test_options'] ?? [] ) ) {
		return false;
	}
	$GLOBALS['cyh_test_options'][ $key ] = $value;
	return true;
}
function untrailingslashit( $s ) { return rtrim( (string) $s, '/\\' ); }
function rest_url( $path = '' ) { return 'https://cms.example.com/wp-json/' . ltrim( (string) $path, '/' ); }
function add_options_page( ...$args ) {}
function register_setting( ...$args ) {}
function settings_fields( $group ) {}
function submit_button( $label = '' ) { echo $label; }
function current_user_can( $cap ) { return true; }
function is_admin() { return $GLOBALS['cyh_test_is_admin'] ?? false; }
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
$GLOBALS['cyh_test_mail_calls'] = [];
function wp_mail( $to, $subject, $body, $headers = '' ) {
	$GLOBALS['cyh_test_mail_calls'][] = [ 'to' => $to, 'subject' => $subject, 'body' => $body, 'headers' => $headers ];
	return true;
}
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
	/* پاسخ برنامه‌ریزی‌شده (آزمون زرین‌پال): هر فراخوانی یکی از صف برمی‌دارد.
	   WP_Error در صف = شبکه نرسید. */
	if ( ! empty( $GLOBALS['cyh_test_remote_queue'] ) ) {
		$next = array_shift( $GLOBALS['cyh_test_remote_queue'] );
		return $next instanceof WP_Error ? $next : [ 'response' => [ 'code' => 200 ], 'body' => wp_json_encode( $next ) ];
	}
	return [ 'response' => [ 'code' => 200 ] ]; // شبیه‌سازی موفقیت — این تابع در تست واقعاً به هیچ سروری وصل نمی‌شود
}
function wp_remote_retrieve_body( $res ) { return is_array( $res ) ? (string) ( $res['body'] ?? '' ) : ''; }

/* ⚠️ `$wpdb` اصلاً وجود نداشت. `cyh_unique_slug()` مستقیم
   `$wpdb->update()` صدا می‌زند و بدون این، اولین بار که اسلاگ تکراری
   اصلاح می‌شد، fatal می‌گرفتیم. */
class CYH_Test_Wpdb {
	public $posts = 'wp_posts';
	public $terms = 'wp_terms';
	public $prefix = 'wp_';
	public $last_query = '';
	public function update( $table, $data, $where ) {
		$GLOBALS['cyh_test_db_updates'][] = [ 'table' => $table, 'data' => $data, 'where' => $where ];
		return 1;
	}
	public function prepare( $q, ...$a ) { $this->last_query = $q; return $q; }
	public function get_var( $q = null ) { return null; }
	public function get_results( $q = null, $out = null ) { return []; }
	public function get_row( $q = null, $out = null ) { return null; }
}
$GLOBALS['wpdb'] = new CYH_Test_Wpdb();

class WP_Query {
	public $vars;
	public $main;
	public function __construct( $vars = [], $main = true ) {
		$this->vars = $vars;
		$this->main = $main;
	}
	public function is_main_query() { return $this->main; }
	public function get( $key, $default = '' ) { return $this->vars[ $key ] ?? $default; }
	public function set( $key, $value ) { $this->vars[ $key ] = $value; }
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
	/* ⚠️ این متد فقط روی *مسیر خطا* صدا زده می‌شود — دقیقاً مسیری که تست
	   کمتر از همه به آن می‌رسد. نبودش یعنی هر بار که وردپرس واقعاً خطا
	   برمی‌گرداند، به‌جای پیام خطا یک fatal می‌گرفتیم. */
	public function get_error_message() { return $this->message; }
	public function get_error_code() { return $this->code; }
	public function get_error_data() { return $this->data; }
}

// نقطه‌ی خروج هر endpoint REST. تا وقتی هارنس کال‌بک‌های REST را صدا
// نمی‌زد پنهان ماند — یعنی یک fatal خفته، نه یک باگ برطرف‌شده.
class WP_REST_Response {
	public $data;
	public $status;
	public function __construct( $data = null, $status = 200, $headers = [] ) {
		$this->data   = $data;
		$this->status = $status;
	}
	public function get_data() { return $this->data; }
	public function get_status() { return $this->status; }
	public $headers = [];
	public function header( $key, $value, $replace = true ) { $this->headers[ $key ] = $value; }
}

class WP_REST_Request {
	private $params;
	public function __construct( $params ) {
		$this->params = $params;
	}
	public function get_param( $key ) {
		return $this->params[ $key ] ?? null;
	}
	/* آپلود عکس در فرم استعلام از این می‌خواند. بدون آن، هر درخواست تماس
	   fatal می‌دهد — و چون هارنس تا قبل از افزودن آپلود این مسیر را صدا
	   نمی‌زد، نبودش تا امروز پنهان مانده بود. */
	public function get_file_params() {
		return $GLOBALS['cyh_test_files'] ?? [];
	}
	/* حساب کاربری از این برای Authorization: Bearer <token> می‌خواند.
	   تست‌ها آن را در $GLOBALS['cyh_test_headers'] می‌گذارند. */
	public function get_header( $name ) {
		$key = strtolower( (string) $name );
		return $GLOBALS['cyh_test_headers'][ $key ] ?? '';
	}
}

// --------------------------------------------------------------------
// اجرای واقعی فایل‌های پلاگین
// --------------------------------------------------------------------
$plugin_dir = __DIR__ . '/crane-yadak-headless/';

// ── ووکامرس: stub اختیاری ───────────────────────────────────────────────────
// با متغیر محیطی CYH_TEST_WOO=1 «فعال» می‌شود تا هر دو مسیر پل ووکامرس
// آزمایش شوند. بدون اجرای واقعی، تنها راه اثبات اینکه تصادم `product` حل
// شده همین است.
if ( getenv( 'CYH_TEST_WOO' ) === '1' ) {
	class WooCommerce {}

	// (mockهای قیمت/موجودی ووکامرس حذف شدند — فقط برای resolver ‌‌`craneCommerce`
	//  بودند و آن فیلد با کل پل ووکامرس پاک شد. mock برای کدی که وجود ندارد،
	//  فقط این توهم را می‌سازد که چیزی آزموده می‌شود.)

	// ووکامرس نوع محتوای `product` را خودش ثبت می‌کند — با اولویت ۵،
	// یعنی *پیش از* ثبت ما (اولویت ۱۰). همان ترتیب واقعی شبیه‌سازی می‌شود.
	add_action( 'init', function () {
		register_post_type( 'product', [
			'labels'   => [ 'name' => 'Products (WooCommerce)' ],
			'supports' => [ 'title', 'editor', 'thumbnail' ],
		] );
	}, 5 );
}

function register_taxonomy_for_object_type( $tax, $type ) {
	$GLOBALS['cyh_test_tax_attached'][] = $tax . ' -> ' . $type;
	return true;
}
function taxonomy_exists( $t ) { return isset( $GLOBALS['cyh_test_taxonomies'][ $t ] ); }
function post_type_exists( $t ) { return isset( $GLOBALS['cyh_test_post_types'][ $t ] ); }
function unregister_post_type( $t ) { unset( $GLOBALS['cyh_test_post_types'][ $t ] ); return true; }
function remove_menu_page( $slug ) { $GLOBALS['cyh_test_removed_menus'][] = $slug; return false; }
// ⚠️ `is_uploaded_file()` عمداً stub ندارد.
//
// این تابع **جزو هسته‌ی خود PHP** است، نه وردپرس. تعریف دوباره‌اش
// `Cannot redeclare function` می‌دهد و کل هارنس را پیش از اجرای هر
// آزمونی می‌کشد — یعنی همان اتفاقی که افتاد.
//
// درس: فهرست stubها باید فقط توابع *وردپرس* باشد. پیش از افزودن هر
// stub جدید، `php -r "var_dump(function_exists('نام'));"` را بزنید؛
// اگر true بود، آن تابع مال PHP است و نباید stub شود.
//
// پیامد: مسیر «آپلود فایل» در ابزار ورود محتوا با هارنس پوشش داده
// نمی‌شود (نسخه‌ی واقعی همیشه false برمی‌گرداند). مسیر «چسباندن در
// کادر متن» پوشش داده می‌شود، و بارگذاری فایل‌ها — که هدف اصلی این
// هارنس است — کاملاً آزموده می‌شود.
function wp_kses_post( $s ) { return $s; }
// (تعریف دوم `sanitize_textarea_field` حذف شد — نسخه‌ی خط ۸۵ نگه داشته شد،
//  چون مثل وردپرس واقعی تگ‌ها را هم strip می‌کند.)
function wp_count_posts( $type = 'post' ) { return (object) [ 'publish' => 0, 'draft' => 0 ]; }


// ═══════════════════════════════════════════════════════════════════════════
// stubهای افزوده‌شده — توابع پنل، ترم، متا و گراف‌کیوال
//
// ⚠️ چرا این بلوک وجود دارد: نسخه‌ی قبلی این هارنس فقط ۵۱ تابع را stub
// می‌کرد و روی add_submenu_page() با «Call to undefined function» می‌افتاد.
// یعنی ابزاری که قرار بود خطای مرگبار را بگیرد، خودش مرگبار می‌شد.
//
// این فهرست دستی حدس زده نشده: با استخراج *همه‌ی* فراخوانی‌های تابع از کل
// فایل‌های افزونه و کم کردن توابع داخلی PHP و توابع خود افزونه ساخته شده.
// ═══════════════════════════════════════════════════════════════════════════

// ⚠️ OBJECT/ARRAY_A ثابت‌های خود وردپرس‌اند و در امضای stubها به‌عنوان
// مقدار پیش‌فرض استفاده شده‌اند. در PHP 8 ثابت تعریف‌نشده «Error» است، نه
// notice — یعنی بدون این خط، خودِ هارنس fatal می‌شد.
if ( ! defined( 'OBJECT' ) )  { define( 'OBJECT', 'OBJECT' ); }
if ( ! defined( 'ARRAY_A' ) ) { define( 'ARRAY_A', 'ARRAY_A' ); }
if ( ! defined( 'ARRAY_N' ) ) { define( 'ARRAY_N', 'ARRAY_N' ); }
if ( ! defined( 'CYH_PLUGIN_DIR' ) ) { define( 'CYH_PLUGIN_DIR', __DIR__ . '/crane-yadak-headless/' ); }
if ( ! defined( 'CYH_PLUGIN_URL' ) ) { define( 'CYH_PLUGIN_URL', 'https://example.test/wp-content/plugins/crane-yadak-headless/' ); }
if ( ! defined( 'CYH_VERSION' ) )    { define( 'CYH_VERSION', 'harness' ); }
if ( ! defined( 'HOUR_IN_SECONDS' ) ) { define( 'HOUR_IN_SECONDS', 3600 ); }
if ( ! defined( 'DAY_IN_SECONDS' ) )  { define( 'DAY_IN_SECONDS', 86400 ); }

// ── پنل مدیریت ─────────────────────────────────────────────────────────────

// ⚠️ `add_menu_page` جا افتاده بود.
//
// کامنت بالای این بلوک ادعا می‌کرد فهرست stubها «حدس زده نشده» و از
// استخراج همه‌ی فراخوانی‌ها ساخته شده. آن ادعا درست نبود: منوی سطح‌بالای
// «دسته‌بندی قطعات» این تابع را صدا می‌زند و stub نداشت، و هارنس دقیقاً
// روی همان خط با «Call to undefined function» مرد.
//
// حالا `check-stub-coverage.php` همان استخراج را *واقعاً* و در هر اجرا
// انجام می‌دهد، به‌جای اینکه یک بار دستی انجام شده باشد و ادعا شود.
function add_menu_page( $page_title, $menu_title, $cap, $slug, $cb = null, $icon = '', $pos = null ) {
	if ( '' === (string) $slug ) { throw new Exception( 'add_menu_page: empty slug' ); }
	if ( $cb !== null && '' !== $cb && ! is_callable( $cb ) ) {
		throw new Exception( "add_menu_page($slug): callback «" . ( is_string( $cb ) ? $cb : 'closure' ) . "» تعریف نشده" );
	}
	$GLOBALS['cyh_test_menus'][ $slug ] = [ 'title' => $menu_title, 'cb' => $cb, 'pos' => $pos ];
	return $slug;
}

function add_management_page( $page_title, $menu_title, $cap, $slug, $cb = '' ) {
	$GLOBALS['cyh_test_menus'][] = [ 'parent' => 'tools.php', 'slug' => $slug, 'cb' => $cb ];
	return $slug;
}

function add_submenu_page( $parent, $page_title, $menu_title, $cap, $slug, $cb = null, $pos = null ) {
	if ( '' === (string) $slug ) { throw new Exception( 'add_submenu_page: empty slug' ); }
	if ( $cb !== null && ! is_callable( $cb ) ) {
		throw new Exception( "add_submenu_page($slug): callback «" . ( is_string( $cb ) ? $cb : 'closure' ) . "» تعریف نشده" );
	}
	$GLOBALS['cyh_test_submenus'][ $slug ] = [ 'parent' => $parent, 'title' => $menu_title, 'cb' => $cb ];
	return $slug;
}
function add_meta_box( $id, $title, $cb, $screen = null, $ctx = 'advanced', $pri = 'default', $args = null ) {
	if ( ! is_callable( $cb ) ) { throw new Exception( "add_meta_box($id): callback تعریف نشده" ); }
	$GLOBALS['cyh_test_metaboxes'][ $id ] = [ 'screen' => $screen, 'cb' => $cb ];
	return $id;
}
function wp_add_dashboard_widget( $id, $title, $cb, $control = null, $args = null, $context = 'normal', $priority = 'core' ) {
	if ( ! is_callable( $cb ) ) { throw new Exception( "wp_add_dashboard_widget($id): callback تعریف نشده" ); }
	$GLOBALS['cyh_test_dashboard_widgets'][ $id ] = [ 'title' => $title, 'cb' => $cb ];
}
function get_current_screen() { return (object) [ 'id' => $GLOBALS['cyh_test_screen'] ?? 'dashboard', 'base' => 'edit' ]; }
function check_admin_referer( $action = -1, $q = '_wpnonce' ) { return true; }
function wp_nonce_url( $url, $action = -1, $name = '_wpnonce' ) { return $url . ( str_contains( $url, '?' ) ? '&' : '?' ) . '_wpnonce=test'; }
function add_query_arg( ...$a ) {
	if ( is_array( $a[0] ) ) { $args = $a[0]; $url = $a[1] ?? ''; } else { $args = [ $a[0] => $a[1] ]; $url = $a[2] ?? ''; }
	return $url . ( str_contains( (string) $url, '?' ) ? '&' : '?' ) . http_build_query( $args );
}
function wp_safe_redirect( $url, $status = 302 ) { $GLOBALS['cyh_test_redirects'][] = $url; return true; }
// این دو با الگوی POST→redirect→GET در ابزار «ورود محتوا از فایل» لازم شدند.
// نبودشان، بارگذاری را نمی‌شکست (فقط داخل بدنه‌ی تابع صدا زده می‌شوند) —
// یعنی هارنس بی‌سروصدا کمتر از چیزی که فکر می‌کردیم پوشش می‌داد.
function get_current_user_id() { return 1; }
function sanitize_key( $key ) { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) ); }
function wp_die( $msg = '', $title = '', $args = [] ) { throw new Exception( 'wp_die: ' . ( is_string( $msg ) ? $msg : 'error' ) ); }
function selected( $a, $b = true, $echo = true ) { $r = ( (string) $a === (string) $b ) ? " selected='selected'" : ''; if ( $echo ) { echo $r; } return $r; }
function wp_enqueue_media( $args = [] ) { return true; }
function get_edit_post_link( $id = 0, $ctx = 'display' ) { return 'https://example.test/wp-admin/post.php?post=' . (int) $id . '&action=edit'; }
function get_post_type_object( $t ) { return isset( $GLOBALS['cyh_test_post_types'][ $t ] ) ? (object) [ 'name' => $t, 'label' => $t ] : null; }
function add_post_type_support( $t, $f ) { $GLOBALS['cyh_test_supports'][ $t ][] = $f; return true; }
function add_role( $r, $n, $caps = [] ) { $GLOBALS['cyh_test_roles'][ $r ] = $caps; return null; }
/* نقش کاربری. پیش‌تر یک stdClass برمی‌گشت که `add_cap()` نداشت — یعنی
   افزودن دسترسی «پاسخ به پرسش‌ها» در زمان فعال‌سازی افزونه fatal می‌داد. */
class CYH_Test_Role {
	public $name;
	public $capabilities = [];
	public function __construct( $name ) { $this->name = $name; }
	public function add_cap( $cap, $grant = true ) { $this->capabilities[ $cap ] = $grant; }
	public function remove_cap( $cap ) { unset( $this->capabilities[ $cap ] ); }
	public function has_cap( $cap ) { return ! empty( $this->capabilities[ $cap ] ); }
}
function get_role( $r ) {
	if ( ! isset( $GLOBALS['cyh_test_roles'][ $r ] ) ) { return null; }
	$GLOBALS['cyh_test_role_objects'][ $r ] ??= new CYH_Test_Role( $r );
	return $GLOBALS['cyh_test_role_objects'][ $r ];
}

// ── ترم و تاکسونومی ────────────────────────────────────────────────────────
function get_term( $t, $tax = '', $out = OBJECT ) { return $GLOBALS['cyh_test_terms'][ is_object( $t ) ? $t->term_id : $t ] ?? null; }
function get_term_by( $field, $value, $tax = '', $out = OBJECT ) {
	foreach ( $GLOBALS['cyh_test_terms'] ?? [] as $t ) { if ( ( $t->$field ?? null ) === $value ) { return $t; } }
	return false;
}
function get_terms( $args = [] ) { return array_values( $GLOBALS['cyh_test_terms'] ?? [] ); }
function get_the_terms( $post, $taxonomy ) {
	$id       = is_object( $post ) ? $post->ID : (int) $post;
	$assigned = $GLOBALS['cyh_test_object_terms'][ $id ][ $taxonomy ] ?? [];
	$out      = [];
	foreach ( (array) $assigned as $t ) {
		$out[] = is_object( $t ) ? $t : ( $GLOBALS['cyh_test_terms'][ $t ] ?? null );
	}
	$out = array_filter( $out );
	// مثل وردپرس واقعی: بدون ترم، false برمی‌گردد نه آرایه‌ی خالی.
	return $out ? array_values( $out ) : false;
}
function term_exists( $term, $tax = '', $parent = null ) {
	foreach ( $GLOBALS['cyh_test_terms'] ?? [] as $t ) { if ( $t->slug === $term || $t->name === $term ) { return [ 'term_id' => $t->term_id ]; } }
	return null;
}
function wp_insert_term( $name, $tax, $args = [] ) {
	$id = count( $GLOBALS['cyh_test_terms'] ?? [] ) + 100;
	$GLOBALS['cyh_test_terms'][ $id ] = (object) [
		'term_id' => $id, 'name' => $name, 'slug' => $args['slug'] ?? sanitize_title( $name ),
		'description' => $args['description'] ?? '', 'parent' => (int) ( $args['parent'] ?? 0 ), 'count' => 0,
	];
	return [ 'term_id' => $id, 'term_taxonomy_id' => $id ];
}
function wp_update_term( $id, $tax, $args = [] ) {
	if ( ! isset( $GLOBALS['cyh_test_terms'][ $id ] ) ) { return new WP_Error( 'missing', 'term not found' ); }
	foreach ( $args as $k => $v ) { $GLOBALS['cyh_test_terms'][ $id ]->$k = $v; }
	return [ 'term_id' => $id, 'term_taxonomy_id' => $id ];
}
function wp_set_object_terms( $obj, $terms, $tax, $append = false ) { $GLOBALS['cyh_test_object_terms'][ $obj ][ $tax ] = $terms; return (array) $terms; }
function sanitize_title( $t, $fallback = '', $ctx = 'save' ) {
	$t = strtolower( trim( (string) $t ) );
	$t = preg_replace( '/[^a-z0-9\-\_\s]/u', '', $t );   // غیرلاتین حذف می‌شود — دقیقاً مثل وردپرس
	$t = preg_replace( '/[\s\-]+/', '-', (string) $t );
	return trim( (string) $t, '-' );
}

// ── پست و متا ──────────────────────────────────────────────────────────────
/* ⚠️ شیء، نه آرایه — همان خانواده‌ی باگ get_posts (پایین‌تر). وردپرس
   واقعی WP_Post برمی‌گرداند؛ نسخه‌ی قبلی این stub آرایه‌ی خام برمی‌گرداند،
   پس هر `$post->post_type` در آزمون همیشه خالی بود و get_post_field هم
   همیشه '' می‌داد. تا ۷ مهر ۱۴۰۵ هیچ آزمونی به این مسیر نرسیده بود. */
function get_post( $p = null, $out = OBJECT ) {
	$id = is_object( $p ) ? (int) $p->ID : (int) $p;
	if ( ! isset( $GLOBALS['cyh_test_posts'][ $id ] ) ) {
		return null;
	}
	return (object) array_merge(
		[ 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => '', 'post_name' => '', 'post_author' => 0, 'post_content' => '' ],
		$GLOBALS['cyh_test_posts'][ $id ],
		[ 'ID' => $id ]
	);
}
/**
 * ⚠️ نسخه‌ی قبلی این stub همیشه *همه‌ی* نوشته‌ها را برمی‌گرداند، بدون
 * فیلتر — و همیشه به‌شکل آرایه‌ی خام (نه شیءِ WP_Post). هیچ‌کدام از
 * ۳۰ بررسیِ قبلی get_posts را واقعاً صدا نمی‌زدند، پس این خرابی سال‌ها
 * پنهان ماند تا اضافه‌شدن `/account/me` (که سفارش‌های کاربر را با
 * get_posts می‌خواند) به آن رسید: «Attempt to read property "ID" on
 * array» — همان کد واقعی (`class-quote-requests.php`،
 * `cyh_rest_quote_status`) هم دقیقاً همین‌طور `$post->ID` می‌خواند و
 * دقیقاً همین‌طور با آرایه‌ی خام می‌شکست؛ فقط تا امروز هیچ تستی به آن
 * مسیر نمی‌رسید.
 *
 * حالا: فیلتر واقعی (نوع، وضعیت، نویسنده، اسلاگ، متا) و شکل خروجی
 * وابسته به `fields` — درست مثل وردپرس واقعی: `fields => 'ids'` عدد
 * خام می‌دهد (class-media-keys.php این را می‌خواهد)، وگرنه شیء با
 * `->ID` (بقیه‌ی فراخوان‌ها این را می‌خواهند).
 */
function get_posts( $args = [] ) {
	$all      = $GLOBALS['cyh_test_posts'] ?? [];
	$types    = (array) ( $args['post_type'] ?? 'post' );
	$statuses = (array) ( $args['post_status'] ?? 'publish' );
	$author   = isset( $args['author'] ) ? (int) $args['author'] : null;
	$name     = $args['name'] ?? null;

	$matches = [];
	foreach ( $all as $id => $data ) {
		if ( ! in_array( $data['post_type'] ?? 'post', $types, true ) ) { continue; }
		if ( ! in_array( $data['post_status'] ?? 'publish', $statuses, true ) ) { continue; }
		if ( null !== $author && (int) ( $data['post_author'] ?? 0 ) !== $author ) { continue; }
		if ( null !== $name ) {
			$slug = $data['post_name'] ?? sanitize_title( $data['post_title'] ?? '' );
			if ( $slug !== $name ) { continue; }
		}
		if ( isset( $args['meta_key'] ) ) {
			$mval = $GLOBALS['cyh_test_meta'][ $id ][ $args['meta_key'] ] ?? null;
			if ( null === $mval ) { continue; }
			if ( isset( $args['meta_value'] ) && (string) $mval !== (string) $args['meta_value'] ) { continue; }
		}
		if ( isset( $args['meta_query'] ) && is_array( $args['meta_query'] ) ) {
			$ok = true;
			foreach ( $args['meta_query'] as $clause ) {
				if ( ! is_array( $clause ) || ! isset( $clause['key'] ) ) { continue; }
				$mval = $GLOBALS['cyh_test_meta'][ $id ][ $clause['key'] ] ?? null;
				if ( (string) $mval !== (string) ( $clause['value'] ?? '' ) ) { $ok = false; break; }
			}
			if ( ! $ok ) { continue; }
		}
		$matches[] = $id;
	}

	$limit = (int) ( $args['posts_per_page'] ?? $args['numberposts'] ?? 5 );
	if ( -1 !== $limit ) { $matches = array_slice( $matches, 0, $limit ); }

	if ( 'ids' === ( $args['fields'] ?? '' ) ) {
		return $matches;
	}

	return array_map(
		static function ( $id ) use ( $all ) {
			return (object) array_merge(
				[ 'post_type' => 'post', 'post_status' => 'publish', 'post_title' => '', 'post_name' => '', 'post_author' => 0 ],
				$all[ $id ],
				[ 'ID' => $id ]
			);
		},
		$matches
	);
}
function get_page_by_path( $path, $out = OBJECT, $type = 'page' ) { return null; }
function get_post_field( $f, $p = null, $ctx = 'display' ) { $post = get_post( $p ); return $post->$f ?? ''; }
function get_post_status( $post = null ) { $p = get_post( $post ); return $p->post_status ?? false; }
function get_the_title( $post = 0 ) { $p = get_post( $post ); return $p->post_title ?? ''; }
function get_post_meta( $id, $key = '', $single = false ) { $v = $GLOBALS['cyh_test_meta'][ $id ][ $key ] ?? ( $single ? '' : [] ); return $v; }
function update_post_meta( $id, $key, $val, $prev = '' ) { $GLOBALS['cyh_test_meta'][ $id ][ $key ] = $val; return true; }
function delete_post_meta( $id, $key, $val = '' ) { unset( $GLOBALS['cyh_test_meta'][ $id ][ $key ] ); return true; }
function register_post_meta( $object_type, $meta_key, $args = [] ) {
	if ( isset( $args['auth_callback'] ) && ! is_callable( $args['auth_callback'] ) ) {
		throw new Exception( "register_post_meta($object_type,$meta_key): auth_callback غیرقابل‌فراخوانی" );
	}
	$GLOBALS['cyh_test_registered_meta'][ $object_type ][ $meta_key ] = $args;
	return true;
}

/* ── متای ترم ───────────────────────────────────────────────────────────
   مهاجرت بلوک‌ها محتوای دسته را از متای *ترم* می‌خواند، نه نوشته. جدا
   نگه‌داشتنشان عمدی است: اگر هر دو در یک آرایه بریزند، شناسه‌ی ۱۲ نوشته
   و شناسه‌ی ۱۲ ترم روی هم می‌افتند و آزمون بی‌صدا دروغ می‌گوید. */
function get_term_meta( $id, $key = '', $single = false ) {
	return $GLOBALS['cyh_test_term_meta'][ $id ][ $key ] ?? ( $single ? '' : [] );
}
function update_term_meta( $id, $key, $val, $prev = '' ) {
	$GLOBALS['cyh_test_term_meta'][ $id ][ $key ] = $val;
	return true;
}

/* ── کاربر — حساب مشتری (ایست ۶) ───────────────────────────────────────
   ⚠️ این stubها عمداً *منطق* دارند، نه فقط امضا — دقیقاً همان دلیلی که
   بالای بخش «رسانه و آپلود» نوشته شده: نقطه‌ی ثبت‌نام/ورود بدون احراز
   هویتِ قبلی است و امنیتش کاملاً به همین منطق (یکتایی ایمیل، تطبیق رمز،
   انقضای توکن) وابسته است. اگر اینجا همیشه موفق برگردد، هارنس دقیقاً
   همان چیزی را که باید محافظت کند آزمایش نمی‌کند. */
$GLOBALS['cyh_test_users']      = [];
$GLOBALS['cyh_test_user_meta']  = [];
$GLOBALS['cyh_test_next_uid']   = 1;

class CYH_Test_WP_User {
	public $ID;
	public $user_login;
	public $user_email;
	public $user_pass;
	public $display_name;
	public $roles = [];
	public function __construct( $data ) {
		foreach ( $data as $k => $v ) { $this->$k = $v; }
	}
}

function wp_generate_password( $length = 12, $special_chars = true, $extra_special_chars = false ) {
	$chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	if ( $special_chars ) { $chars .= '!@#$%^&*()'; }
	$out = '';
	for ( $i = 0; $i < $length; $i++ ) { $out .= $chars[ random_int( 0, strlen( $chars ) - 1 ) ]; }
	return $out;
}

function email_exists( $email ) {
	foreach ( $GLOBALS['cyh_test_users'] as $u ) {
		if ( $u->user_email === $email ) { return $u->ID; }
	}
	return false;
}

function get_user_by( $field, $value ) {
	$attr = [ 'id' => 'ID', 'email' => 'user_email', 'login' => 'user_login' ][ $field ] ?? null;
	if ( ! $attr ) { return false; }
	foreach ( $GLOBALS['cyh_test_users'] as $u ) {
		if ( (string) $u->$attr === (string) $value ) { return $u; }
	}
	return false;
}

function get_userdata( $user_id ) {
	return get_user_by( 'id', $user_id );
}

function wp_insert_user( $data ) {
	$email = isset( $data['user_email'] ) ? trim( (string) $data['user_email'] ) : '';
	if ( '' === $email || ! is_email( $email ) ) {
		return new WP_Error( 'invalid_email', 'ایمیل نامعتبر است.' );
	}
	if ( email_exists( $email ) ) {
		return new WP_Error( 'existing_user_email', 'این ایمیل قبلاً ثبت شده.' );
	}
	$id = $GLOBALS['cyh_test_next_uid']++;
	$GLOBALS['cyh_test_users'][ $id ] = new CYH_Test_WP_User(
		[
			'ID'           => $id,
			'user_login'   => $data['user_login'] ?? $email,
			'user_email'   => $email,
			// ⚠️ در هارنس عمداً متن ساده است — این یک شبیه‌سازی امنیتی
			// نیست، فقط باید بتواند در wp_authenticate با همین مقدار
			// مقایسه شود. وردپرس واقعی با phpass هش می‌کند.
			'user_pass'    => (string) ( $data['user_pass'] ?? '' ),
			'display_name' => $data['display_name'] ?? '',
			'roles'        => [ $data['role'] ?? 'subscriber' ],
		]
	);
	return $id;
}

function wp_update_user( $data ) {
	$id = (int) ( $data['ID'] ?? 0 );
	if ( ! isset( $GLOBALS['cyh_test_users'][ $id ] ) ) {
		return new WP_Error( 'invalid_user_id', 'کاربر پیدا نشد.' );
	}
	foreach ( $data as $k => $v ) {
		if ( 'ID' !== $k && 'user_pass' !== $k ) { $GLOBALS['cyh_test_users'][ $id ]->$k = $v; }
	}
	return $id;
}

function wp_set_password( $password, $user_id ) {
	if ( isset( $GLOBALS['cyh_test_users'][ $user_id ] ) ) {
		$GLOBALS['cyh_test_users'][ $user_id ]->user_pass = (string) $password;
	}
}

/**
 * ⚠️ پیام خطا عمداً یکسان است چه ایمیل پیدا نشود چه رمز غلط باشد — دقیقاً
 * همان چیزی که `cyh_rest_account_login()` هم می‌خواهد (کد واقعی، نه
 * این stub، پیام را یکسان می‌کند)؛ اینجا فقط کد خطای متفاوت لازم است تا
 * تست بتواند دو حالت را از هم تشخیص بدهد.
 */
function wp_authenticate( $username, $password ) {
	$user = get_user_by( 'email', $username );
	if ( ! $user ) { $user = get_user_by( 'login', $username ); }
	if ( ! $user ) {
		return new WP_Error( 'invalid_username', 'کاربری با این مشخصات پیدا نشد.' );
	}
	if ( $user->user_pass !== (string) $password ) {
		return new WP_Error( 'incorrect_password', 'رمز عبور اشتباه است.' );
	}
	return $user;
}

function get_users( $args = [] ) {
	$out = [];
	foreach ( $GLOBALS['cyh_test_users'] as $u ) {
		if ( in_array( (int) $u->ID, array_map( 'intval', (array) ( $args['exclude'] ?? [] ) ), true ) ) { continue; }
		if ( isset( $args['meta_key'] ) ) {
			$meta = $GLOBALS['cyh_test_user_meta'][ $u->ID ] ?? [];
			if ( ! array_key_exists( $args['meta_key'], $meta ) ) { continue; }
		}
		// ⚠️ meta_query واقعاً اعمال می‌شود (یکتایی موبایل به همین وابسته است): فقط
		// key + compare IN / = ؛ هر compare دیگری خطا می‌دهد تا بی‌صدا نگذرد.
		foreach ( (array) ( $args['meta_query'] ?? [] ) as $clause ) {
			$cmp = $clause['compare'] ?? '=';
			if ( ! in_array( $cmp, [ 'IN', '=' ], true ) ) { throw new Exception( "get_users stub: compare «$cmp» پشتیبانی نمی‌شود" ); }
			$have = $GLOBALS['cyh_test_user_meta'][ $u->ID ][ $clause['key'] ] ?? null;
			$want = (array) $clause['value'];
			if ( null === $have || ! in_array( (string) $have, array_map( 'strval', $want ), true ) ) { continue 2; }
		}
		$out[] = ( 'ID' === ( $args['fields'] ?? '' ) ) ? $u->ID : $u;
		if ( isset( $args['number'] ) && count( $out ) >= (int) $args['number'] ) { break; }
	}
	return $out;
}

function get_user_meta( $user_id, $key = '', $single = false ) {
	$all = $GLOBALS['cyh_test_user_meta'][ $user_id ] ?? [];
	if ( '' === $key ) {
		// ⚠️ شکل واقعی وردپرس: هر کلید به آرایه‌ای از مقادیر نگاشت می‌شود
		// (متا می‌تواند چندمقداری باشد). cyh_customer_revoke_all_tokens
		// فقط به کلیدها نیاز دارد، ولی شکل درست نگه داشته می‌شود.
		$out = [];
		foreach ( $all as $k => $v ) { $out[ $k ] = [ $v ]; }
		return $out;
	}
	return $all[ $key ] ?? ( $single ? '' : [] );
}
function update_user_meta( $user_id, $key, $val, $prev = '' ) {
	$GLOBALS['cyh_test_user_meta'][ $user_id ][ $key ] = $val;
	return true;
}
function delete_user_meta( $user_id, $key ) {
	unset( $GLOBALS['cyh_test_user_meta'][ $user_id ][ $key ] );
	return true;
}

/* ── رسانه و آپلود ──────────────────────────────────────────────────────
   ⚠️ این stubها عمداً *منطق* دارند، نه فقط امضا.

   نقطه‌ی آپلود، بدون احراز هویت است و امنیتش کاملاً به تشخیص نوع فایل
   وابسته است. اگر `wp_check_filetype_and_ext` اینجا همیشه موفق برگردد،
   هارنس هرگز نمی‌فهمد که آن منطق شکسته — یعنی دقیقاً همان چیزی را که
   باید محافظت کند، آزمایش نمی‌کند.

   پس این نسخه واقعاً پسوند را با فهرست mimes می‌سنجد. */
function wp_check_filetype_and_ext( $file, $filename, $mimes = null ) {
	$ext = strtolower( pathinfo( $filename, PATHINFO_EXTENSION ) );

	foreach ( (array) $mimes as $pattern => $mime ) {
		foreach ( explode( '|', $pattern ) as $allowed ) {
			if ( $allowed === $ext ) {
				return [ 'ext' => $ext, 'type' => $mime, 'proper_filename' => false ];
			}
		}
	}
	// پسوند ناشناخته → رد. همان رفتاری که وردپرس واقعی دارد.
	return [ 'ext' => false, 'type' => false, 'proper_filename' => false ];
}

function wp_handle_upload( $file, $overrides = [] ) {
	if ( ! empty( $GLOBALS['cyh_test_upload_fails'] ) ) {
		return [ 'error' => 'شبیه‌سازی خطای آپلود' ];
	}
	$name = $file['name'] ?? 'file.jpg';
	return [
		'file' => '/tmp/uploads/' . $name,
		'url'  => 'https://cms.example.com/wp-content/uploads/' . $name,
		'type' => $file['type'] ?? 'image/jpeg',
	];
}

function wp_insert_attachment( $args, $file = false, $parent = 0, $wp_error = false ) {
	$id = count( $GLOBALS['cyh_test_attachments'] ?? [] ) + 9000;
	$GLOBALS['cyh_test_attachments'][ $id ] = [ 'args' => $args, 'file' => $file, 'parent' => $parent ];
	return $id;
}
function wp_generate_attachment_metadata( $id, $file ) { return [ 'file' => $file, 'width' => 800, 'height' => 600 ]; }
function wp_update_attachment_metadata( $id, $data ) { $GLOBALS['cyh_test_attachment_meta'][ $id ] = $data; return true; }
function wp_get_attachment_url( $id ) { return 'https://cms.example.com/wp-content/uploads/att-' . (int) $id . '.jpg'; }
function wp_get_attachment_image( $id, $size = 'thumbnail', $icon = false, $attr = '' ) {
	return '<img src="' . wp_get_attachment_url( $id ) . '" alt="">';
}
function get_attached_media( $type, $post = 0 ) {
	$id  = is_object( $post ) ? $post->ID : (int) $post;
	$out = [];
	foreach ( (array) ( $GLOBALS['cyh_test_attachments'] ?? [] ) as $aid => $a ) {
		if ( (int) $a['parent'] === $id ) {
			$out[] = (object) [ 'ID' => $aid ];
		}
	}
	return $out;
}
function wp_update_post( $post = [], $wp_error = false, $fire = true ) { return is_array( $post ) ? ( $post['ID'] ?? 1 ) : 1; }
function wp_unique_post_slug( $slug, $id, $status, $type, $parent ) { return $slug; }
function clean_post_cache( $p ) { return null; }
function get_the_date( $fmt = '', $p = null ) { return '2026-01-01'; }

// ── دیدگاه ─────────────────────────────────────────────────────────────────
function get_comment( $c = null, $out = OBJECT ) { return $GLOBALS['cyh_test_comments'][ is_object( $c ) ? $c->comment_ID : (int) $c ] ?? null; }
function get_comments( $args = [] ) { return array_values( $GLOBALS['cyh_test_comments'] ?? [] ); }
function wp_insert_comment( $data ) { $id = count( $GLOBALS['cyh_test_comments'] ?? [] ) + 1; $GLOBALS['cyh_test_comments'][ $id ] = (object) array_merge( [ 'comment_ID' => $id ], $data ); return $id; }
function get_comment_meta( $id, $key = '', $single = false ) { return $GLOBALS['cyh_test_cmeta'][ $id ][ $key ] ?? ( $single ? '' : [] ); }
function add_comment_meta( $id, $key, $val, $unique = false ) { $GLOBALS['cyh_test_cmeta'][ $id ][ $key ] = $val; return true; }

// ── ACF ────────────────────────────────────────────────────────────────────
function acf_add_local_field_group( $group ) {
	if ( empty( $group['key'] ) ) { throw new Exception( 'acf_add_local_field_group: missing key' ); }
	$name = $group['graphql_field_name'] ?? null;
	if ( $name && isset( $GLOBALS['cyh_test_acf_gql'][ $name ] ) && $GLOBALS['cyh_test_acf_gql'][ $name ] !== $group['key'] ) {
		// همان تصادمی که سه بیلد را سوزاند.
		$GLOBALS['cyh_test_acf_collisions'][] = $name;
	}
	if ( $name ) { $GLOBALS['cyh_test_acf_gql'][ $name ] = $group['key']; }
	$GLOBALS['cyh_test_acf_groups'][ $group['key'] ] = $group;
	return $group;
}
/* ⚠️ ACF واقعی مقدار فیلد نوشته را در متای همان نوشته نگه می‌دارد؛
   get_field و get_post_meta یک مقدار را می‌بینند. نسخه‌ی قبلی این stubها
   دو انبار جدا داشت، و کدی که مقدار قبلی را با یکی و مقدار تازه را با
   دیگری می‌خواند، در هارنس رفتاری می‌دید که وردپرس هرگز ندارد. */
function get_field( $sel, $post_id = false, $format = true ) {
	if ( isset( $GLOBALS['cyh_test_fields'][ (string) $post_id ][ $sel ] ) ) {
		return $GLOBALS['cyh_test_fields'][ (string) $post_id ][ $sel ];
	}
	return is_numeric( $post_id ) ? ( $GLOBALS['cyh_test_meta'][ (int) $post_id ][ $sel ] ?? '' ) : '';
}
function update_field( $sel, $val, $post_id = false ) {
	$GLOBALS['cyh_test_fields'][ (string) $post_id ][ $sel ] = $val;
	if ( is_numeric( $post_id ) ) {
		$GLOBALS['cyh_test_meta'][ (int) $post_id ][ $sel ] = $val;
	}
	return true;
}

// گروه‌های فیلد ACF «در پایگاه داده» — آزمون‌ها این را پر می‌کنند.
$GLOBALS['cyh_test_acf_groups'] = [];
function acf_get_field_groups( $args = [] ) { return $GLOBALS['cyh_test_acf_groups'] ?? []; }

// ── WPGraphQL ──────────────────────────────────────────────────────────────
function register_graphql_object_type( $name, $config ) { $GLOBALS['cyh_test_gql_types'][ $name ] = $config; return true; }
function register_graphql_field( $type, $name, $config ) { $GLOBALS['cyh_test_gql_fields'][ "$type.$name" ] = $config; return true; }

// ── متفرقه ─────────────────────────────────────────────────────────────────
function esc_url( $u, $p = null, $ctx = 'display' ) { return (string) $u; }
function is_email( $e ) { return (bool) filter_var( $e, FILTER_VALIDATE_EMAIL ); }
function wp_json_encode( $d, $flags = 0, $depth = 512 ) { return json_encode( $d, $flags | JSON_UNESCAPED_UNICODE, $depth ); }
function wp_kses( $str, $allowed = [], $protocols = [] ) { return strip_tags( (string) $str, array_map( fn( $t ) => "<$t>", array_keys( (array) $allowed ) ) ); }
function wp_strip_all_tags( $str, $break = false ) { return trim( strip_tags( (string) $str ) ); }
function wp_list_pluck( $list, $field, $index_key = null ) {
	$out = [];
	foreach ( (array) $list as $key => $item ) {
		$value = is_object( $item ) ? ( $item->$field ?? null ) : ( $item[ $field ] ?? null );
		if ( null === $index_key ) {
			$out[ $key ] = $value;
			continue;
		}
		$index = is_object( $item ) ? ( $item->$index_key ?? null ) : ( $item[ $index_key ] ?? null );
		if ( null === $index ) {
			$out[] = $value;
		} else {
			$out[ $index ] = $value;
		}
	}
	return $out;
}
function wp_trim_words( $text, $num_words = 55, $more = null ) {
	$more  = null === $more ? '…' : $more;
	$words = preg_split( '/[\n\r\t ]+/', trim( wp_strip_all_tags( (string) $text ) ), -1, PREG_SPLIT_NO_EMPTY );
	if ( count( $words ) <= $num_words ) {
		return implode( ' ', $words );
	}
	return implode( ' ', array_slice( $words, 0, $num_words ) ) . $more;
}
function wp_rand( $min = 0, $max = 0 ) { return $max > $min ? random_int( $min, $max ) : random_int( 0, PHP_INT_MAX ); }
function trailingslashit( $s ) { return rtrim( (string) $s, '/\\' ) . '/'; }
function rest_get_url_prefix() { return 'wp-json'; }


function acf_add_options_page( $args ) {
	if ( empty( $args['menu_slug'] ) ) {
		throw new Exception( 'acf_add_options_page: missing menu_slug' );
	}
	$GLOBALS['cyh_test_options_pages'][ $args['menu_slug'] ] = $args;
	return $args;
}

// ⚠️ قبلاً اینجا یک فهرست دستی از ۶ فایل بود. هر فایل جدیدی که به افزونه
// اضافه می‌شد، در این هارنس *اجرا نمی‌شد* — یعنی تست سبز می‌ماند در حالی که
// کد جدید اصلاً بارگذاری نشده بود. glob این کلاس از خطا را می‌بندد.
$plugin_files = glob( $plugin_dir . 'includes/*.php' );
sort( $plugin_files );
// class-taxonomy-hierarchy به cyh_taxonomy_blueprint() در class-taxonomy-sync
// وابسته است؛ چون فقط در زمان *فراخوانی* لازم است، ترتیب الفبایی کافی است.
foreach ( $plugin_files as $__f ) {
	require_once $__f;
}
echo '✓ ' . count( $plugin_files ) . " فایل افزونه بارگذاری شد\n";

// هوک init را واقعاً «اجرا» می‌کنیم تا register_post_type/register_taxonomy
// واقعاً فراخوانی شوند، نه فقط تعریف.
do_action( 'init' );
do_action( 'rest_api_init' );
do_action( 'admin_menu' );
do_action( 'admin_init' );
do_action( 'acf/init' );
// ⚠️ بدون این خط، هیچ‌کدام از ثبت‌های گراف‌کیوال اجرا نمی‌شدند:
// craneCommerce، تنظیمات سایت، و بخش انجمن. یعنی هارنس ماه‌ها سبز بود
// در حالی که یک لایه‌ی کامل را اصلاً لمس نکرده بود.
// WPGraphQL این اکشن را با یک آرگومان (TypeRegistry) صدا می‌زند.
do_action( 'graphql_register_types', null );

$errors = [];

if ( empty( $GLOBALS['cyh_test_options_pages']['crane-site-settings'] ) ) {
	$errors[] = 'ACF Options Page ثبت نشد (crane-site-settings)';
}

// بررسی ۱: همه‌ی CPTهای مورد انتظار ثبت شده‌اند؟
// datasheet و industry عمداً حذف شده‌اند؛ cyh_quote اضافه شده.
$expected_cpts = [ 'product', 'brand', 'inquiry', 'cyh_quote' ];
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


// ═══════════════════════════════════════════════════════════════════════════
// بررسی ۱۷ تا ۲۷: حساب کاربری مشتری (ایست ۶)
// ═══════════════════════════════════════════════════════════════════════════
// هر بار قبل از فراخوانی‌ای که rate-limit دارد، bucket مشترکِ IP تستی
// ریست می‌شود — همان دلیلِ بررسی ۸ بالا: بدون این، بررسی‌های پشت‌سرهم
// این بخش به‌جای آزمودن منطق واقعی، فقط به «Rate Limited» می‌خوردند.
$reset_rl = static function () {
	delete_transient( 'cyh_rl_' . md5( '0.0.0.0' ) );
};

$reset_rl();
$reg_request = new WP_REST_Request(
	[
		'name'     => 'مهندس کریمی',
		'email'    => 'karimi@example.com',
		'password' => 'Jarsaghil2026',
		'phone'    => '09121234567',
		'company'  => 'فولاد کویر',
		'website'  => '',
	]
);
$reg_result = cyh_rest_account_register( $reg_request );
if ( is_wp_error( $reg_result ) ) {
	$errors[] = 'ثبت‌نام معتبر رد شد: ' . $reg_result->get_error_message();
} elseif ( empty( $reg_result['success'] ) || empty( $reg_result['token'] ) ) {
	$errors[] = 'ثبت‌نام موفق token برنگرداند';
} else {
	echo "✓ ثبت‌نام مشتری با موفقیت انجام شد و توکن صادر شد\n";
}
$customer_token = $reg_result['token'] ?? '';

// بررسی ۱۸: نقش crane_customer واقعاً به کاربر تازه اختصاص یافته
$new_user = get_user_by( 'email', 'karimi@example.com' );
if ( ! $new_user || ! in_array( CYH_CUSTOMER_ROLE, $new_user->roles, true ) ) {
	$errors[] = 'کاربر تازه نقش crane_customer نگرفت';
} else {
	echo "✓ کاربر تازه نقش crane_customer را گرفت\n";
}

// بررسی ۱۹: ایمیل تکراری رد می‌شود
$reset_rl();
$dup_result = cyh_rest_account_register(
	new WP_REST_Request( [ 'name' => 'دیگری', 'email' => 'karimi@example.com', 'password' => 'یک‌رمز‌دیگر', 'website' => '' ] )
);
if ( ! is_wp_error( $dup_result ) || 'cyh_email_taken' !== $dup_result->get_error_code() ) {
	$errors[] = 'ثبت‌نام با ایمیل تکراری باید رد شود اما نشد';
} else {
	echo "✓ ثبت‌نام با ایمیل تکراری به‌درستی رد شد\n";
}

// بررسی ۲۰: رمز کوتاه‌تر از ۸ کاراکتر رد می‌شود
$reset_rl();
$weak_pw = cyh_rest_account_register(
	new WP_REST_Request( [ 'name' => 'تست', 'email' => 'weak@example.com', 'password' => '۱۲۳', 'website' => '' ] )
);
if ( ! is_wp_error( $weak_pw ) || 'cyh_weak_password' !== $weak_pw->get_error_code() ) {
	$errors[] = 'رمز عبور کوتاه باید رد شود اما نشد';
} else {
	echo "✓ رمز عبور کوتاه‌تر از ۸ کاراکتر به‌درستی رد شد\n";
}

/* بررسی ۲۰ب (رگرسیون — رمز ساده): «حداقل ۸ کاراکتر» (سیاست قبلی) به‌تنهایی
   `12345678` و `password` را می‌پذیرفت. هر ردیف یک ورودیِ خرابِ
   شناخته‌شده است و *باید* رد شود؛ رمز معتبر در بررسی ۱۷ آزموده شده. */
$weak_cases = [
	'بدون رقم'           => 'onlylettersherexx',
	'بدون حرف'           => '12345678901',
	'فهرست سیاه'         => 'password123',
	'تکرار یک کاراکتر'   => 'aaaaaaaaaa1',
	'نام ایمیل در رمز'    => 'strongsara2024',
	'ارقام فارسی'         => 'Jarsaghil۱۲۳۴',
	'کوتاه‌تر از ۸'        => 'ab12cd',
];
$weak_leaks = [];
foreach ( $weak_cases as $label => $pw ) {
	if ( null === cyh_customer_password_problem( $pw, 'strongsara@example.com' ) ) {
		$weak_leaks[] = "$label ($pw)";
	}
}
if ( null !== cyh_customer_password_problem( 'Jarsaghil2026', 'karimi@example.com' ) || null !== cyh_customer_password_problem( 'رمزعبور1234', 'karimi@example.com' ) ) {
	$weak_leaks[] = 'رمز معتبر فارسی به‌اشتباه رد شد';
}
if ( $weak_leaks ) {
	$errors[] = 'سیاست رمز عبور نشت دارد: ' . implode( '، ', $weak_leaks );
} else {
	echo '✓ سیاست رمز عبور هر ' . count( $weak_cases ) . " رمز سادهٔ شناخته‌شده را رد و رمز معتبر فارسی را قبول کرد\n";
}

// بررسی ۲۱: شماره موبایل نامعتبر رد می‌شود (اگر داده شده باشد)
$reset_rl();
$bad_phone = cyh_rest_account_register(
	new WP_REST_Request( [ 'name' => 'تست', 'email' => 'badphone@example.com', 'password' => 'Jarsaghil2026', 'phone' => '12345', 'website' => '' ] )
);
if ( ! is_wp_error( $bad_phone ) || 'cyh_bad_phone' !== $bad_phone->get_error_code() ) {
	$errors[] = 'ثبت‌نام با شماره‌ی نامعتبر باید رد شود اما نشد';
} else {
	echo "✓ شماره موبایل نامعتبر در ثبت‌نام به‌درستی رد شد\n";
}

// بررسی ۲۱-ب: موبایل اجباری است — نبودن یا خالی بودن رد می‌شود و کاربری ساخته نمی‌شود
foreach ( [ 'absent' => null, 'empty' => '', 'spaces' => '   ' ] as $label => $ph ) {
	$reset_rl();
	$req = [ 'name' => 'تست', 'email' => 'nophone-' . $label . '@example.com', 'password' => 'Jarsaghil2026', 'website' => '' ];
	if ( null !== $ph ) {
		$req['phone'] = $ph;
	}
	$np = cyh_rest_account_register( new WP_REST_Request( $req ) );
	if ( ! is_wp_error( $np ) || 'cyh_bad_phone' !== $np->get_error_code() || email_exists( $req['email'] ) ) {
		$errors[] = "ثبت‌نام بدون موبایل ($label) باید رد شود و کاربری نسازد";
	}
}
echo "✓ ثبت‌نام بدون موبایل (نبود/خالی/فاصله) رد شد و کاربری ساخته نشد\n";

// بررسی ۲۲: ورود با رمز درست موفق است
$reset_rl();
$login_ok = cyh_rest_account_login(
	new WP_REST_Request( [ 'email' => 'karimi@example.com', 'password' => 'Jarsaghil2026' ] )
);
if ( is_wp_error( $login_ok ) || empty( $login_ok['token'] ) ) {
	$errors[] = 'ورود با رمز درست شکست خورد';
} else {
	echo "✓ ورود با ایمیل و رمز درست موفق شد\n";
}

/* بررسی ۲۳ (رگرسیون امنیتی): پیام خطای «رمز اشتباه» و «کاربر ناموجود»
   باید از دید کد خطا قابل تفکیک باشند (برای مدیریت خطای فرانت‌اند) ولی
   cyh_rest_account_login در کد واقعی همیشه یک پیام یکسان («ایمیل یا رمز
   عبور اشتباه است») برمی‌گرداند تا کسی نتواند با امتحان ایمیل‌های
   مختلف بفهمد کدام‌ها روی سایت ثبت‌نام کرده‌اند. هر دو حالت اینجا با
   کد خطای *یکسانِ* cyh_bad_login آزموده می‌شوند تا این یکسانی تضمین
   بماند. */
$reset_rl();
$wrong_pass = cyh_rest_account_login(
	new WP_REST_Request( [ 'email' => 'karimi@example.com', 'password' => 'رمزعبورغلط' ] )
);
$reset_rl();
$unknown_email = cyh_rest_account_login(
	new WP_REST_Request( [ 'email' => 'nobody@example.com', 'password' => 'هرچیزی' ] )
);
if (
	! is_wp_error( $wrong_pass ) || ! is_wp_error( $unknown_email )
	|| 'cyh_bad_login' !== $wrong_pass->get_error_code() || 'cyh_bad_login' !== $unknown_email->get_error_code()
	|| $wrong_pass->get_error_message() !== $unknown_email->get_error_message()
) {
	$errors[] = 'ورود ناموفق باید پیام یکسان بدهد چه رمز غلط باشد چه ایمیل ناموجود (ضدِ User Enumeration)';
} else {
	echo "✓ رمز غلط و ایمیل ناموجود پیام یکسان می‌دهند — شمارش کاربر ممکن نیست\n";
}

// بررسی ۲۴: /account/me بدون توکن رد می‌شود
$GLOBALS['cyh_test_headers'] = [];
$me_no_token = cyh_rest_account_me( new WP_REST_Request( [] ) );
if ( ! is_wp_error( $me_no_token ) || 401 !== ( $me_no_token->get_error_data()['status'] ?? null ) ) {
	$errors[] = '/account/me بدون توکن باید ۴۰۱ بدهد';
} else {
	echo "✓ /account/me بدون توکن به‌درستی ۴۰۱ می‌دهد\n";
}

// بررسی ۲۵: /account/me با توکن معتبر پروفایل درست را برمی‌گرداند
$GLOBALS['cyh_test_headers'] = [ 'authorization' => 'Bearer ' . $customer_token ];
$me_ok = cyh_rest_account_me( new WP_REST_Request( [] ) );
if ( is_wp_error( $me_ok ) || ( $me_ok['profile']['email'] ?? null ) !== 'karimi@example.com' ) {
	$errors[] = '/account/me با توکن معتبر پروفایل درست را برنگرداند';
} else {
	echo "✓ /account/me با توکن معتبر پروفایل درست را برمی‌گرداند\n";
}

/* بررسی ۲۵ب: هدر X-Crane-Token — همان هدری که فرانت‌اند واقعاً می‌فرستد.
   بررسی ۲۵ فقط مسیر Authorization را می‌آزمود؛ اگر خواندن هدر سفارشی
   بشکند، سایت واقعی (نه این هارنس) کاربر را بیرون می‌اندازد. */
$GLOBALS['cyh_test_headers'] = [ 'x-crane-token' => $customer_token ];
$me_custom = cyh_rest_account_me( new WP_REST_Request( [] ) );
if ( is_wp_error( $me_custom ) || ( $me_custom['profile']['email'] ?? null ) !== 'karimi@example.com' ) {
	$errors[] = '/account/me با هدر X-Crane-Token پروفایل را برنگرداند';
} else {
	echo "✓ /account/me با هدر X-Crane-Token (مسیر واقعی فرانت‌اند) کار می‌کند\n";
}

// بررسی ۲۶: خروج، همان توکن را باطل می‌کند
cyh_rest_account_logout( new WP_REST_Request( [] ) );
$me_after_logout = cyh_rest_account_me( new WP_REST_Request( [] ) );
if ( ! is_wp_error( $me_after_logout ) ) {
	$errors[] = 'خروج باید توکن را باطل کند، ولی /account/me هنوز موفق بود';
} else {
	echo "✓ خروج توکن را باطل می‌کند — /account/me بعد از آن رد می‌شود\n";
}
$GLOBALS['cyh_test_headers'] = [];

/* بررسی ۲۷ (رگرسیون ضدِ User Enumeration): فراموشی رمز برای ایمیلِ
   ناموجود هم باید success=true بدهد و **نباید** ایمیلی بفرستد — دقیقاً
   همان الگوی هانی‌پات این پروژه (پاسخ موفق جعلی، نه خطا). */
$reset_rl();
$GLOBALS['cyh_test_mail_calls'] = [];
$forgot_unknown = cyh_rest_account_forgot_password( new WP_REST_Request( [ 'email' => 'ghost@example.com' ] ) );
if ( is_wp_error( $forgot_unknown ) || empty( $forgot_unknown['success'] ) || ! empty( $GLOBALS['cyh_test_mail_calls'] ) ) {
	$errors[] = 'فراموشی رمز برای ایمیل ناموجود باید success=true بدهد و هیچ ایمیلی نفرستد';
} else {
	echo "✓ فراموشی رمز برای ایمیل ناموجود پاسخ موفق جعلی می‌دهد، بدون افشای وجود/عدم‌وجود حساب\n";
}

// بررسی ۲۸: فراموشی رمز برای ایمیل واقعی، ایمیل واقعی می‌فرستد
$reset_rl();
$GLOBALS['cyh_test_mail_calls'] = [];
$forgot_real = cyh_rest_account_forgot_password( new WP_REST_Request( [ 'email' => 'karimi@example.com' ] ) );
if ( is_wp_error( $forgot_real ) || empty( $forgot_real['success'] ) || empty( $GLOBALS['cyh_test_mail_calls'] ) ) {
	$errors[] = 'فراموشی رمز برای ایمیل واقعی باید ایمیل بفرستد اما نفرستاد';
} else {
	echo "✓ فراموشی رمز برای ایمیل واقعی ایمیل بازیابی می‌فرستد\n";
}

// بررسی ۲۹: بازنشانی رمز با توکن معتبر کار می‌کند و نشست‌های قبلی را باطل می‌کند
preg_match( '/token=([0-9a-f]+)/', $GLOBALS['cyh_test_mail_calls'][0]['body'] ?? '', $token_match );
$reset_token = $token_match[1] ?? '';
/* ⚠️ یک نشست *تازه و زنده* پیش از بازنشانی. نسخه‌ی قبلی این بررسی
   توکنِ بررسی ۲۵ را می‌آزمود — توکنی که بررسی ۲۶ (خروج) از قبل باطل
   کرده بود. یعنی بررسی سبز می‌ماند حتی اگر بازنشانی هیچ نشستی را باطل
   نمی‌کرد: آزمونی کور، دقیقاً همان چیزی که قاعده‌ی ۶ پروژه می‌گوید. */
$reset_rl();
$live_login = cyh_rest_account_login( new WP_REST_Request( [ 'email' => 'karimi@example.com', 'password' => 'Jarsaghil2026' ] ) );
$live_token = is_wp_error( $live_login ) ? '' : ( $live_login['token'] ?? '' );
$GLOBALS['cyh_test_headers'] = [ 'x-crane-token' => $live_token ];
if ( '' === $live_token || is_wp_error( cyh_rest_account_me( new WP_REST_Request( [] ) ) ) ) {
	$errors[] = 'پیش‌شرط بررسی ۲۹: نشست تازه پیش از بازنشانی کار نکرد';
}
$GLOBALS['cyh_test_headers'] = [];
$reset_rl();
$reset_ok = cyh_rest_account_reset_password(
	new WP_REST_Request( [ 'email' => 'karimi@example.com', 'token' => $reset_token, 'password' => 'TazehRamz77' ] )
);
if ( is_wp_error( $reset_ok ) || empty( $reset_ok['success'] ) ) {
	$errors[] = 'بازنشانی رمز با توکن معتبر شکست خورد: ' . ( is_wp_error( $reset_ok ) ? $reset_ok->get_error_message() : '' );
} else {
	echo "✓ بازنشانی رمز با توکن معتبر انجام شد\n";
}
// همان نشست زنده — که یک لحظه پیش کار می‌کرد — باید حالا باطل باشد.
$GLOBALS['cyh_test_headers'] = [ 'x-crane-token' => $live_token ];
$me_after_reset = cyh_rest_account_me( new WP_REST_Request( [] ) );
$GLOBALS['cyh_test_headers'] = [];
if ( ! is_wp_error( $me_after_reset ) ) {
	$errors[] = 'تغییر رمز باید همه‌ی نشست‌های قبلی را باطل کند، ولی توکن قدیمی هنوز کار می‌کرد';
} else {
	echo "✓ تغییر رمز همه‌ی نشست‌های قبلی را باطل می‌کند\n";
}

// بررسی ۳۰: توکن بازنشانیِ منقضی/جعلی رد می‌شود
$reset_rl();
$bad_reset = cyh_rest_account_reset_password(
	new WP_REST_Request( [ 'email' => 'karimi@example.com', 'token' => 'توکن-جعلی', 'password' => 'TazehRamz77' ] )
);
if ( ! is_wp_error( $bad_reset ) || 'cyh_bad_reset' !== $bad_reset->get_error_code() ) {
	$errors[] = 'بازنشانی رمز با توکن جعلی باید رد شود اما نشد';
} else {
	echo "✓ بازنشانی رمز با توکن جعلی/منقضی به‌درستی رد شد\n";
}


// ═══════════════════════════════════════════════════════════════════════════
// بررسی ۳۱ تا ۳۸: تنظیمات حساب و علاقه‌مندی‌ها
// ═══════════════════════════════════════════════════════════════════════════
// رمز فعلی بعد از بررسی ۲۹: TazehRamz77
$reset_rl();
$acct_login = cyh_rest_account_login( new WP_REST_Request( [ 'email' => 'karimi@example.com', 'password' => 'TazehRamz77' ] ) );
$acct_token = is_wp_error( $acct_login ) ? '' : ( $acct_login['token'] ?? '' );
$as_customer = static function () use ( &$acct_token ) {
	$GLOBALS['cyh_test_headers'] = [ 'x-crane-token' => $acct_token ];
};

// بررسی ۳۱: ویرایش پروفایل — نام تازه ذخیره و شماره‌ی خالی حذف می‌شود
$as_customer();
$prof_empty = cyh_rest_account_profile( new WP_REST_Request( [ 'name' => 'مهندس کریمی‌نژاد', 'phone' => '', 'company' => 'فولاد کویر' ] ) );
if ( ! is_wp_error( $prof_empty ) || 'cyh_bad_phone' !== $prof_empty->get_error_code() ) {
	$errors[] = 'ذخیره‌ی پروفایل با موبایل خالی باید رد شود';
}
$prof = cyh_rest_account_profile( new WP_REST_Request( [ 'name' => 'مهندس کریمی‌نژاد', 'phone' => '۰۹۱۲۱۲۳۴۵۶۷', 'company' => 'فولاد کویر' ] ) );
if ( is_wp_error( $prof ) || 'مهندس کریمی‌نژاد' !== ( $prof['profile']['name'] ?? '' ) || '09121234567' !== ( $prof['profile']['phone'] ?? '' ) ) {
	$errors[] = 'ویرایش پروفایل نام را ذخیره نکرد یا شماره را به ارقام لاتین نرمال نکرد';
} else {
	echo "✓ ویرایش پروفایل: موبایل خالی رد شد؛ نام ذخیره و شماره‌ی فارسی به لاتین نرمال شد\n";
}

// بررسی ۳۲: ویرایش پروفایل بدون توکن رد می‌شود
$GLOBALS['cyh_test_headers'] = [];
$prof_anon = cyh_rest_account_profile( new WP_REST_Request( [ 'name' => 'مهاجم' ] ) );
if ( ! is_wp_error( $prof_anon ) || 401 !== ( $prof_anon->get_error_data()['status'] ?? null ) ) {
	$errors[] = 'ویرایش پروفایل بدون توکن باید ۴۰۱ بدهد';
} else {
	echo "✓ ویرایش پروفایل بدون توکن ۴۰۱ می‌دهد\n";
}

// بررسی ۳۳: تغییر رمز با رمز فعلیِ اشتباه رد می‌شود (توکن تنها کافی نیست)
$reset_rl();
$as_customer();
$cp_wrong = cyh_rest_account_change_password( new WP_REST_Request( [ 'current_password' => 'Hads-e-ghalat1', 'new_password' => 'Jadid2027xyz' ] ) );
if ( ! is_wp_error( $cp_wrong ) || 'cyh_bad_current_password' !== $cp_wrong->get_error_code() ) {
	$errors[] = 'تغییر رمز با رمز فعلی اشتباه باید رد شود';
} else {
	echo "✓ تغییر رمز بدون رمز فعلیِ درست رد می‌شود — توکن دزدیده‌شده کافی نیست\n";
}

// بررسی ۳۴: تغییر رمز موفق — توکن قدیمی باطل، توکن تازه معتبر
$reset_rl();
$as_customer();
$cp_ok = cyh_rest_account_change_password( new WP_REST_Request( [ 'current_password' => 'TazehRamz77', 'new_password' => 'Jadid2027xyz' ] ) );
$old_token = $acct_token;
$new_token = is_wp_error( $cp_ok ) ? '' : ( $cp_ok['token'] ?? '' );
$GLOBALS['cyh_test_headers'] = [ 'x-crane-token' => $old_token ];
$old_dead = is_wp_error( cyh_rest_account_me( new WP_REST_Request( [] ) ) );
$GLOBALS['cyh_test_headers'] = [ 'x-crane-token' => $new_token ];
$new_alive = ! is_wp_error( cyh_rest_account_me( new WP_REST_Request( [] ) ) );
if ( is_wp_error( $cp_ok ) || ! $old_dead || ! $new_alive ) {
	$errors[] = 'تغییر رمز باید توکن قدیمی را باطل و توکن تازه‌ی معتبر برگرداند';
} else {
	echo "✓ تغییر رمز توکن قدیمی را باطل و برای همین دستگاه توکن تازه صادر کرد\n";
}
$acct_token = $new_token;

// محصول آزمایشی برای علاقه‌مندی‌ها
$wish_pid = wp_insert_post( [ 'post_type' => 'product', 'post_title' => 'ریموت ساگا', 'post_name' => 'saga1-l12', 'post_status' => 'publish' ] );
wp_insert_post( [ 'post_type' => 'product', 'post_title' => 'پیش‌نویس', 'post_name' => 'draft-part', 'post_status' => 'draft' ] );

// بررسی ۳۵: افزودن محصول منتشرشده
$as_customer();
$w_add = cyh_rest_account_wishlist_update( new WP_REST_Request( [ 'slug' => 'saga1-l12', 'action' => 'add' ] ) );
if ( is_wp_error( $w_add ) || [ 'saga1-l12' ] !== ( $w_add['slugs'] ?? null ) ) {
	$errors[] = 'افزودن محصول منتشرشده به علاقه‌مندی‌ها شکست خورد';
} else {
	echo "✓ محصول منتشرشده به علاقه‌مندی‌ها اضافه شد (تکرار نمی‌شود)\n";
}

// بررسی ۳۶: محصول ناموجود یا پیش‌نویس پذیرفته نمی‌شود
$w_ghost = cyh_rest_account_wishlist_update( new WP_REST_Request( [ 'slug' => 'no-such-part', 'action' => 'add' ] ) );
$w_draft = cyh_rest_account_wishlist_update( new WP_REST_Request( [ 'slug' => 'draft-part', 'action' => 'add' ] ) );
if ( ! is_wp_error( $w_ghost ) || ! is_wp_error( $w_draft ) ) {
	$errors[] = 'محصول ناموجود/پیش‌نویس نباید به علاقه‌مندی‌ها اضافه شود';
} else {
	echo "✓ محصول ناموجود و پیش‌نویس به علاقه‌مندی‌ها راه نمی‌یابند\n";
}

// بررسی ۳۷: فهرست با نام محصول برمی‌گردد؛ محصولِ بعداً پیش‌نویس‌شده حذف می‌شود
$w_list = cyh_rest_account_wishlist_get( new WP_REST_Request( [] ) );
$GLOBALS['cyh_test_posts'][ $wish_pid ]['post_status'] = 'draft';
$w_list_after = cyh_rest_account_wishlist_get( new WP_REST_Request( [] ) );
$GLOBALS['cyh_test_posts'][ $wish_pid ]['post_status'] = 'publish';
if (
	is_wp_error( $w_list ) || 'ریموت ساگا' !== ( $w_list['items'][0]['name'] ?? '' )
	|| is_wp_error( $w_list_after ) || [] !== ( $w_list_after['items'] ?? null )
) {
	$errors[] = 'فهرست علاقه‌مندی‌ها نام درست نداد یا محصولِ از دسترس خارج‌شده را نگه داشت';
} else {
	echo "✓ فهرست علاقه‌مندی‌ها نام محصول می‌دهد و محصولِ از دسترس خارج‌شده را پاک می‌کند\n";
}

// بررسی ۳۸: حذف از فهرست
cyh_rest_account_wishlist_update( new WP_REST_Request( [ 'slug' => 'saga1-l12', 'action' => 'add' ] ) );
$w_rm = cyh_rest_account_wishlist_update( new WP_REST_Request( [ 'slug' => 'saga1-l12', 'action' => 'remove' ] ) );
$GLOBALS['cyh_test_headers'] = [];
if ( is_wp_error( $w_rm ) || [] !== ( $w_rm['slugs'] ?? null ) ) {
	$errors[] = 'حذف از علاقه‌مندی‌ها انجام نشد';
} else {
	echo "✓ حذف از علاقه‌مندی‌ها انجام شد\n";
}


// ═══════════════════════════════════════════════════════════════════════════
// بررسی ۳۹ تا ۵۱: cyh_product_pricing — هم‌رفتار با computePrice (src/lib/wp.ts)
// ═══════════════════════════════════════════════════════════════════════════
// هر مورد مرزی هم این‌جا و هم در تست TS آزموده می‌شود؛ واگرایی این دو همان
// باگی است که این تابع برای رفعش ساخته شد.
$now      = 1790000000; // زمان ثابت، تا نتیجه به ساعت اجرای آزمون بستگی نداشته باشد
$day      = DAY_IN_SECONDS;
$tehran_ymd = static function ( $ts ) { return gmdate( 'Y-m-d', $ts + 12600 ); };
$mk = static function ( $slug, array $fields, $status = 'publish', $updated_days_ago = 1 ) use ( $now, $day ) {
	$id = wp_insert_post( [ 'post_type' => 'product', 'post_title' => "محصول $slug", 'post_name' => $slug, 'post_status' => $status ] );
	$GLOBALS['cyh_test_posts'][ $id ]['ID'] = $id;
	foreach ( array_merge( [ 'buy_mode' => 'cart', 'stock_status' => 'in_stock', 'sku' => strtoupper( $slug ) ], $fields ) as $k => $v ) {
		$GLOBALS['cyh_test_fields'][ (string) $id ][ $k ] = $v;
	}
	if ( null !== $updated_days_ago ) {
		update_post_meta( $id, CYH_PRICE_UPDATED_META, $now - $updated_days_ago * $day );
	}
	return $id;
};
$price_cases = [
	// [برچسب, شناسه, انتظار: payable, effective, reason, on_sale]
	[ 'استعلامی قیمت ندارد', $mk( 'p-rfq', [ 'buy_mode' => 'rfq', 'price' => 1000 ] ), false, null, 'rfq', false ],
	[ 'قیمت عادی، موجود، تازه', $mk( 'p-ok', [ 'price' => 5000000 ] ), true, 5000000.0, null, false ],
	[ 'تخفیف در بازه', $mk( 'p-sale', [ 'price' => 5000, 'sale_price' => 4000, 'sale_start' => $tehran_ymd( $now - 3 * $day ), 'sale_end' => $tehran_ymd( $now + 3 * $day ) ] ), true, 4000.0, null, true ],
	[ 'تخفیف ≥ قیمت عادی نادیده', $mk( 'p-bad-sale', [ 'price' => 5000, 'sale_price' => 6000 ] ), true, 5000.0, null, false ],
	[ 'تخفیف منقضی (دیروز)', $mk( 'p-old-sale', [ 'price' => 5000, 'sale_price' => 4000, 'sale_end' => $tehran_ymd( $now - $day ) ] ), true, 5000.0, null, false ],
	[ 'روز آخر تخفیف هنوز معتبر', $mk( 'p-last-day', [ 'price' => 5000, 'sale_price' => 4000, 'sale_end' => $tehran_ymd( $now ) ] ), true, 4000.0, null, true ],
	[ 'تخفیف هنوز شروع نشده', $mk( 'p-future', [ 'price' => 5000, 'sale_price' => 4000, 'sale_start' => $tehran_ymd( $now + 2 * $day ) ] ), true, 5000.0, null, false ],
	[ 'فقط قیمت تخفیف', $mk( 'p-sale-only', [ 'sale_price' => 3000 ] ), true, 3000.0, null, false ],
	[ 'بدون قیمت', $mk( 'p-none', [] ), false, null, 'no_price', false ],
	[ 'ناموجود — قیمت مرجع می‌ماند', $mk( 'p-order', [ 'price' => 5000, 'stock_status' => 'on_order' ] ), false, 5000.0, 'not_in_stock', false ],
	[ 'بدون تاریخ قیمت = منقضی', $mk( 'p-nodate', [ 'price' => 5000 ], 'publish', null ), false, 5000.0, 'price_expired', false ],
	[ '۱۱ روز پیش = منقضی', $mk( 'p-11d', [ 'price' => 5000 ], 'publish', 11 ), false, 5000.0, 'price_expired', false ],
	[ '۹ روز پیش = معتبر', $mk( 'p-9d', [ 'price' => 5000 ], 'publish', 9 ), true, 5000.0, null, false ],
	[ 'پیش‌نویس', $mk( 'p-draft', [ 'price' => 5000 ], 'draft' ), false, null, 'not_published', false ],
	[ 'ارقام فارسی در قیمت', $mk( 'p-fa', [ 'price' => '۵۰۰۰' ] ), true, 5000.0, null, false ],
];
$price_fail = [];
foreach ( $price_cases as [ $label, $pid, $want_pay, $want_eff, $want_reason, $want_sale ] ) {
	$p = cyh_product_pricing( $pid, $now );
	if ( $p['payable'] !== $want_pay || $p['effective'] !== $want_eff || $p['reason'] !== $want_reason || $p['on_sale'] !== $want_sale ) {
		$price_fail[] = sprintf( '%s: payable=%s effective=%s reason=%s on_sale=%s', $label, var_export( $p['payable'], true ), var_export( $p['effective'], true ), var_export( $p['reason'], true ), var_export( $p['on_sale'], true ) );
	}
}
// مدت اعتبار از تنظیمات: با ۳ روز، قیمت ۴ روزه منقضی است.
update_option( CYH_PRICE_TTL_OPTION, 3 );
$ttl_p = cyh_product_pricing( $mk( 'p-ttl', [ 'price' => 5000 ], 'publish', 4 ), $now );
update_option( CYH_PRICE_TTL_OPTION, 10 );
if ( 'price_expired' !== $ttl_p['reason'] ) {
	$price_fail[] = 'مدت اعتبار از تنظیمات خوانده نشد (۳ روز، قیمت ۴ روزه باید منقضی باشد)';
}
if ( $price_fail ) {
	$errors[] = "cyh_product_pricing:\n   - " . implode( "\n   - ", $price_fail );
} else {
	echo '✓ cyh_product_pricing هر ' . ( count( $price_cases ) + 1 ) . " مورد مرزی را درست حساب کرد (تخفیف، روز آخر، موجودی، اعتبار، پیش‌نویس، مدت از تنظیمات)\n";
}

/* بررسی ۵۰: تاریخ قیمت فقط با تغییر *مقدار* جلو می‌رود — نه با ذخیره‌ی
   همان قیمت. وگرنه ذخیره‌ی نوشته برای اصلاح یک غلط تایپی، قیمت کهنه را
   «تازه» می‌کرد و قاعده‌ی اعتبار بی‌اثر می‌شد. */
$track_id = $mk( 'p-track', [ 'price' => 7000 ], 'publish', 20 );
update_post_meta( $track_id, 'price', 7000 );
$before = (int) get_post_meta( $track_id, CYH_PRICE_UPDATED_META, true );
cyh_price_track_change( '7000', $track_id, [ 'name' => 'price' ] );
$same_kept = (int) get_post_meta( $track_id, CYH_PRICE_UPDATED_META, true ) === $before;
cyh_price_track_change( '8000', $track_id, [ 'name' => 'price' ] );
$changed_moved = (int) get_post_meta( $track_id, CYH_PRICE_UPDATED_META, true ) > $before;
if ( ! $same_kept || ! $changed_moved ) {
	$errors[] = 'ردیابی تاریخ قیمت: ذخیره‌ی همان قیمت نباید تاریخ را جلو ببرد و قیمت تازه باید ببرد';
} else {
	echo "✓ تاریخ قیمت فقط با تغییر مقدار جلو می‌رود، نه با ذخیره‌ی دوباره‌ی همان قیمت\n";
}

/* بررسی ۵۱ (رگرسیون باگ استعلام): محصول پیش‌نویس «قیمت قطعی» نمی‌گیرد و
   نام قلم از وردپرس خوانده می‌شود، نه از مرورگر. */
delete_transient( 'cyh_rl_' . md5( '0.0.0.0' ) );
$q_before = count( $GLOBALS['cyh_test_posts'] );
$q = cyh_rest_submit_quote( new WP_REST_Request( [
	'name'    => 'خریدار',
	'phone'   => '09121234567',
	'website' => '',
	'items'   => [
		[ 'slug' => 'p-ok', 'name' => 'نام جعلی از مرورگر', 'qty' => 2 ],
		[ 'slug' => 'p-draft', 'qty' => 1 ],
	],
] ) );
$q_id    = max( array_keys( $GLOBALS['cyh_test_posts'] ) );
$q_items = get_post_meta( $q_id, 'cyh_items', true );
if (
	count( $GLOBALS['cyh_test_posts'] ) !== $q_before + 1
	|| ( $q_items[0]['name'] ?? '' ) !== 'محصول p-ok'
	|| ( $q_items[1]['buy_mode'] ?? '' ) !== 'rfq'
) {
	$errors[] = 'استعلام: نام باید از وردپرس بیاید و محصول پیش‌نویس نباید قیمت قطعی بگیرد';
} else {
	echo "✓ استعلام نام قلم را از وردپرس می‌خواند و به محصول پیش‌نویس قیمت نمی‌دهد\n";
}


// ═══════════════════════════════════════════════════════════════════════════
// بررسی ۵۲ تا ۵۸: صفحه‌ی «قیمت‌ها» (class-price-admin.php)
// ═══════════════════════════════════════════════════════════════════════════
$pa_id = $mk( 'pa-remote', [ 'price' => 12000000 ], 'publish', 20 );
update_field( 'price', 12000000, $pa_id );
update_field( 'stock_status', 'in_stock', $pa_id );
$pa_date = static function () use ( $pa_id ) { return (int) get_post_meta( $pa_id, CYH_PRICE_UPDATED_META, true ); };

// ۵۲: ارقام فارسی و جداکننده پذیرفته می‌شوند
$pa_parse = cyh_prices_parse_rial( '۱۲٬۵۰۰٬۰۰۰' ) === 12500000 && cyh_prices_parse_rial( '' ) === null && cyh_prices_parse_rial( '12,500,000' ) === 12500000;
if ( ! $pa_parse ) {
	$errors[] = 'cyh_prices_parse_rial ارقام فارسی/جداکننده را درست نخواند';
} else {
	echo "✓ قیمت با ارقام فارسی و جداکننده‌ی هزارگان درست خوانده می‌شود\n";
}

/* ۵۳ (خطای ۱۰ برابری): تغییر بیش از ٪۳۰ بدون تأیید صریح رد می‌شود — سمت
   سرور، نه فقط دیالوگ مرورگر. ۱۲ میلیون → ۱٫۲ میلیون (یک صفر کم). */
$before53 = $pa_date();
$r53 = cyh_prices_apply_row( $pa_id, [ 'action' => 'save', 'price' => '1200000', 'stock_status' => 'in_stock' ], 1 );
if ( $r53['ok'] || (int) get_post_meta( $pa_id, 'price', true ) !== 12000000 || $pa_date() !== $before53 ) {
	$errors[] = 'تغییر بیش از ٪۳۰ بدون تأیید باید رد شود و قیمت و تاریخ دست‌نخورده بمانند';
} else {
	echo "✓ تغییر بیش از ٪۳۰ (مثلاً یک صفر کم) بدون تأیید صریح ذخیره نمی‌شود\n";
}

// ۵۴: با تأیید صریح ذخیره و تاریخ تازه می‌شود
$r54 = cyh_prices_apply_row( $pa_id, [ 'action' => 'save', 'price' => '1200000', 'stock_status' => 'in_stock', 'confirm_big' => true ], 1 );
if ( ! $r54['ok'] || (int) get_post_meta( $pa_id, 'price', true ) !== 1200000 || $pa_date() <= $before53 ) {
	$errors[] = 'تغییر بزرگ با تأیید صریح باید ذخیره و تاریخ قیمت تازه شود';
} else {
	echo "✓ با تأیید صریح، تغییر بزرگ ذخیره و تاریخ قیمت تازه می‌شود\n";
}

// ۵۵: ذخیره‌ی همان قیمت، تاریخ را جلو نمی‌برد (فقط تغییر موجودی)
update_post_meta( $pa_id, CYH_PRICE_UPDATED_META, $now - 5 * $day );
$r55 = cyh_prices_apply_row( $pa_id, [ 'action' => 'save', 'price' => '1,200,000', 'stock_status' => 'on_order' ], 1 );
if ( ! $r55['ok'] || $pa_date() !== $now - 5 * $day || get_post_meta( $pa_id, 'stock_status', true ) !== 'on_order' ) {
	$errors[] = 'ذخیره‌ی همان قیمت نباید تاریخ را جلو ببرد؛ موجودی باید ذخیره شود';
} else {
	echo "✓ ذخیره‌ی همان قیمت تاریخ را جلو نمی‌برد؛ تغییر موجودی ذخیره می‌شود\n";
}

// ۵۶: «تأیید قیمت فعلی» تاریخ و تأییدکننده را ثبت می‌کند
$r56 = cyh_prices_apply_row( $pa_id, [ 'action' => 'confirm' ], 7 );
if ( ! $r56['ok'] || $pa_date() <= $now - 5 * $day || (int) get_post_meta( $pa_id, CYH_PRICE_CONFIRMED_META, true ) !== 7 ) {
	$errors[] = 'تأیید قیمت باید تاریخ و شناسه‌ی تأییدکننده را ثبت کند';
} else {
	echo "✓ «تأیید قیمت فعلی» تاریخ و نام تأییدکننده را ثبت می‌کند\n";
}

// ۵۷: محصول بی‌قیمت قابل «تأیید» نیست — تأییدِ هیچ، تأیید نیست
$pa_empty = $mk( 'pa-empty', [], 'publish', null );
$r57 = cyh_prices_apply_row( $pa_empty, [ 'action' => 'confirm' ], 1 );
if ( $r57['ok'] || '' !== get_post_meta( $pa_empty, CYH_PRICE_UPDATED_META, true ) ) {
	$errors[] = 'تأیید محصول بدون قیمت باید رد شود';
} else {
	echo "✓ محصول بدون قیمت قابل «تأیید» نیست\n";
}

/* ۵۸: شمارش توجه — فقط اقلام موجودِ قیمت‌دار. منقضی و «تا ۲ روز» جدا
   شمرده می‌شوند؛ ناموجود در شمارش نیست (از فروش آنلاین نمی‌افتد چون
   اصلاً در آن نبوده). */
$att_before = cyh_prices_attention( $now );
$mk( 'pa-soon', [ 'price' => 9000 ], 'publish', 9 );          // ۱ روز مانده
$mk( 'pa-gone', [ 'price' => 9000 ], 'publish', 30 );         // منقضی
$mk( 'pa-out', [ 'price' => 9000, 'stock_status' => 'on_order' ], 'publish', 30 ); // ناموجود
// $mk فیلدها را در cyh_test_fields می‌گذارد؛ cyh_product_pricing از get_field می‌خواند.
$att_after = cyh_prices_attention( $now );
if ( $att_after['soon'] - $att_before['soon'] !== 1 || $att_after['expired'] - $att_before['expired'] !== 1 ) {
	$errors[] = 'شمارش قیمت‌های نیازمند توجه: ' . wp_json_encode( [ $att_before, $att_after ] );
} else {
	echo "✓ بنر/ویجت: منقضی و «تا ۲ روز» درست شمرده می‌شوند؛ قلم ناموجود شمرده نمی‌شود\n";
}

/* ۵۹ (ایست ۲، فاز ۳ — دو سبد): مسیر استعلام حتی با اقلام تماماً قیمت‌دار
   «سفارش» نمی‌سازد. سفارش فقط از مسیر پرداخت آنلاین می‌آید؛ قلم قیمت‌داری
   که این‌جا می‌رسد با «دریافت پیش‌فاکتور» آمده.
   ⚠️ تاریخ قیمت نسبت به time() واقعی است، نه $now ثابت: endpoint با
   ساعت واقعی می‌سنجد و قیمتی که نسبت به $now تازه است، چند روز بعد از
   نوشتن این آزمون منقضی می‌شد و آزمون را بی‌صدا کور می‌کرد (قلم دیگر
   قیمت‌دار نبود، پس 'quote' به دلیل غلط درست درمی‌آمد). */
$q59_id = $mk( 'q-paid', [ 'price' => 7000000 ], 'publish', null );
update_post_meta( $q59_id, CYH_PRICE_UPDATED_META, time() - 3600 );
delete_transient( 'cyh_rl_' . md5( '0.0.0.0' ) );
$q59 = cyh_rest_submit_quote( new WP_REST_Request( [
	'name'    => 'خریدار',
	'phone'   => '09121234567',
	'website' => '',
	'items'   => [ [ 'slug' => 'q-paid', 'qty' => 2 ] ],
] ) );
$q59_post  = max( array_keys( $GLOBALS['cyh_test_posts'] ) );
$q59_items = get_post_meta( $q59_post, 'cyh_items', true );
if (
	( $q59_items[0]['buy_mode'] ?? '' ) !== 'cart'
	|| get_post_meta( $q59_post, 'cyh_kind', true ) !== 'quote'
	|| (float) get_post_meta( $q59_post, 'cyh_estimate', true ) !== 14000000.0
) {
	$errors[] = 'استعلام با اقلام تماماً قیمت‌دار باید «quote» بماند (با مبلغ تقریبی): ' . wp_json_encode( [ $q59_items, get_post_meta( $q59_post, 'cyh_kind', true ) ] );
} else {
	echo "✓ مسیر استعلام حتی با اقلام تماماً قیمت‌دار «سفارش» نمی‌سازد (سفارش فقط از پرداخت)\n";
}


// ═══════════════════════════════════════════════════════════════════════════
// بررسی ۶۰ تا ۸۰: پرداخت آنلاین (class-checkout.php، ایست ۲ فاز ۴ + اصلاح‌های UX)
// ═══════════════════════════════════════════════════════════════════════════
$co_check = static function ( $cond, $ok_msg, $err_msg ) use ( &$errors ) {
	if ( $cond ) {
		echo "✓ $ok_msg\n";
	} else {
		$errors[] = $err_msg;
	}
};
/* ⚠️ پرداخت مهمان ندارد (تصمیم کارفرما): همه‌ی فراخوانی‌های این بخش با توکن
   یک کاربر واقعی انجام می‌شوند. $co_as() هدر را برای یک کاربر می‌گذارد. */
$co_uid_a  = wp_insert_user( [ 'user_email' => 'co-a@example.com', 'user_pass' => 'abc12345', 'display_name' => 'خریدار الف' ] );
$co_uid_b  = wp_insert_user( [ 'user_email' => 'co-b@example.com', 'user_pass' => 'abc12345', 'display_name' => 'خریدار ب' ] );
$co_tok_a  = cyh_customer_issue_token( $co_uid_a );
$co_tok_b  = cyh_customer_issue_token( $co_uid_b );
$co_as     = static function ( $token ) {
	$GLOBALS['cyh_test_headers'] = null === $token ? [] : [ 'x-crane-token' => $token ];
};
$co_as( $co_tok_a );
$co_reset_rl = static function () {
	foreach ( array_keys( $GLOBALS['cyh_test_transients'] ?? [] ) as $k ) {
		if ( 0 === strpos( $k, 'cyh_corl_' ) ) {
			unset( $GLOBALS['cyh_test_transients'][ $k ] );
		}
	}
};

// ۶۰–۶۱: رقم کنترل. 0499370899 و 10380284790 طبق فرمول معتبرند؛ یک رقم
// تغییر = نامعتبر. ارقام فارسی پذیرفته می‌شوند (کیبورد فارسی).
$co_check(
	cyh_valid_national_code( '0499370899' ) && cyh_valid_national_code( '۰۴۹۹۳۷۰۸۹۹' )
		&& ! cyh_valid_national_code( '0499370898' ) && ! cyh_valid_national_code( '1111111111' )
		&& ! cyh_valid_national_code( '049937089' ),
	'کد ملی: رقم کنترل، ارقام فارسی، ده رقم یکسان و طول کوتاه',
	'اعتبارسنجی کد ملی نادرست است'
);
$co_check(
	cyh_valid_legal_id( '10380284790' ) && ! cyh_valid_legal_id( '10380284791' )
		&& ! cyh_valid_legal_id( '0499370899' ) && ! cyh_valid_legal_id( '11111111111' ),
	'شناسه ملی حقوقی: رقم کنترل ۱۱ رقمی',
	'اعتبارسنجی شناسه ملی نادرست است'
);

// ۶۲: فاکتور خاموش = نادیده (حتی با فیلد خراب)؛ روشن = همه اجباری.
[ $inv_off, $inv_off_err ] = cyh_checkout_validate_invoice( [ 'wanted' => false, 'national_id' => 'خراب' ] );
[ , $inv_err ]             = cyh_checkout_validate_invoice( [ 'wanted' => true, 'type' => 'legal' ] );
$co_check(
	null === $inv_off && [] === $inv_off_err && 7 === count( $inv_err ),
	'فاکتور رسمی: خاموش نادیده، روشن هر ۷ فیلد حقوقی اجباری',
	'اعتبارسنجی فاکتور: ' . wp_json_encode( [ $inv_off, $inv_off_err, array_keys( $inv_err ) ] )
);

// ۶۳: مالیات فقط با فاکتور رسمی.
$t_off = cyh_checkout_totals( 1000000, false, 10 );
$t_on  = cyh_checkout_totals( 1000000, true, 10 );
$co_check(
	0 === $t_off['vat'] && 1000000 === $t_off['total'] && 100000 === $t_on['vat'] && 1100000 === $t_on['total'],
	'ارزش افزوده: ۰ بدون فاکتور، ۱۰٪ با فاکتور',
	'محاسبه‌ی مالیات: ' . wp_json_encode( [ $t_off, $t_on ] )
);

// ۶۴: نشست — قلم پرداخت‌ناپذیر جدا می‌شود، تکراری ادغام می‌شود.
// ⚠️ تاریخ قیمت نسبت به time() واقعی (همان دلیل بررسی ۵۹).
$co_id = $mk( 'co-remote', [ 'price' => 3000000 ], 'publish', null );
update_post_meta( $co_id, CYH_PRICE_UPDATED_META, time() - 3600 );
$co_reset_rl();
$co_sess = cyh_rest_checkout_session( new WP_REST_Request( [
	'items' => [
		[ 'slug' => 'co-remote', 'qty' => 1 ],
		[ 'slug' => 'co-remote', 'qty' => 2 ],
		[ 'slug' => 'p-rfq', 'qty' => 1 ],
		[ 'slug' => 'p-draft', 'qty' => 1 ],
	],
] ) )->get_data();
$co_check(
	1 === count( $co_sess['lines'] ) && 3 === $co_sess['lines'][0]['qty'] && 9000000 === $co_sess['subtotal']
		&& 2 === count( $co_sess['moved'] ) && '' !== (string) $co_sess['session'],
	'نشست پرداخت: قلم استعلامی/پیش‌نویس جدا، تکراری ادغام، جمع از قیمت سرور',
	'نشست پرداخت: ' . wp_json_encode( $co_sess )
);

// ۶۵: بدون merchant ID → ۵۰۳، و هیچ سفارشی ساخته نمی‌شود.
$co_customer = [
	'name'     => 'خریدار آزمون',
	'phone'    => '۰۹۱۲۱۲۳۴۵۶۷',
	'province' => 'تهران',
	'city'     => 'تهران',
	'address'  => 'خیابان آزادی، کوچه‌ی یک، پلاک ۲',
	'postal'   => '1234567891',
];
$co_pay = static function ( $session, $invoice = [ 'wanted' => false ], $shipping = 'tipax' ) use ( $co_customer ) {
	return cyh_rest_checkout_pay( new WP_REST_Request( [
		'session'  => $session,
		'customer' => $co_customer,
		'invoice'  => $invoice,
		'shipping' => $shipping,
		'terms'    => true,
		'website'  => '',
	] ) );
};
delete_option( CYH_ZP_MERCHANT_OPTION );
$co_posts_before = count( $GLOBALS['cyh_test_posts'] );
$co_r65          = $co_pay( $co_sess['session'] );
$co_check(
	503 === $co_r65->get_status() && count( $GLOBALS['cyh_test_posts'] ) === $co_posts_before,
	'درگاه پیکربندی‌نشده: ۵۰۳ بدون ساختن سفارش',
	'بدون merchant باید ۵۰۳ بدهد و سفارش نسازد (status ' . $co_r65->get_status() . ')'
);

/* ۶۶ (تصمیم کارفرما — قیمت نشان‌داده‌شده محترم است): قیمت در پنل پس از
   باز شدن صفحه‌ی پرداخت عوض می‌شود؛ مبلغ ارسالی به زرین‌پال همان عکس نشست
   است. sandbox پیش‌فرض است. */
update_option( CYH_ZP_MERCHANT_OPTION, '11111111-2222-3333-4444-555555555555' );
update_field( 'price', 9900000, $co_id );
$GLOBALS['cyh_test_remote_post_calls'] = [];
$GLOBALS['cyh_test_remote_queue']      = [ [ 'data' => [ 'code' => 100, 'authority' => 'S000000000000000000000000000000abcd' ], 'errors' => [] ] ];
$co_r66  = $co_pay( $co_sess['session'] );
$co_req  = json_decode( $GLOBALS['cyh_test_remote_post_calls'][0]['args']['body'] ?? '{}', true );
$co_data = $co_r66->get_data();
$co_oid  = max( array_keys( $GLOBALS['cyh_test_posts'] ) );
$co_check(
	200 === $co_r66->get_status() && 9000000 === ( $co_req['amount'] ?? null ) && 'IRR' === ( $co_req['currency'] ?? '' )
		&& 0 === strpos( $GLOBALS['cyh_test_remote_post_calls'][0]['url'], 'https://sandbox.zarinpal.com/pg/v4/payment/request.json' )
		&& 'https://sandbox.zarinpal.com/pg/StartPay/S000000000000000000000000000000abcd' === ( $co_data['redirect'] ?? '' )
		&& 'pending' === get_post_meta( $co_oid, 'cyh_payment', true ) && 'order' === get_post_meta( $co_oid, 'cyh_kind', true )
		&& '09121234567' === get_post_meta( $co_oid, 'cyh_phone', true ),
	'قیمت عکس نشست محترم است (تغییر پنل وسط پرداخت اثر ندارد)؛ sandbox، IRR، StartPay',
	'پرداخت: ' . wp_json_encode( [ $co_r66->get_status(), $co_req, $co_data ] )
);

// ۶۷: نشست یک‌بارمصرف — پس از گرفتن authority، همان نشست ۴۱۰ می‌دهد.
$co_check(
	410 === $co_pay( $co_sess['session'] )->get_status() && 410 === $co_pay( 'ساختگی' )->get_status(),
	'نشست پرداخت یک‌بارمصرف است؛ نشست ساختگی ۴۱۰',
	'استفاده‌ی دوباره از نشست پرداخت باید ۴۱۰ بدهد'
);

/* ۶۸: authority سفارش دیگر (یا جعلی) سفارش را نمی‌بندد — حتی با Status=OK
   و حتی اگر زرین‌پال برای آن authority «موفق» بگوید. */
$co_code = get_post_meta( $co_oid, 'cyh_code', true );
$GLOBALS['cyh_test_remote_post_calls'] = [];
$GLOBALS['cyh_test_remote_queue']      = [ [ 'data' => [ 'code' => 100, 'ref_id' => 999 ], 'errors' => [] ] ];
$co_r68 = cyh_checkout_complete( $co_code, 'S-someone-elses-authority' );
$co_check(
	'error' === $co_r68['result'] && 'pending' === get_post_meta( $co_oid, 'cyh_payment', true ) && 0 === count( $GLOBALS['cyh_test_remote_post_calls'] ),
	'authority نادرست: بدون verify، سفارش پرداخت‌نشده می‌ماند',
	'authority نادرست نباید سفارش را ببندد: ' . wp_json_encode( $co_r68 )
);
$GLOBALS['cyh_test_remote_queue'] = [];

// ۶۹: قفل گرفته‌شده (پردازش هم‌زمان) → pending بدون verify دوم.
add_option( 'cyh_zp_lock_' . $co_oid, time() );
$co_r69 = cyh_checkout_complete( $co_code, 'S000000000000000000000000000000abcd' );
$co_check(
	'pending' === $co_r69['result'] && 0 === count( $GLOBALS['cyh_test_remote_post_calls'] ),
	'callback هم‌زمان: قفل، verify دوم نمی‌رود',
	'قفل callback کار نکرد: ' . wp_json_encode( $co_r69 )
);
delete_option( 'cyh_zp_lock_' . $co_oid );

// ۷۰: شبکه قطع → «در انتظار» (نه ناموفق — شاید پول کسر شده)؛ سپس verify
// موفق → پرداخت‌شده؛ callback دوباره (رفرش) → ok بدون verify و ایمیل دوم.
$GLOBALS['cyh_test_remote_queue'] = [ new WP_Error( 'http_request_failed', 'timeout' ) ];
$co_r70a = cyh_checkout_complete( $co_code, 'S000000000000000000000000000000abcd' );
$co_mail_before = count( $GLOBALS['cyh_test_mail_calls'] );
$GLOBALS['cyh_test_remote_post_calls'] = [];
$GLOBALS['cyh_test_remote_queue']      = [ [ 'data' => [ 'code' => 100, 'ref_id' => 201, 'card_pan' => '502229******5995' ], 'errors' => [] ] ];
$co_r70b  = cyh_checkout_complete( $co_code, 'S000000000000000000000000000000abcd' );
$co_verify = json_decode( $GLOBALS['cyh_test_remote_post_calls'][0]['args']['body'] ?? '{}', true );
$co_r70c  = cyh_checkout_complete( $co_code, 'S000000000000000000000000000000abcd' );
$co_check(
	'pending' === $co_r70a['result']
		&& 'ok' === $co_r70b['result'] && 9000000 === ( $co_verify['amount'] ?? null )
		&& 'paid' === get_post_meta( $co_oid, 'cyh_payment', true ) && '201' === get_post_meta( $co_oid, 'cyh_ref_id', true )
		&& 'ok' === $co_r70c['result'] && 1 === count( $GLOBALS['cyh_test_remote_post_calls'] )
		&& count( $GLOBALS['cyh_test_mail_calls'] ) === $co_mail_before + 2
		&& false !== strpos( $co_r70b['url'], '/checkout/result?r=ok&code=' ) && false === get_option( 'cyh_zp_lock_' . $co_oid ),
	'verify: شبکه‌ی قطع = در انتظار؛ کد ۱۰۰ = پرداخت‌شده با مبلغ سفارش؛ دو ایمیل (داخلی + مشتری)، رفرش بدون verify و بدون ایمیل تازه؛ قفل آزاد',
	'verify: ' . wp_json_encode( [ $co_r70a, $co_r70b, $co_r70c, $co_verify, count( $GLOBALS['cyh_test_remote_post_calls'] ) ] )
);

// ۷۱: فاکتور رسمی → +۱۰٪ در مبلغ درگاه؛ verify ناموفق (‎-51) → ناموفق.
$co_reset_rl();
$co_sess2 = cyh_rest_checkout_session( new WP_REST_Request( [ 'items' => [ [ 'slug' => 'co-remote', 'qty' => 1 ] ] ] ) )->get_data();
$GLOBALS['cyh_test_remote_post_calls'] = [];
$GLOBALS['cyh_test_remote_queue']      = [ [ 'data' => [ 'code' => 100, 'authority' => 'S0000000000000000000000000000000vat' ], 'errors' => [] ] ];
$co_r71 = $co_pay(
	$co_sess2['session'],
	[
		'wanted'        => true,
		'type'          => 'legal',
		'name'          => 'شرکت آزمون',
		'national_id'   => '10380284790',
		'economic_code' => '411111111111',
		'reg_no'        => '12345',
		'postal'        => '1234567891',
		'address'       => 'تهران، خیابان آزادی، پلاک ۲',
		'landline'      => '02146876980',
	]
);
$co_req71 = json_decode( $GLOBALS['cyh_test_remote_post_calls'][0]['args']['body'] ?? '{}', true );
$co_oid71 = max( array_keys( $GLOBALS['cyh_test_posts'] ) );
$GLOBALS['cyh_test_remote_queue'] = [ [ 'data' => [], 'errors' => [ 'code' => -51, 'message' => 'Session is not valid' ] ] ];
$co_r71v = cyh_checkout_complete( get_post_meta( $co_oid71, 'cyh_code', true ), 'S0000000000000000000000000000000vat' );
$co_check(
	200 === $co_r71->get_status() && 10890000 === ( $co_req71['amount'] ?? null )
		&& 'fail' === $co_r71v['result'] && 'failed' === get_post_meta( $co_oid71, 'cyh_payment', true )
		&& '-51' === get_post_meta( $co_oid71, 'cyh_pay_error', true ),
	'فاکتور رسمی: ۱۰٪ در مبلغ درگاه (۹٬۹۰۰٬۰۰۰ → ۱۰٬۸۹۰٬۰۰۰)؛ خطای verify (errors.code) = ناموفق',
	'فاکتور/verify ناموفق: ' . wp_json_encode( [ $co_r71->get_data(), $co_req71, $co_r71v ] )
);
$GLOBALS['cyh_test_remote_queue'] = [];

// ۷۲: بدون توکن (مهمان) → ۴۰۱ روی نشست و پرداخت؛ هیچ سفارشی ساخته نمی‌شود
// و درگاه صدا زده نمی‌شود. توکن ساختگی هم همین‌طور.
$co_reset_rl();
$co_posts_before = count( $GLOBALS['cyh_test_posts'] );
$GLOBALS['cyh_test_remote_post_calls'] = [];
$co_guest = [];
foreach ( [ null, 'توکن-ساختگی' ] as $co_bad_token ) {
	$co_as( $co_bad_token );
	$co_guest[] = cyh_rest_checkout_session( new WP_REST_Request( [ 'items' => [ [ 'slug' => 'co-remote', 'qty' => 1 ] ] ] ) )->get_status();
	$co_guest[] = $co_pay( $co_sess2['session'] )->get_status();
}
$co_check(
	[ 401, 401, 401, 401 ] === $co_guest && count( $GLOBALS['cyh_test_posts'] ) === $co_posts_before
		&& 0 === count( $GLOBALS['cyh_test_remote_post_calls'] ),
	'پرداخت مهمان ندارد: بدون توکن/توکن ساختگی ۴۰۱ روی نشست و پرداخت، بدون سفارش و بدون تماس با درگاه',
	'مهمان باید ۴۰۱ بگیرد: ' . wp_json_encode( $co_guest )
);
$co_as( $co_tok_a );

// ۷۳: روش ارسال اجباری و فقط از فهرست؛ خطای ۴۰۰ با errors.shipping.
$co_reset_rl();
$co_sess3 = cyh_rest_checkout_session( new WP_REST_Request( [ 'items' => [ [ 'slug' => 'co-remote', 'qty' => 1 ] ] ] ) )->get_data();
$co_ship_bad = [];
foreach ( [ '', 'ساختگی', 'TIPAX', null, [ 'tipax' ] ] as $co_bad_ship ) {
	$co_r = $co_pay( $co_sess3['session'], [ 'wanted' => false ], $co_bad_ship );
	$co_ship_bad[] = [ $co_r->get_status(), isset( $co_r->get_data()['errors']['shipping'] ) ];
}
$co_check(
	array_fill( 0, 5, [ 400, true ] ) === $co_ship_bad && count( $GLOBALS['cyh_test_posts'] ) === $co_posts_before,
	'روش ارسال: خالی/ناشناخته/حرف بزرگ/آرایه = ۴۰۰ با errors.shipping، بدون سفارش (نشست مصرف نمی‌شود)',
	'ارسال نامعتبر باید رد شود: ' . wp_json_encode( $co_ship_bad )
);

// ۷۴: هر چهار روش پذیرفته و *متن کامل برچسب* در سفارش ثبت می‌شود
// (شرط حقوقی روش هوایی). مبلغ ارسال در جمع صفر است.
$co_ship_ok = [];
foreach ( cyh_shipping_methods() as $co_code_s => $co_label_s ) {
	$co_reset_rl();
	$co_s = cyh_rest_checkout_session( new WP_REST_Request( [ 'items' => [ [ 'slug' => 'co-remote', 'qty' => 1 ] ] ] ) )->get_data();
	$GLOBALS['cyh_test_remote_queue'] = [ [ 'data' => [ 'code' => 100, 'authority' => 'S000000000000000000000000000000' . $co_code_s ], 'errors' => [] ] ];
	$co_rs  = $co_pay( $co_s['session'], [ 'wanted' => false ], $co_code_s );
	$co_oid_s = max( array_keys( $GLOBALS['cyh_test_posts'] ) );
	$co_ship_ok[ $co_code_s ] = 200 === $co_rs->get_status()
		&& $co_code_s === get_post_meta( $co_oid_s, 'cyh_shipping', true )
		&& $co_label_s === get_post_meta( $co_oid_s, 'cyh_shipping_label', true )
		&& (int) get_post_meta( $co_oid_s, 'cyh_total', true ) === (int) get_post_meta( $co_oid_s, 'cyh_subtotal', true );
}
$co_air = cyh_shipping_methods()['air'] ?? '';
$co_check(
	4 === count( $co_ship_ok ) && ! in_array( false, $co_ship_ok, true )
		&& false !== strpos( $co_air, 'مشروط به وضعیت نرمال مرزها و پروازها' ) && false !== strpos( $co_air, 'پس‌کرایه' ),
	'هر ۴ روش ارسال (تیپاکس/اتوبوس/باربری/هوایی) ثبت می‌شود؛ برچسب کامل هوایی با شرط مرز و پرواز در سفارش؛ ارسال در جمع ۰',
	'روش‌های ارسال: ' . wp_json_encode( [ $co_ship_ok, $co_air ] )
);
$GLOBALS['cyh_test_remote_queue'] = [];

// ۷۵: مالیات دقیق — گرد کردن فقط روی جمع نهایی؛ vat = total − sub همیشه.
// موارد مرزی عیناً در checkout.test.mts هم اجرا می‌شوند.
$co_vat_cases = [
	// [sub, rate, انتظار total]
	[ 19999998, 10, 21999998 ],
	[ 1000000, 10, 1100000 ],
	[ 5, 10, 6 ],          // ۵٫۵ → ۶ (نیم به بالا)
	[ 15, 10, 17 ],        // ۱۶٫۵ → ۱۷
	[ 1, 10, 1 ],          // ۱٫۱ → ۱
	[ 333333, 9, 363333 ], // ۳۶۳۳۳۲٫۹۷ → ۳۶۳۳۳۳
	[ 0, 10, 0 ],
];
$co_vat_bad = [];
foreach ( $co_vat_cases as [ $co_sub, $co_rate, $co_exp ] ) {
	$co_t = cyh_checkout_totals( $co_sub, true, $co_rate );
	if ( $co_exp !== $co_t['total'] || $co_t['vat'] !== $co_t['total'] - $co_sub || $co_sub !== $co_t['subtotal'] ) {
		$co_vat_bad[] = [ $co_sub, $co_rate, $co_t ];
	}
}
$co_check(
	[] === $co_vat_bad,
	'مالیات دقیق: جمع = گرد(sub×(۱۰۰+نرخ)÷۱۰۰)، vat = جمع − sub؛ ۷ مورد مرزی (نیم، ۰، ۱)',
	'محاسبه‌ی مالیات: ' . wp_json_encode( $co_vat_bad )
);

// ⚠️ سفارش ناموفق با ref_id بازمانده (مثلاً تلاش قبلی) نباید شماره‌ی پیگیری نشان دهد.
update_post_meta( $co_oid71, 'cyh_ref_id', '999' );

// ۷۶: /account/orders — فقط سفارش‌های خودِ کاربر: نه سفارش کاربر دیگر،
// نه استعلام (بدون نویسنده)، و بدون توکن ۴۰۱. کاربر ب سفارشی ندارد.
$co_own = cyh_rest_account_orders( new WP_REST_Request( [] ) );
$co_own_codes = is_wp_error( $co_own ) ? [] : array_column( $co_own['orders'], 'code' );
$co_quote_id = wp_insert_post( [ 'post_type' => 'cyh_quote', 'post_status' => 'publish', 'post_title' => 'استعلام', 'post_author' => $co_uid_a ] );
update_post_meta( $co_quote_id, 'cyh_kind', 'quote' );
update_post_meta( $co_quote_id, 'cyh_code', 'Q-NOT-AN-ORDER' );
$co_as( $co_tok_b );
$co_other = cyh_rest_account_orders( new WP_REST_Request( [] ) );
$co_as( null );
$co_noauth = cyh_rest_account_orders( new WP_REST_Request( [] ) );
$co_as( $co_tok_a );
$co_own2 = cyh_rest_account_orders( new WP_REST_Request( [] ) );
$co_first = $co_own2['orders'][0] ?? [];
$co_check(
	! is_wp_error( $co_own ) && count( $co_own_codes ) >= 6 && in_array( $co_code, $co_own_codes, true )
		&& ! in_array( 'Q-NOT-AN-ORDER', array_column( $co_own2['orders'], 'code' ), true )
		&& ! is_wp_error( $co_other ) && [] === $co_other['orders']
		&& is_wp_error( $co_noauth ) && 401 === ( $co_noauth->get_error_data()['status'] ?? null )
		&& isset( $co_first['paymentLabel'], $co_first['items'], $co_first['shipping'], $co_first['total'], $co_first['sandbox'] ),
	'/account/orders: فقط سفارش‌های خود کاربر (نه دیگری، نه استعلام)؛ بدون توکن ۴۰۱؛ فیلدهای وضعیت/اقلام/ارسال',
	'/account/orders: ' . wp_json_encode( [ $co_own_codes, $co_other, is_wp_error( $co_noauth ), $co_first ] )
);

// ۷۷: refId فقط برای سفارش پرداخت‌شده؛ پرداخت‌نشده‌ها refId خالی دارند.
$co_by = [];
foreach ( $co_own2['orders'] as $co_o ) { $co_by[ $co_o['code'] ] = $co_o; }
$co_check(
	'paid' === ( $co_by[ $co_code ]['payment'] ?? '' ) && '201' === ( $co_by[ $co_code ]['refId'] ?? '' )
		&& 'failed' === ( $co_by[ get_post_meta( $co_oid71, 'cyh_code', true ) ]['payment'] ?? '' )
		&& '' === ( $co_by[ get_post_meta( $co_oid71, 'cyh_code', true ) ]['refId'] ?? 'x' ),
	'/account/orders: پرداخت‌شده refId دارد، ناموفق/در انتظار ندارد',
	'refId سفارش‌ها: ' . wp_json_encode( $co_by )
);
$GLOBALS['cyh_test_headers'] = [];

// ۷۸-۸۰: پنل — «سفارش‌ها» جدا از «درخواست‌های استعلام»
$_GET = [];
$GLOBALS['cyh_test_is_admin'] = true;
$q_ord = new WP_Query( [ 'post_type' => CYH_QUOTE_CPT ] );
$_GET['cyh_view'] = 'orders';
cyh_quote_admin_filter_query( $q_ord );
$q_quo = new WP_Query( [ 'post_type' => CYH_QUOTE_CPT ] );
$_GET = [];
cyh_quote_admin_filter_query( $q_quo );
$q_other = new WP_Query( [ 'post_type' => 'product' ] );
cyh_quote_admin_filter_query( $q_other );
$q_sub = new WP_Query( [ 'post_type' => CYH_QUOTE_CPT ], false );
cyh_quote_admin_filter_query( $q_sub );
$_GET = [ 'cyh_view' => 'ORDERS' ];
$q_bad = new WP_Query( [ 'post_type' => CYH_QUOTE_CPT ] );
cyh_quote_admin_filter_query( $q_bad );
$_GET = [];
$co_check(
	[ [ 'key' => 'cyh_payment', 'compare' => 'EXISTS' ] ] === $q_ord->get( 'meta_query' )
		&& [ [ 'key' => 'cyh_payment', 'compare' => 'NOT EXISTS' ] ] === $q_quo->get( 'meta_query' ),
	'پنل: cyh_view=orders فقط سفارش‌های دارای cyh_payment؛ پیش‌فرض فقط استعلام (NOT EXISTS)',
	'meta_query: ' . wp_json_encode( [ $q_ord->get( 'meta_query' ), $q_quo->get( 'meta_query' ) ] )
);
$co_check(
	'' === $q_other->get( 'meta_query' ) && '' === $q_sub->get( 'meta_query' )
		&& [ [ 'key' => 'cyh_payment', 'compare' => 'NOT EXISTS' ] ] === $q_bad->get( 'meta_query' ),
	'پنل: نوع پست دیگر و کوئری فرعی دست‌نخورده؛ مقدار ناشناخته (ORDERS) به استعلام برمی‌گردد',
	'other/sub/bad: ' . wp_json_encode( [ $q_other->get( 'meta_query' ), $q_sub->get( 'meta_query' ), $q_bad->get( 'meta_query' ) ] )
);

// ستون‌ها و زبانه‌ها
$_GET = [ 'cyh_view' => 'orders' ];
$cols_orders = cyh_orders_columns( [ 'cb' => 'x', 'title' => 't' ] );
$views_orders = cyh_quote_views( [ 'all' => 'a', 'publish' => 'p', 'trash' => 'T' ] );
$_GET = [];
$cols_quotes = cyh_orders_columns( [ 'cb' => 'x', 'title' => 't', 'cyh_items' => 'i' ] );
$views_quotes = cyh_quote_views( [ 'all' => 'a' ] );
$co_check(
	isset( $cols_orders['cyh_pay'], $cols_orders['cyh_total'], $cols_orders['cyh_ref'] ) && ! isset( $cols_quotes['cyh_pay'] ) && isset( $cols_quotes['cyh_items'] ),
	'پنل: ستون‌های پرداخت/مبلغ/شماره پیگیری فقط در فهرست سفارش‌ها',
	'ستون‌ها: ' . wp_json_encode( [ array_keys( $cols_orders ), array_keys( $cols_quotes ) ] )
);
$co_check(
	array_keys( $views_orders ) === [ 'cyh_quotes', 'cyh_orders', 'trash' ]
		&& false !== strpos( $views_orders['cyh_orders'], 'class="current"' ) && false === strpos( $views_orders['cyh_quotes'], 'current' )
		&& false !== strpos( $views_orders['cyh_orders'], 'cyh_view=orders' ) && false === strpos( $views_orders['cyh_quotes'], 'cyh_view' )
		&& false !== strpos( $views_quotes['cyh_quotes'], 'class="current"' ) && ! isset( $views_quotes['trash'] ),
	'پنل: دو زبانه‌ی «استعلام‌ها» و «سفارش‌ها»؛ زبانه‌ی فعال درست، سطل زباله حفظ',
	'views: ' . wp_json_encode( [ $views_orders, $views_quotes ] )
);

// منوی سفارش‌ها + ستون پرداخت + جزئیات
$GLOBALS['cyh_test_menus'] = [];
cyh_orders_menu();
$co_check(
	isset( $GLOBALS['cyh_test_menus'][ 'edit.php?post_type=' . CYH_QUOTE_CPT . '&cyh_view=orders' ] ),
	'پنل: منوی سطح‌بالای «سفارش‌ها» ثبت شد',
	'منوها: ' . wp_json_encode( array_keys( $GLOBALS['cyh_test_menus'] ) )
);
$_GET = [ 'post' => (string) $co_oid71 ];
$co_pf_order = cyh_orders_parent_file( 'edit.php?post_type=' . CYH_QUOTE_CPT );
$_GET = [ 'post' => '1' ];
$GLOBALS['cyh_test_posts'][1] = [ 'post_type' => CYH_QUOTE_CPT, 'post_status' => 'publish', 'post_title' => 'q' ];
$co_pf_quote = cyh_orders_parent_file( 'edit.php?post_type=' . CYH_QUOTE_CPT );
$_GET = [];
$co_check(
	'edit.php?post_type=' . CYH_QUOTE_CPT . '&cyh_view=orders' === $co_pf_order && 'edit.php?post_type=' . CYH_QUOTE_CPT === $co_pf_quote,
	'پنل: ویرایش یک سفارش منوی «سفارش‌ها» را فعال می‌کند، ویرایش استعلام منوی استعلام را',
	'parent_file: ' . wp_json_encode( [ $co_pf_order, $co_pf_quote ] )
);
ob_start();
cyh_orders_column_content( 'cyh_pay', $co_oid71 );
$pay_html = ob_get_clean();
ob_start();
cyh_orders_column_content( 'cyh_ref', $co_oid71 );
$ref_html = ob_get_clean();
$GLOBALS['cyh_test_metaboxes'] = [];
cyh_order_metabox( CYH_QUOTE_CPT, (object) [ 'ID' => $co_oid71 ] );
$has_box = isset( $GLOBALS['cyh_test_metaboxes']['cyh_order_details'] );
$GLOBALS['cyh_test_metaboxes'] = [];
cyh_order_metabox( CYH_QUOTE_CPT, (object) [ 'ID' => 1 ] );
$has_box_quote = isset( $GLOBALS['cyh_test_metaboxes']['cyh_order_details'] );
$co_check(
	false !== strpos( $pay_html, 'ناموفق' ) && false !== strpos( $ref_html, '—' ) && false === strpos( $ref_html, '<code>' ) && $has_box && ! $has_box_quote,
	'پنل: ستون پرداخت وضعیت را نشان می‌دهد، شماره پیگیری فقط برای پرداخت‌شده؛ جعبه‌ی سفارش فقط روی سفارش',
	"pay=$pay_html ref=$ref_html box=" . var_export( $has_box, true ) . ' quote_box=' . var_export( $has_box_quote, true )
);
$GLOBALS['cyh_test_is_admin'] = false;

// ۸۱: تاریخ شمسی — نوروز ۱۴۰۴ و ۱۴۰۵، آخر سال کبیسه‌ی ۱۴۰۳ و تاریخ سفارش واقعی
// آزمون کارفرما (۲۰۲۶-۰۹-۲۹ = ۱۴۰۵/۰۷/۰۷). ورودی نامعتبر = ''.
$co_check(
	[ 1405, 7, 7 ] === cyh_gregorian_to_jalali( 2026, 9, 29 )
		&& [ 1405, 1, 1 ] === cyh_gregorian_to_jalali( 2026, 3, 21 )
		&& [ 1404, 12, 29 ] === cyh_gregorian_to_jalali( 2026, 3, 20 )
		&& [ 1404, 1, 1 ] === cyh_gregorian_to_jalali( 2025, 3, 21 )
		&& [ 1403, 12, 30 ] === cyh_gregorian_to_jalali( 2025, 3, 20 )
		&& [ 1403, 1, 1 ] === cyh_gregorian_to_jalali( 2024, 3, 20 ) && [ 1402, 12, 11 ] === cyh_gregorian_to_jalali( 2024, 3, 1 ) && [ 1402, 12, 10 ] === cyh_gregorian_to_jalali( 2024, 2, 29 )
		&& '۱۴۰۵/۰۷/۰۷' === cyh_jalali_date_string( '2026-09-29' ) && '' === cyh_jalali_date_string( 'بی‌معنی' ) && '' === cyh_jalali_date_string( '2026-13-01' )
		&& '۲۴٬۱۹۹٬۹۹۸' === cyh_fa_number( 24199998 ),
	'تاریخ شمسی و قالب عدد فارسی: نوروز، سال کبیسه، تاریخ واقعی سفارش، ورودی نامعتبر',
	'شمسی: ' . wp_json_encode( [ cyh_gregorian_to_jalali( 2026, 9, 29 ), cyh_gregorian_to_jalali( 2026, 3, 21 ), cyh_gregorian_to_jalali( 2026, 3, 20 ), cyh_gregorian_to_jalali( 2025, 3, 21 ), cyh_gregorian_to_jalali( 2025, 3, 20 ) ] )
);

// ۸۲: محتوای فاکتور — اعداد سفارش، بدون ردیف مالیات وقتی فاکتور رسمی نخواسته،
// هشدار «رسمی نیست»، و escape نام کالا/نشانی (XSS).
$co_evil_id = 8801;
$GLOBALS['cyh_test_posts'][ $co_evil_id ] = [ 'post_type' => CYH_QUOTE_CPT, 'post_status' => 'publish', 'post_title' => 'evil', 'post_author' => $co_uid_a ];
foreach ( [
	'cyh_code' => 'CY-EVIL01', 'cyh_payment' => 'paid', 'cyh_ref_id' => '777', 'cyh_subtotal' => 1000000, 'cyh_vat' => 0, 'cyh_total' => 1000000,
	'cyh_vat_rate' => 0, 'cyh_shipping_label' => 'تیپاکس', 'cyh_sandbox' => 0, 'cyh_return_origin' => 'https://craneyadak.com',
	'cyh_customer' => [ 'name' => '<b>x</b>', 'phone' => '09121234567', 'province' => 'تهران', 'city' => 'تهران', 'address' => '<script>alert(1)</script> خیابان', 'postal' => '1234567891', 'email' => '' ],
	'cyh_items' => [ [ 'name' => '<img src=x onerror=alert(1)>', 'sku' => 'A-1', 'qty' => 2, 'unit' => 500000, 'total' => 1000000 ] ],
] as $co_k => $co_v ) {
	update_post_meta( $co_evil_id, $co_k, $co_v );
}
$co_inv_plain = cyh_order_invoice_html( $co_evil_id );
update_post_meta( $co_evil_id, 'cyh_invoice', [ 'wanted' => true, 'type' => 'real' ] );
update_post_meta( $co_evil_id, 'cyh_vat', 100000 );
update_post_meta( $co_evil_id, 'cyh_vat_rate', 10 );
update_post_meta( $co_evil_id, 'cyh_total', 1100000 );
$co_inv_off = cyh_order_invoice_html( $co_evil_id );
update_post_meta( $co_evil_id, 'cyh_sandbox', 1 );
$co_inv_sbx = cyh_order_invoice_html( $co_evil_id );
update_post_meta( $co_evil_id, 'cyh_sandbox', 0 );
$co_check(
	false === strpos( $co_inv_plain, '<script' ) && false === strpos( $co_inv_plain, '<img' ) && false !== strpos( $co_inv_plain, '&lt;script&gt;' )
		&& false !== strpos( $co_inv_plain, 'CY-EVIL01' ) && false !== strpos( $co_inv_plain, '۱٬۰۰۰٬۰۰۰' ) && false !== strpos( $co_inv_plain, '۵۰۰٬۰۰۰' )
		&& false === strpos( $co_inv_plain, 'ارزش افزوده' ) && false !== strpos( $co_inv_plain, 'فاکتور رسمی نیست' ) && false === strpos( $co_inv_plain, 'حالت آزمایشی' )
		&& false !== strpos( $co_inv_sbx, 'حالت آزمایشی' )
		&& false !== strpos( $co_inv_off, 'ارزش افزوده (۱۰٪)' ) && false !== strpos( $co_inv_off, '۱٬۱۰۰٬۰۰۰' ) && false !== strpos( $co_inv_off, 'جداگانه از سوی واحد مالی' ),
	'فاکتور: اعداد سفارش، هشدار «رسمی نیست»؛ ردیف مالیات و جمله‌ی فاکتور رسمی فقط با درخواست فاکتور رسمی؛ HTML کالا/نشانی escape',
	'فاکتور: ' . $co_inv_plain
);

// ۸۳: مسیر /account/invoice — مهمان ۴۰۱؛ سفارش خود کاربر ۲۰۰ با html؛ سفارش
// دیگری، پرداخت‌نشده و کد ناشناخته همگی ۴۰۴ با پیام یکسان.
$co_inv_req = static function ( $code ) {
	return cyh_rest_account_invoice( new WP_REST_Request( [ 'code' => $code ] ) );
};
$co_as( null );
$co_inv_guest = $co_inv_req( 'CY-EVIL01' );
$co_as( $co_tok_a );
$co_inv_own   = $co_inv_req( 'cy-evil01' );
$co_inv_fail  = $co_inv_req( get_post_meta( $co_oid71, 'cyh_code', true ) );
$co_inv_none  = $co_inv_req( 'CY-NOPE99' );
$co_as( $co_tok_b );
$co_inv_other = $co_inv_req( 'CY-EVIL01' );
$co_as( $co_tok_a );
$co_check(
	is_wp_error( $co_inv_guest ) && 401 === ( $co_inv_guest->get_error_data()['status'] ?? 0 )
		&& ! is_wp_error( $co_inv_own ) && 'CY-EVIL01' === ( $co_inv_own['code'] ?? '' ) && false !== strpos( (string) ( $co_inv_own['html'] ?? '' ), 'CY-EVIL01' )
		&& is_wp_error( $co_inv_fail ) && is_wp_error( $co_inv_none ) && is_wp_error( $co_inv_other )
		&& 404 === ( $co_inv_fail->get_error_data()['status'] ?? 0 ) && 404 === ( $co_inv_other->get_error_data()['status'] ?? 0 )
		&& $co_inv_fail->get_error_message() === $co_inv_none->get_error_message() && $co_inv_none->get_error_message() === $co_inv_other->get_error_message(),
	'/account/invoice: مهمان ۴۰۱؛ سفارش خود ۲۰۰ (کد حرف‌کوچک هم)؛ پرداخت‌نشده/دیگران/ناشناخته ۴۰۴ با پیام یکسان',
	'فاکتور مسیر: ' . wp_json_encode( [ $co_inv_guest, $co_inv_own, $co_inv_fail, $co_inv_none, $co_inv_other ] )
);

// ۸۴: ایمیل مشتری — گیرنده‌ی فرم پرداخت؛ نبودش → ایمیل حساب؛ هیچ‌کدام → بی‌صدا
// ارسال نمی‌شود. HTML، عنوان با کد سفارش، فاکتور داخل بدنه، لینک «سفارش‌های من».
$GLOBALS['cyh_test_mail_calls'] = [];
$cust = get_post_meta( $co_evil_id, 'cyh_customer', true );
$cust['email'] = 'buyer@example.com';
update_post_meta( $co_evil_id, 'cyh_customer', $cust );
$co_m1 = cyh_checkout_notify_customer( $co_evil_id );
$co_mail1 = end( $GLOBALS['cyh_test_mail_calls'] );
$cust['email'] = '';
update_post_meta( $co_evil_id, 'cyh_customer', $cust );
$co_m2 = cyh_checkout_notify_customer( $co_evil_id );
$co_mail2 = end( $GLOBALS['cyh_test_mail_calls'] );
$GLOBALS['cyh_test_posts'][ $co_evil_id ]['post_author'] = 0;
$co_count_before = count( $GLOBALS['cyh_test_mail_calls'] );
$co_m3 = cyh_checkout_notify_customer( $co_evil_id );
$co_guest_find = cyh_find_paid_order( 0, 'CY-EVIL01' );
$co_check(
	true === $co_m1 && 'buyer@example.com' === $co_mail1['to'] && false !== strpos( $co_mail1['subject'], 'CY-EVIL01' )
		&& false !== strpos( implode( ';', (array) $co_mail1['headers'] ), 'text/html' ) && false !== strpos( $co_mail1['body'], 'فاکتور فروش (غیررسمی)' )
		&& false !== strpos( $co_mail1['body'], 'https://craneyadak.com/account/orders' ) && false === strpos( $co_mail1['body'], '<script' )
		&& true === $co_m2 && (string) get_userdata( $co_uid_a )->user_email === $co_mail2['to']
		&& false === $co_m3 && count( $GLOBALS['cyh_test_mail_calls'] ) === $co_count_before && null === $co_guest_find,
	'ایمیل مشتری: گیرنده‌ی فرم → ایمیل حساب → هیچ (بی‌صدا)؛ HTML با فاکتور و لینک سفارش‌ها؛ HTML کالا escape',
	'ایمیل: ' . wp_json_encode( [ $co_m1, $co_mail1, $co_m2, $co_mail2, $co_m3 ] )
);

// ۸۵: پرداخت موفق واقعی (callback) ایمیل مشتری را هم می‌فرستد — همان ایمیل داخلی + یکی به مشتری.
$co_paid_mails = array_values( array_filter( $GLOBALS['cyh_test_mail_calls'], static function ( $m ) { return false !== strpos( (string) $m['subject'], 'تأیید سفارش' ); } ) );
$co_check(
	count( $co_paid_mails ) >= 2,
	'ایمیل مشتری در جریان واقعی پرداخت هم فرستاده شد',
	'ایمیل «تأیید سفارش» باید در جریان پرداخت هم رفته باشد'
);
$GLOBALS['cyh_test_is_admin'] = false;

// ۸۶: پیگیری با «شماره پیگیری پرداخت» (عدد زرین‌پال) — همان اشتباهی که کارفرما در
// آزمون کرد. شماره تماس همچنان لازم است؛ استعلام با عدد پیدا نمی‌شود؛ پاسخ
// کد واقعی سفارش را برمی‌گرداند نه ورودی را.
$co_track = static function ( $code, $phone ) {
	foreach ( array_keys( $GLOBALS['cyh_test_transients'] ?? [] ) as $k ) {
		if ( 0 === strpos( $k, 'cyh_track_' ) ) { unset( $GLOBALS['cyh_test_transients'][ $k ] ); }
	}
	return cyh_rest_quote_status( new WP_REST_Request( [ 'code' => $code, 'phone' => $phone ] ) );
};
update_post_meta( $co_oid, 'cyh_ref_id', '509594101' );
update_post_meta( $co_evil_id, 'cyh_phone', '09121234567' );
$co_t_ref   = $co_track( '509594101', '09121234567' );
$co_t_fa    = $co_track( '۵۰۹۵۹۴۱۰۱', '۰۹۱۲۱۲۳۴۵۶۷' );
$co_t_code  = $co_track( ' cy-evil01 ', '09121234567' );
$co_t_wrong = $co_track( '509594101', '09999999999' );
$co_t_none  = $co_track( '509594102', '09121234567' );
$co_t_ref_d = $co_t_ref->get_data();
$co_check(
	200 === $co_t_ref->get_status() && $co_code === ( $co_t_ref_d['code'] ?? '' ) && 'paid' === ( $co_t_ref_d['payment'] ?? '' ) && 'پرداخت‌شده' === ( $co_t_ref_d['paymentLabel'] ?? '' )
		&& 200 === $co_t_fa->get_status() && 200 === $co_t_code->get_status() && 'CY-EVIL01' === ( $co_t_code->get_data()['code'] ?? '' )
		&& 404 === $co_t_wrong->get_status() && 404 === $co_t_none->get_status(),
	'/track: شماره پیگیری پرداخت (لاتین/فارسی) و کد CY-… (با فاصله/حرف کوچک) هر دو پیدا می‌کنند؛ شماره تماس نادرست یا عدد ناشناخته ۴۰۴',
	'track: ' . wp_json_encode( [ $co_t_ref->get_status(), $co_t_ref_d, $co_t_fa->get_status(), $co_t_code->get_status(), $co_t_wrong->get_status(), $co_t_none->get_status() ] )
);

// ۸۷: یکتایی موبایل در ثبت‌نام — با/بدون صفر اول و ارقام فارسی یکی حساب می‌شوند؛
// ثبت‌نام تکراری ۴۰۹ است و کاربری نمی‌سازد؛ ذخیره همیشه با صفر اول.
$co_reg = static function ( $email, $phone ) {
	foreach ( array_keys( $GLOBALS['cyh_test_transients'] ?? [] ) as $k ) {
		if ( 0 === strpos( $k, 'cyh_reg' ) || 0 === strpos( $k, 'cyh_rl_' ) || 0 === strpos( $k, 'cyh_corl_' ) ) { unset( $GLOBALS['cyh_test_transients'][ $k ] ); }
	}
	return cyh_rest_account_register( new WP_REST_Request( [ 'name' => 'مشتری آزمون', 'email' => $email, 'password' => 'Jarsaghil2026', 'phone' => $phone, 'website' => '' ] ) );
};
$co_users_before = count( $GLOBALS['cyh_test_users'] );
$co_r_first = $co_reg( 'phone-a@example.com', '9351112233' );
$co_dups    = [];
foreach ( [ '09351112233', '9351112233', '۰۹۳۵۱۱۱۲۲۳۳', '٩٣٥١١١٢٢٣٣' ] as $co_dup_phone ) {
	$co_r_dup = $co_reg( 'dup-' . count( $co_dups ) . '@example.com', $co_dup_phone );
	$co_dups[] = is_wp_error( $co_r_dup ) ? [ $co_r_dup->get_error_code(), $co_r_dup->get_error_data()['status'] ?? 0 ] : 'created';
}
$co_uid_pa = get_user_by( 'email', 'phone-a@example.com' )->ID ?? 0;
$co_check(
	! is_wp_error( $co_r_first ) && '09351112233' === get_user_meta( $co_uid_pa, 'cyh_phone', true )
		&& array_fill( 0, 4, [ 'cyh_phone_taken', 409 ] ) === $co_dups
		&& count( $GLOBALS['cyh_test_users'] ) === $co_users_before + 1,
	'ثبت‌نام: شماره‌ی تکراری (با/بدون صفر، فارسی/عربی) ۴۰۹ و بدون ساخت کاربر؛ شماره با صفر اول ذخیره می‌شود',
	'یکتایی موبایل: ' . wp_json_encode( [ $co_dups, count( $GLOBALS['cyh_test_users'] ) - $co_users_before ] )
);
// حساب قدیمی که شماره را بدون صفر ذخیره کرده هم شناخته می‌شود.
$co_uid_legacy = wp_insert_user( [ 'user_email' => 'legacy@example.com', 'user_pass' => 'abc12345', 'display_name' => 'قدیمی' ] );
update_user_meta( $co_uid_legacy, 'cyh_phone', '9127778899' );
$co_r_legacy = $co_reg( 'new-legacy@example.com', '09127778899' );
$co_check(
	is_wp_error( $co_r_legacy ) && 'cyh_phone_taken' === $co_r_legacy->get_error_code(),
	'ثبت‌نام: شماره‌ی ذخیره‌شده‌ی قدیمی (بدون صفر اول) هم تکراری شناخته می‌شود',
	'حساب قدیمی بدون صفر باید مانع شود'
);

// ۸۸: ویرایش پروفایل — شماره‌ی حساب دیگر ۴۰۹؛ شماره‌ی خودِ کاربر آزاد؛ شماره‌ی تازه با صفر.
$co_r_b = $co_reg( 'phone-b@example.com', '09361110000' );
$co_uid_pb = get_user_by( 'email', 'phone-b@example.com' )->ID ?? 0;
$co_as( cyh_customer_issue_token( $co_uid_pb ) );
$co_prof = static function ( $phone ) {
	return cyh_rest_account_profile( new WP_REST_Request( [ 'name' => 'مشتری بی', 'phone' => $phone, 'company' => '' ] ) );
};
$co_p_taken = $co_prof( '9351112233' );
$co_p_own   = $co_prof( '9361110000' );
$co_p_new   = $co_prof( '9362221111' );
$co_check(
	is_wp_error( $co_p_taken ) && 'cyh_phone_taken' === $co_p_taken->get_error_code() && 409 === ( $co_p_taken->get_error_data()['status'] ?? 0 )
		&& ! is_wp_error( $co_p_own ) && ! is_wp_error( $co_p_new ) && '09362221111' === get_user_meta( $co_uid_pb, 'cyh_phone', true ),
	'پروفایل: شماره‌ی حساب دیگر ۴۰۹؛ شماره‌ی خودِ کاربر آزاد؛ شماره‌ی تازه با صفر اول ذخیره می‌شود',
	'یکتایی در پروفایل: ' . wp_json_encode( [ $co_p_taken, $co_p_own, $co_p_new ] )
);
$co_as( $co_tok_a );

// ۸۹: مشخصات ذخیره‌شده — فقط پس از پرداخت *موفق*؛ سفارش ناموفق چیزی ذخیره نمی‌کند؛
// سفارش بدون فاکتور فاکتور ذخیره‌شده را پاک نمی‌کند؛ /account/me آن را برمی‌گرداند؛
// پاک‌کردن فقط برای خودِ کاربر.
$co_saved_paid = cyh_checkout_saved( $co_uid_a );
$co_check(
	is_array( $co_saved_paid ) && 'خریدار آزمون' === $co_saved_paid['customer']['name'] && '09121234567' === $co_saved_paid['customer']['phone']
		&& 'تهران' === $co_saved_paid['customer']['city'] && ! isset( $co_saved_paid['invoice'] ),
	'ذخیره‌ی مشخصات: پس از پرداخت موفق (verify) مشخصات گیرنده روی حساب ماند؛ سفارش ناموفق/بدون فاکتور فاکتوری نساخت',
	'saved پس از پرداخت: ' . wp_json_encode( $co_saved_paid )
);
$GLOBALS['cyh_test_posts'][ $co_evil_id ]['post_author'] = $co_uid_a;
update_post_meta( $co_evil_id, 'cyh_customer', [ 'name' => 'نام تازه', 'phone' => '09121234567', 'email' => 'a@example.com', 'province' => 'اصفهان', 'city' => 'اصفهان', 'address' => 'نشانی تازه', 'postal' => '1234567891' ] );
update_post_meta( $co_evil_id, 'cyh_invoice', [ 'wanted' => true, 'type' => 'legal', 'name' => 'شرکت الف', 'national_id' => '10380284790', 'economic_code' => '411111111111', 'reg_no' => '12345', 'postal' => '1234567891', 'landline' => '02112345678', 'address' => 'نشانی فاکتور' ] );
cyh_checkout_save_profile( $co_evil_id );
$co_saved_inv = cyh_checkout_saved( $co_uid_a );
cyh_checkout_save_profile( $co_oid );
$co_saved_keep = cyh_checkout_saved( $co_uid_a );
$co_me = cyh_rest_account_me( new WP_REST_Request( [] ) );
$co_check(
	'اصفهان' === $co_saved_inv['customer']['city'] && 'legal' === ( $co_saved_inv['invoice']['type'] ?? '' ) && '10380284790' === ( $co_saved_inv['invoice']['national_id'] ?? '' )
		&& 'تهران' === $co_saved_keep['customer']['city'] && 'شرکت الف' === ( $co_saved_keep['invoice']['name'] ?? '' )
		&& 'تهران' === ( $co_me['saved']['customer']['city'] ?? '' ),
	'ذخیره‌ی مشخصات: مشخصات تازه جایگزین می‌شود؛ سفارش بدون فاکتور فاکتور ذخیره‌شده را نگه می‌دارد؛ /account/me آن را می‌دهد',
	'saved: ' . wp_json_encode( [ $co_saved_inv, $co_saved_keep ] )
);
$co_as( $co_tok_b );
$co_clear_b = cyh_rest_account_saved_clear( new WP_REST_Request( [] ) );
$co_still   = cyh_checkout_saved( $co_uid_a );
$co_as( null );
$co_clear_guest = cyh_rest_account_saved_clear( new WP_REST_Request( [] ) );
$co_as( $co_tok_a );
$co_clear_a = cyh_rest_account_saved_clear( new WP_REST_Request( [] ) );
$co_me_after = cyh_rest_account_me( new WP_REST_Request( [] ) );
$co_check(
	null !== $co_still && is_wp_error( $co_clear_guest ) && 401 === ( $co_clear_guest->get_error_data()['status'] ?? 0 )
		&& ! is_wp_error( $co_clear_a ) && null === cyh_checkout_saved( $co_uid_a ) && array_key_exists( 'saved', $co_me_after ) && null === $co_me_after['saved'],
	'پاک‌کردن مشخصات ذخیره‌شده: کاربر دیگر نمی‌تواند پاک کند، مهمان ۴۰۱، خودِ کاربر می‌تواند',
	'پاک‌کردن: ' . wp_json_encode( [ $co_clear_b, $co_clear_guest, $co_clear_a ] )
);

// ۹۰: پنل «کاربران» — ستون‌های موبایل/شرکت/سفارش پرداخت‌شده و بخش پروفایل؛ همه escape.
update_user_meta( $co_uid_a, 'cyh_phone', '09121234567' );
update_user_meta( $co_uid_a, 'cyh_company', '<b>شرکت</b>' );
cyh_checkout_save_profile( $co_oid );
$co_cols = cyh_users_columns( [ 'name' => 'n' ] );
$co_ph   = cyh_users_column_content( '', 'cyh_phone', $co_uid_a );
$co_co   = cyh_users_column_content( '', 'cyh_company', $co_uid_a );
$co_ord  = cyh_users_column_content( '', 'cyh_orders', $co_uid_a );
$co_ord0 = cyh_users_column_content( '', 'cyh_orders', $co_uid_pb );
$co_none = cyh_users_column_content( 'x', 'other', $co_uid_a );
$co_phone_empty = cyh_users_column_content( '', 'cyh_phone', $co_uid_legacy + 999 );
ob_start();
cyh_user_profile_section( get_userdata( $co_uid_a ) );
$co_section = ob_get_clean();
$co_check(
	isset( $co_cols['cyh_phone'], $co_cols['cyh_company'], $co_cols['cyh_orders'] ) && false !== strpos( $co_ph, 'tel:09121234567' )
		&& false === strpos( $co_co, '<b>' ) && false !== strpos( $co_co, '&lt;b&gt;' )
		&& false !== strpos( $co_ord, 'cyh_view=orders' ) && false !== strpos( $co_ord, '>2<' ) && '0' === $co_ord0 && 'x' === $co_none && '—' === $co_phone_empty
		&& false !== strpos( $co_section, '09121234567' ) && false !== strpos( $co_section, 'تهران' ) && false === strpos( $co_section, '<b>شرکت' ),
	'پنل کاربران: ستون موبایل/شرکت/سفارش پرداخت‌شده (با لینک به سفارش‌ها) و بخش مشخصات مشتری؛ escape؛ ستون ناشناس دست‌نخورده',
	'ستون‌ها: ' . wp_json_encode( [ $co_cols, $co_ph, $co_co, $co_ord, $co_ord0, $co_section ] )
);

// ۹۱–۹۹: فاز ۵ — رسیدگی به سفارش پرداخت‌شده (وضعیت ارسال، رهگیری، فاکتور رسمی، ایمیل، ویجت)
$co_quote_id = 8802; // استعلام (بدون cyh_payment)
$GLOBALS['cyh_test_posts'][ $co_quote_id ] = [ 'post_type' => CYH_QUOTE_CPT, 'post_status' => 'publish', 'post_title' => 'q', 'post_author' => 0 ];
update_post_meta( $co_quote_id, 'cyh_code', 'CY-QUOTE1' );
update_post_meta( $co_quote_id, 'cyh_kind', 'quote' );
update_post_meta( $co_quote_id, 'cyh_status', 'answered' );

// ۹۱: نمای رسیدگی — پرداخت‌شده پیش‌فرض «در حال آماده‌سازی»؛ ناموفق/استعلام null.
$co_v_paid = cyh_order_fulfilment_view( $co_oid );
$co_check(
	'processing' === ( $co_v_paid['status'] ?? '' ) && 'در حال آماده‌سازی' === ( $co_v_paid['statusLabel'] ?? '' ) && '' === $co_v_paid['trackingCode']
		&& null === cyh_order_fulfilment_view( $co_oid71 ) && null === cyh_order_fulfilment_view( $co_quote_id ),
	'رسیدگی: پرداخت‌شده پیش‌فرض «در حال آماده‌سازی»؛ پرداخت‌نشده و استعلام null',
	'نمای رسیدگی: ' . wp_json_encode( [ $co_v_paid, cyh_order_fulfilment_view( $co_oid71 ) ] )
);

// ۹۲: کدام جعبه روی کدام رکورد — سفارش پرداخت‌شده «رسیدگی»، سفارش ناموفق هیچ‌کدام
// («پاسخ واحد فروش» استعلام است)، استعلام فقط «پاسخ واحد فروش».
$box_ids = static function ( $id ) {
	$GLOBALS['cyh_test_metaboxes'] = [];
	$post = (object) [ 'ID' => $id ];
	cyh_quote_response_metabox( CYH_QUOTE_CPT, $post );
	cyh_fulfilment_metabox( CYH_QUOTE_CPT, $post );
	return array_keys( $GLOBALS['cyh_test_metaboxes'] );
};
$co_check(
	[ 'cyh_fulfilment' ] === $box_ids( $co_oid ) && [] === $box_ids( $co_oid71 ) && [ 'cyh_quote_response' ] === $box_ids( $co_quote_id ),
	'جعبه‌ها: سفارش پرداخت‌شده فقط «رسیدگی»؛ سفارش ناموفق هیچ؛ استعلام فقط «پاسخ واحد فروش»',
	'جعبه‌ها: ' . wp_json_encode( [ $box_ids( $co_oid ), $box_ids( $co_oid71 ), $box_ids( $co_quote_id ) ] )
);

// ۹۳: ذخیره — وضعیت/رهگیری (ارقام فارسی→لاتین)/توضیح/فاکتور رسمی؛ javascript: پاک می‌شود؛
// وضعیت ناشناخته → processing؛ بدون nonce و سفارش پرداخت‌نشده هیچ‌چیز ذخیره نمی‌شود.
$GLOBALS['cyh_test_mail_calls'] = [];
$_POST = [ 'cyh_fulfil_nonce' => 'x', 'cyh_fulfilment' => 'shipped', 'cyh_tracking_code' => '۱۲۳۴۵', 'cyh_fulfil_note' => 'باربری آزمون <b>x</b>', 'cyh_official_invoice_url' => 'javascript:alert(1)' ];
cyh_save_fulfilment( $co_oid );
$co_v1     = cyh_order_fulfilment_view( $co_oid );
$co_mails1 = count( $GLOBALS['cyh_test_mail_calls'] );
$_POST['cyh_official_invoice_url'] = 'https://cms.example.com/wp-content/uploads/inv.pdf';
cyh_save_fulfilment( $co_oid ); // ذخیره‌ی دوباره: ایمیل تکراری نه
$co_v2     = cyh_order_fulfilment_view( $co_oid );
$co_mails2 = count( $GLOBALS['cyh_test_mail_calls'] );
$_POST['cyh_fulfilment'] = 'hacked';
cyh_save_fulfilment( $co_oid );
$co_v3 = cyh_order_fulfilment_view( $co_oid );
$_POST = [ 'cyh_fulfilment' => 'delivered' ]; // بدون nonce
cyh_save_fulfilment( $co_oid );
$co_v4 = cyh_order_fulfilment_view( $co_oid );
$_POST = [ 'cyh_fulfil_nonce' => 'x', 'cyh_fulfilment' => 'shipped', 'cyh_tracking_code' => 'HACK' ];
cyh_save_fulfilment( $co_oid71 ); // سفارش ناموفق
$_POST = [];
$co_check(
	'shipped' === $co_v1['status'] && '12345' === $co_v1['trackingCode'] && 'باربری آزمون x' === $co_v1['note'] && '' === $co_v1['officialInvoiceUrl']
		&& 'https://cms.example.com/wp-content/uploads/inv.pdf' === $co_v2['officialInvoiceUrl']
		&& 'processing' === $co_v3['status'] && 'processing' === $co_v4['status'] && 'processing' === get_post_meta( $co_oid, 'cyh_fulfilment', true )
		&& '' === (string) get_post_meta( $co_oid71, 'cyh_tracking_code', true ) && '' === (string) get_post_meta( $co_oid71, 'cyh_fulfilment', true ),
	'ذخیره‌ی رسیدگی: ارقام رهگیری لاتین، HTML توضیح پاک، javascript: خالی، وضعیت ناشناخته → processing، بدون nonce و سفارش ناموفق دست‌نخورده',
	'ذخیره: ' . wp_json_encode( [ $co_v1, $co_v2, $co_v3, $co_v4 ] )
);
$co_check(
	1 === $co_mails1 && 1 === $co_mails2,
	'ایمیل «ارسال شد»: فقط اولین گذار به shipped؛ ذخیره‌ی دوباره ایمیل تکراری نمی‌فرستد',
	'ایمیل ارسال: ' . wp_json_encode( [ $co_mails1, $co_mails2 ] )
);

// ۹۴: متن ایمیل ارسال — کد سفارش، روش ارسال، رهگیری، توضیح escape، لینک سفارش‌ها؛
// بدون گیرنده false و پرچم «ارسال شد» ثبت نمی‌شود (ذخیره‌ی بعدی دوباره تلاش می‌کند).
update_post_meta( $co_evil_id, 'cyh_payment', 'paid' );
update_post_meta( $co_evil_id, 'cyh_tracking_code', 'TRK-9' );
update_post_meta( $co_evil_id, 'cyh_fulfil_note', '<script>alert(1)</script> تحویل باربری' );
$GLOBALS['cyh_test_mail_calls'] = [];
$co_ship_ok = cyh_order_notify_shipped( $co_evil_id );
$co_ship_m  = end( $GLOBALS['cyh_test_mail_calls'] );
$GLOBALS['cyh_test_posts'][ $co_evil_id ]['post_author'] = 0;
$cust_e = get_post_meta( $co_evil_id, 'cyh_customer', true ); $cust_e['email'] = ''; update_post_meta( $co_evil_id, 'cyh_customer', $cust_e );
$co_ship_none = cyh_order_notify_shipped( $co_evil_id );
$_POST = [ 'cyh_fulfil_nonce' => 'x', 'cyh_fulfilment' => 'shipped' ];
cyh_save_fulfilment( $co_evil_id );
$_POST = [];
$co_check(
	true === $co_ship_ok && false !== strpos( $co_ship_m['subject'], 'CY-EVIL01' ) && false !== strpos( $co_ship_m['body'], 'TRK-9' ) && false !== strpos( $co_ship_m['body'], 'تیپاکس' )
		&& false !== strpos( $co_ship_m['body'], 'https://craneyadak.com/account/orders/' ) && false === strpos( $co_ship_m['body'], '<script' ) && false !== strpos( $co_ship_m['body'], '&lt;script&gt;' )
		&& false === $co_ship_none && '' === (string) get_post_meta( $co_evil_id, 'cyh_shipped_mail_sent', true ),
	'ایمیل ارسال: کد، روش، رهگیری، لینک؛ توضیح escape؛ بدون گیرنده false و پرچم ثبت نمی‌شود',
	'ایمیل ارسال: ' . wp_json_encode( [ $co_ship_ok, $co_ship_m, $co_ship_none ] )
);
$GLOBALS['cyh_test_posts'][ $co_evil_id ]['post_author'] = $co_uid_a;

// ۹۵: REST — «سفارش‌های من» و /track وضعیت رسیدگی را برای پرداخت‌شده می‌دهند، برای ناموفق null.
update_post_meta( $co_oid, 'cyh_fulfilment', 'shipped' );
update_post_meta( $co_oid, 'cyh_tracking_code', '12345' );
$co_as( $co_tok_a );
$co_own3 = cyh_rest_account_orders( new WP_REST_Request( [] ) );
$co_by3  = [];
foreach ( $co_own3['orders'] as $co_o3 ) { $co_by3[ $co_o3['code'] ] = $co_o3; }
$co_tr3 = $co_track( '509594101', '09121234567' )->get_data();
$co_tr_q = $co_track( 'CY-QUOTE1', '09121234567' );
update_post_meta( $co_quote_id, 'cyh_phone', '09121234567' );
$co_tr_q = $co_track( 'CY-QUOTE1', '09121234567' )->get_data();
$co_check(
	'shipped' === ( $co_by3[ $co_code ]['fulfilment']['status'] ?? '' ) && '12345' === ( $co_by3[ $co_code ]['fulfilment']['trackingCode'] ?? '' )
		&& null === $co_by3[ get_post_meta( $co_oid71, 'cyh_code', true ) ]['fulfilment']
		&& 'shipped' === ( $co_tr3['fulfilment']['status'] ?? '' ) && '12345' === ( $co_tr3['fulfilment']['trackingCode'] ?? '' )
		&& array_key_exists( 'fulfilment', $co_tr_q ) && null === $co_tr_q['fulfilment'],
	'REST: سفارش‌های من و /track وضعیت/رهگیری را برای پرداخت‌شده می‌دهند؛ ناموفق و استعلام null',
	'REST رسیدگی: ' . wp_json_encode( [ $co_by3[ $co_code ]['fulfilment'] ?? null, $co_tr3['fulfilment'] ?? null, $co_tr_q['fulfilment'] ?? 'x' ] )
);

// ۹۶: داشبورد حساب — سفارش پرداخت‌شده: وضعیت رسیدگی؛ ناموفق: pay_failed؛ استعلام: وضعیت استعلام.
$co_me3 = cyh_rest_account_me( new WP_REST_Request( [] ) );
$co_me_by = [];
foreach ( $co_me3['orders'] as $co_m3 ) { $co_me_by[ $co_m3['code'] ] = $co_m3['status']; }
$co_check(
	'shipped' === ( $co_me_by[ $co_code ] ?? '' ) && 'pay_failed' === ( $co_me_by[ get_post_meta( $co_oid71, 'cyh_code', true ) ] ?? '' ),
	'/account/me: وضعیت سفارش = رسیدگی/پرداخت، نه وضعیت استعلام («جدید»)',
	'me orders: ' . wp_json_encode( $co_me_by )
);

// ۹۷: ستون وضعیت رسیدگی در فهرست سفارش‌ها.
ob_start(); cyh_quote_status_column_content( 'cyh_status', $co_oid ); $col_paid = ob_get_clean();
ob_start(); cyh_quote_status_column_content( 'cyh_status', $co_oid71 ); $col_fail = ob_get_clean();
ob_start(); cyh_quote_status_column_content( 'cyh_status', $co_quote_id ); $col_quote = ob_get_clean();
$co_check(
	'ارسال شد' === $col_paid && '—' === $col_fail && false !== strpos( $col_quote, 'پاسخ داده شد' ),
	'ستون وضعیت: سفارش پرداخت‌شده = وضعیت رسیدگی، ناموفق «—»، استعلام = وضعیت استعلام',
	'ستون: ' . wp_json_encode( [ $col_paid, $col_fail, $col_quote ] )
);

// ۹۸: فیلتر فهرست سفارش‌ها با ?cyh_fulfil — فقط در نمای سفارش‌ها و فقط مقدار شناخته‌شده.
$GLOBALS['cyh_test_is_admin'] = true;
$mq = static function ( $view, $fulfil ) {
	$_GET = [];
	if ( null !== $view ) { $_GET['cyh_view'] = $view; }
	if ( null !== $fulfil ) { $_GET['cyh_fulfil'] = $fulfil; }
	$q = new WP_Query( [ 'post_type' => CYH_QUOTE_CPT ] );
	cyh_quote_admin_filter_query( $q );
	$_GET = [];
	return $q->get( 'meta_query' );
};
$co_mq_proc = $mq( 'orders', 'processing' );
$co_check(
	2 === count( $co_mq_proc ) && 'OR' === ( $co_mq_proc[1]['relation'] ?? '' ) && 2 === count( $mq( 'orders', 'shipped' ) ) && 'shipped' === $mq( 'orders', 'shipped' )[1]['value']
		&& 1 === count( $mq( 'orders', 'bogus' ) ) && 1 === count( $mq( 'orders', null ) ) && 1 === count( $mq( null, 'shipped' ) ),
	'فیلتر سفارش‌ها: processing شامل سفارش بی‌متا (OR)، shipped مقدار دقیق؛ مقدار ناشناخته و نمای استعلام نادیده',
	'فیلتر رسیدگی: ' . wp_json_encode( [ $co_mq_proc, $mq( 'orders', 'bogus' ) ] )
);
$GLOBALS['cyh_test_is_admin'] = false;

// ۹۹: ویجت داشبورد — فقط پرداخت‌شده‌ی «در حال آماده‌سازی»؛ ارسال‌شده و ناموفق نه.
update_post_meta( $co_evil_id, 'cyh_fulfilment', 'processing' );
ob_start(); cyh_orders_dashboard_widget(); $w1 = ob_get_clean();
update_post_meta( $co_evil_id, 'cyh_fulfilment', 'delivered' );
ob_start(); cyh_orders_dashboard_widget(); $w2 = ob_get_clean();
$GLOBALS['cyh_test_dashboard_widgets'] = [];
cyh_register_orders_widget();
$co_check(
	false !== strpos( $w1, 'CY-EVIL01' ) && false === strpos( $w1, $co_code . '<' ) && false === strpos( $w1, get_post_meta( $co_oid71, 'cyh_code', true ) )
		&& false !== strpos( $w2, 'در انتظار رسیدگی نیست' ) && isset( $GLOBALS['cyh_test_dashboard_widgets']['cyh_orders_widget'] ),
	'ویجت داشبورد: فقط پرداخت‌شده‌ی در حال آماده‌سازی؛ ارسال‌شده/ناموفق نه؛ ویجت ثبت شد',
	'ویجت: ' . $w1 . ' | ' . $w2
);

// ۱۰۰–۱۰۶: برچسب اصالت «اصلی / غیر اصلی» (تصمیم مدیریت، ۷ مهر ۱۴۰۵)
update_field( 'authenticity', 'original', $co_id );
$au_a = cyh_product_pricing( $co_id )['authenticity'];
update_field( 'authenticity', 'non_original', $co_id );
$au_b = cyh_product_pricing( $co_id )['authenticity'];
update_field( 'authenticity', 'fake-value', $co_id );
$au_c = cyh_product_pricing( $co_id )['authenticity'];
update_field( 'authenticity', '', $co_id );
$au_d = cyh_product_pricing( $co_id )['authenticity'];
$co_check(
	'original' === $au_a && 'non_original' === $au_b && '' === $au_c && '' === $au_d,
	'اصالت: original/non_original خوانده می‌شود؛ مقدار ناشناخته یا خالی = ثبت‌نشده (هرگز حدس «اصلی» نه)',
	'اصالت: ' . wp_json_encode( [ $au_a, $au_b, $au_c, $au_d ] )
);

// ۱۰۱: عکس اصالت در خطوط نشست پرداخت (و در پاسخ نشست به مرورگر)
update_field( 'authenticity', 'non_original', $co_id );
$co_reset_rl();
$co_as( $co_tok_a );
$au_lines = cyh_checkout_build( [ [ 'slug' => 'co-remote', 'qty' => 1 ] ] )['lines'];
$au_sess  = cyh_rest_checkout_session( new WP_REST_Request( [ 'items' => [ [ 'slug' => 'co-remote', 'qty' => 1 ] ] ] ) )->get_data();
update_field( 'authenticity', 'original', $co_id ); // بعد از نشست عوض شد؛ سفارش همان قبلی را نگه می‌دارد
$co_check(
	'non_original' === ( $au_lines[0]['authenticity'] ?? '' ) && 'non_original' === ( $au_sess['lines'][0]['authenticity'] ?? '' ),
	'اصالت: در خطوط نشست پرداخت ذخیره و به مرورگر داده می‌شود (عکس لحظه‌ی خرید)',
	'خطوط: ' . wp_json_encode( [ $au_lines, $au_sess['lines'] ?? null ] )
);

// ۱۰۲: فاکتور — برچسب هر قلم؛ ثبت‌نشده/ناشناخته = هیچ خطی
update_post_meta( $co_evil_id, 'cyh_items', [
	[ 'name' => 'الف', 'sku' => 'A-1', 'qty' => 1, 'unit' => 10, 'total' => 10, 'authenticity' => 'original' ],
	[ 'name' => 'ب', 'sku' => 'B-1', 'qty' => 1, 'unit' => 10, 'total' => 10, 'authenticity' => 'non_original' ],
	[ 'name' => 'ج', 'sku' => 'C-1', 'qty' => 1, 'unit' => 10, 'total' => 10 ],
	[ 'name' => 'د', 'sku' => 'D-1', 'qty' => 1, 'unit' => 10, 'total' => 10, 'authenticity' => '<script>x</script>' ],
] );
$au_inv = cyh_order_invoice_html( $co_evil_id );
$co_check(
	2 === substr_count( $au_inv, 'اصالت کالا:' ) && false !== strpos( $au_inv, '<strong>اصلی</strong>' ) && false !== strpos( $au_inv, '<strong>غیر اصلی</strong>' )
		&& false === strpos( $au_inv, '<script>x' ),
	'فاکتور: «اصالت کالا: اصلی / غیر اصلی» برای هر قلم برچسب‌دار؛ ثبت‌نشده یا مقدار ناشناخته خط ندارد',
	'فاکتور اصالت: ' . substr_count( $au_inv, 'اصالت کالا:' )
);

// ۱۰۳: ستون فهرست محصولات پنل
$au_cols = cyh_product_authenticity_column( [ 'cb' => 'x', 'title' => 't', 'date' => 'd' ] );
update_field( 'authenticity', 'original', $co_id );
ob_start(); cyh_product_authenticity_column_content( 'cyh_authenticity', $co_id ); $au_col_o = ob_get_clean();
update_field( 'authenticity', '', $co_id );
ob_start(); cyh_product_authenticity_column_content( 'cyh_authenticity', $co_id ); $au_col_u = ob_get_clean();
update_field( 'authenticity', 'non_original', $co_id );
ob_start(); cyh_product_authenticity_column_content( 'cyh_authenticity', $co_id ); $au_col_n = ob_get_clean();
ob_start(); cyh_product_authenticity_column_content( 'other', $co_id ); $au_col_x = ob_get_clean();
$co_check(
	[ 'cb', 'title', 'cyh_authenticity', 'date' ] === array_keys( $au_cols ) && false !== strpos( $au_col_o, '>اصلی<' )
		&& false !== strpos( $au_col_u, 'ثبت نشده' ) && '' === $au_col_x && false !== strpos( $au_col_n, '#996800' ) && false !== strpos( $au_col_o, '#00a32a' ),
	'ستون اصالت: بعد از عنوان؛ «اصلی» / «ثبت نشده» (قرمز)؛ ستون دیگر دست‌نخورده',
	'ستون: ' . wp_json_encode( [ array_keys( $au_cols ), $au_col_o, $au_col_u ] )
);

// ۱۰۴: فیلتر فهرست محصولات (?cyh_auth=) — فقط product، فقط ادمین، فقط مقدار شناخته‌شده
$GLOBALS['cyh_test_is_admin'] = true;
$au_q = static function ( $type, $value ) {
	$_GET = null === $value ? [] : [ 'cyh_auth' => $value ];
	$q = new WP_Query( [ 'post_type' => $type ] );
	cyh_authenticity_apply_filter( $q );
	$_GET = [];
	return $q->get( 'meta_query' );
};
$au_unset = $au_q( 'product', 'unset' );
$co_check(
	'OR' === ( $au_unset[0]['relation'] ?? '' ) && [ [ 'key' => 'authenticity', 'value' => 'original' ] ] === $au_q( 'product', 'original' )
		&& '' === $au_q( 'product', 'bogus' ) && '' === $au_q( 'product', null ) && '' === $au_q( CYH_QUOTE_CPT, 'original' ),
	'فیلتر اصالت: unset شامل بدون‌متا (OR)؛ original مقدار دقیق؛ مقدار ناشناخته و نوع پست دیگر نادیده',
	'فیلتر اصالت: ' . wp_json_encode( [ $au_unset, $au_q( 'product', 'original' ) ] )
);
$GLOBALS['cyh_test_is_admin'] = false;

// ۱۰۵: ویرایش گروهی — عمل شناخته‌شده فقط روی product؛ شناسه‌ی غیرمحصول دست‌نخورده؛ عمل ناشناخته بدون تغییر
$au_p1 = $mk( 'au-1', [], 'publish', null );
$au_p2 = $mk( 'au-2', [], 'publish', null );
$au_redirect = cyh_authenticity_handle_bulk( 'https://x/edit.php', 'cyh_set_non_original', [ $au_p1, $au_p2, $co_quote_id ] );
$au_none     = cyh_authenticity_handle_bulk( 'https://x/edit.php', 'trash', [ $au_p1 ] );
$co_check(
	'non_original' === cyh_product_authenticity( $au_p1 ) && 'non_original' === cyh_product_authenticity( $au_p2 )
		&& '' === (string) get_post_meta( $co_quote_id, 'authenticity', true )
		&& false !== strpos( $au_redirect, 'cyh_bulk_auth=2' ) && 'https://x/edit.php' === $au_none
		&& isset( cyh_authenticity_bulk_actions( [] )['cyh_set_original'], cyh_authenticity_bulk_actions( [] )['cyh_set_non_original'] ),
	'ویرایش گروهی اصالت: فقط محصول‌ها (۲ مورد)، شناسه‌ی استعلام دست‌نخورده، عمل ناشناخته بدون تغییر، هر دو عمل ثبت',
	'گروهی: ' . wp_json_encode( [ $au_redirect, $au_none ] )
);

// ۱۰۶: تعریف فیلد ACF — اجباری، دو مقدار دقیق، بدون پیش‌فرض (انتخاب آگاهانه)، نام گراف‌کیوال authenticity
$au_group = json_decode( (string) file_get_contents( __DIR__ . '/crane-yadak-headless/acf-json/group_cyh_product_fields.json' ), true );
$au_field = null;
foreach ( $au_group['fields'] ?? [] as $f ) { if ( 'authenticity' === ( $f['name'] ?? '' ) ) { $au_field = $f; } }
$co_check(
	$au_field && 1 === $au_field['required'] && 1 === $au_field['allow_null'] && '' === $au_field['default_value']
		&& [ 'original' => 'اصلی', 'non_original' => 'غیر اصلی' ] === $au_field['choices'] && 'authenticity' === $au_field['graphql_field_name']
		&& 'select' === $au_field['type'] && 1 === $au_field['show_in_graphql'],
	'فیلد ACF اصالت: اجباری، بدون پیش‌فرض، فقط اصلی/غیر اصلی، در GraphQL با نام authenticity',
	'فیلد: ' . wp_json_encode( $au_field )
);

// ═══════════════════════════════════════════════════════════════════════════
// بررسی امضای هوک‌ها — همان چیزی که نسخه‌ی ۱.۳.۰ را کشت
// ═══════════════════════════════════════════════════════════════════════════
// وردپرس به هر کال‌بک دقیقاً min(accepted_args، تعداد آرگومان واقعی هوک)
// آرگومان می‌دهد. اگر کال‌بک پارامتر *اجباری* بیشتری داشته باشد، PHP 8 یک
// ArgumentCountError پرتاب می‌کند و سایت سفید می‌شود.
//
// از Reflection استفاده می‌کنیم و نه از فراخوانی واقعی: بدنه‌ی کال‌بک اجرا
// نمی‌شود، پس هیچ عارضه‌ی جانبی (ریدایرکت، نوشتن در دیتابیس، wp_die) رخ
// نمی‌دهد — ولی ناسازگاری امضا دقیق و قطعی پیدا می‌شود.
$hook_arity = [
	'pre_term_slug' => 2, 'pre_term_name' => 2, 'pre_term_description' => 2,
	'wp_insert_term_data' => 3, 'wp_update_term_data' => 4, 'term_name' => 2,
	'save_post' => 3, 'wp_insert_post_data' => 4, 'wp_unique_post_slug' => 6,
	'add_meta_boxes' => 2, 'wp_dashboard_setup' => 0, 'pre_get_posts' => 1, 'parent_file' => 1, 'pre_comment_approved' => 2,
	'manage_comments_custom_column' => 2, 'manage_edit-comments_columns' => 1,
	'init' => 0, 'admin_init' => 0, 'admin_menu' => 0, 'admin_notices' => 0,
	'admin_enqueue_scripts' => 1, 'rest_api_init' => 1,
	'acf/init' => 0, 'acf/save_post' => 1,
	'acf/settings/load_json' => 1, 'acf/settings/save_json' => 1,
	'graphql_register_types' => 1,
];
$dynamic_arity = [ '/^saved_/' => 4, '/^created_/' => 4, '/^edited_/' => 4,
	'/^views_edit-/' => 1, '/^delete_/' => 5, '/^admin_post_/' => 0, '/^wp_ajax_/' => 0 ];

$sig_checked = 0;
foreach ( $GLOBALS['cyh_test_hook_reg'] ?? [] as $reg ) {
	if ( ! is_string( $reg['cb'] ) || ! function_exists( $reg['cb'] ) ) {
		continue;
	}

	$arity = $hook_arity[ $reg['hook'] ] ?? null;
	if ( null === $arity ) {
		foreach ( $dynamic_arity as $pattern => $n ) {
			if ( preg_match( $pattern, $reg['hook'] ) ) { $arity = $n; break; }
		}
	}

	$ref      = new ReflectionFunction( $reg['cb'] );
	$required = $ref->getNumberOfRequiredParameters();

	// کف ۱: do_action بدون آرگومان اضافه هم یک رشته‌ی خالی پاس می‌دهد.
	$passes = ( null === $arity ) ? $reg['accepted'] : min( $reg['accepted'], $arity );
	$passes = max( $passes, 1 );
	$sig_checked++;

	if ( $required > $passes ) {
		$errors[] = sprintf(
			'امضای هوک اشتباه: %s() روی «%s» — %d پارامتر اجباری دارد ولی وردپرس %d آرگومان می‌دهد → ArgumentCountError (سفید شدن سایت)',
			$reg['cb'], $reg['hook'], $required, $passes
		);
	}
}
if ( ! array_filter( $errors, fn( $e ) => str_contains( $e, 'امضای هوک' ) ) ) {
	echo "✓ هر $sig_checked کال‌بک هوک با تعداد آرگومان وردپرس سازگار است\n";
}

// تصادم نام گراف‌کیوال بین گروه‌های ACF — باگی که سه بیلد را سوزاند.
if ( ! empty( $GLOBALS['cyh_test_acf_collisions'] ) ) {
	foreach ( array_unique( $GLOBALS['cyh_test_acf_collisions'] ) as $name ) {
		$errors[] = "دو گروه ACF یک graphql_field_name دارند: «$name» — یکی بی‌صدا از اسکیما حذف می‌شود";
	}
} else {
	echo "✓ هیچ تصادم graphql_field_name بین گروه‌های ACF نیست\n";
}

// هر زیرمنو باید کال‌بک واقعی داشته باشد (stub خودش throw می‌کند، این گزارش است).
echo '✓ ' . count( $GLOBALS['cyh_test_submenus'] ?? [] ) . " زیرمنوی پنل با کال‌بک معتبر ثبت شد\n";


// ═══════════════════════════════════════════════════════════════════════════
// تصادم `product` با ووکامرس — اثبات حل شدن
// ═══════════════════════════════════════════════════════════════════════════
$woo_mode = getenv( 'CYH_TEST_WOO' ) === '1';
echo "\n--- حالت: " . ( $woo_mode ? 'ووکامرس فعال' : 'ووکامرس غیرفعال' ) . " ---\n";

$pt = $GLOBALS['cyh_test_post_types']['product'] ?? null;

if ( $woo_mode ) {
	// ⚠️ این شاخه بازنویسی شد. قرارداد قدیمی («ووکامرس صاحب ثبت می‌شود و ما
	// تنظیمات گراف‌کیوال را رویش تزریق می‌کنیم») مربوط به پلی بود که کاملاً
	// حذف شد. تست همچنان آن رفتار را می‌خواست، پس برای رفتار *درستِ فعلی*
	// شکست می‌خورد.
	//
	// قرارداد امروز ساده‌تر و صادقانه‌تر است: اگر ووکامرس فعال باشد ما اصلاً
	// `product` را ثبت نمی‌کنیم و یک اعلان روشن در پنل می‌گذاریم. سایت سفید
	// نمی‌شود، ولی وانمود هم نمی‌کنیم که یکپارچه‌سازی‌ای وجود دارد.
	// ⚠️ نه `$pt === null`. خودِ ووکامرسِ ساختگی در همین هارنس، `product` را
	// با اولویت ۵ ثبت می‌کند — پس ثبت *وجود دارد*. چیزی که باید اثبات شود
	// این است که ثبت **مال او مانده** و ثبت ما (اولویت ۱۰) رویش ننشسته.
	if ( ! $pt ) {
		$errors[] = 'در حالت ووکامرس، product اصلاً ثبت نشد — خود ووکامرسِ ساختگی باید ثبتش کند';
	} elseif ( 'Products (WooCommerce)' !== ( $pt['labels']['name'] ?? '' ) ) {
		$errors[] = 'ثبت ووکامرس بازنویسی شد — نگهبان تصادم کار نکرد';
	} else {
		echo "✓ ثبت ووکامرس دست‌نخورده ماند (ما کنار کشیدیم)\n";
	}

	$notices = $GLOBALS['cyh_test_actions']['admin_notices'] ?? [];
	if ( empty( $notices ) ) {
		$errors[] = 'هیچ اعلانی برای مدیر ثبت نشد — کاربر بی‌خبر می‌ماند که چرا محصولات غایب‌اند';
	} else {
		echo "✓ اعلان پنل ثبت شد (کاربر می‌فهمد چرا craneProducts نیست)\n";
	}
} elseif ( ! $pt ) {
	$errors[] = 'نوع محتوای product اصلاً ثبت نشد';
} elseif ( 'محصولات کرین یدک' !== ( $pt['labels']['name'] ?? '' ) ) {
	$errors[] = 'بدون ووکامرس، ثبت product باید مال ما باشد';
} else {
	echo "✓ بدون ووکامرس، رفتار دقیقاً مثل قبل است (سازگاری عقب‌رو)\n";
}

/* ═══════════════════════════════════════════════════════════════════════════
   جدول گزارش، و گروه‌های ACF یتیم
   ═══════════════════════════════════════════════════════════════════════════
   آزمون‌های مهاجرت بلوک‌ها با خودِ ابزار مهاجرت حذف شدند — مهاجرت انجام
   شد و ابزارش مهلت‌دار بود. ولی این دو آزمون به مهاجرت ربطی نداشتند و
   هر دو باگ واقعی گرفته‌اند، پس می‌مانند. */
{
	/* رندر جدول گزارش.
	   جدول ورود JSON ردیف‌های چهارتایی می‌دهد و یک بار سه ستون داشت:
	   ستون‌ها یکی لغزیدند و متن «نتیجه» اصلاً چاپ نشد — یعنی صفحه‌ای که
	   کارفرما بر اساسش تصمیم می‌گرفت، دروغ می‌گفت. */
	$cols = [ 'نوع' => '80px', 'اسلاگ' => '170px', 'فیلد' => '190px', 'نتیجه' => '' ];
	$rows = [
		[ 'برند', 'demag', 'intro', 'نوشته می‌شود — ۸۴۰ کاراکتر' ],
		[ 'دسته', 'rope-guide', 'seo_intro', 'رد شد (از قبل پر است)' ],
	];

	ob_start();
	cyh_hub_table( $cols, $rows, [ 1, 2 ] );
	$html = ob_get_clean();

	$lost = [];
	foreach ( $rows as $row ) {
		foreach ( $row as $cell ) {
			if ( false === strpos( $html, esc_html( (string) $cell ) ) ) {
				$lost[] = $cell;
			}
		}
	}
	if ( $lost ) {
		$errors[] = 'جدول گزارش ' . count( $lost ) . ' مقدار را نمی‌نویسد: «' . implode( '»، «', $lost ) . '»';
	} elseif ( substr_count( $html, '<td' ) !== count( $rows ) * count( $cols ) ) {
		$errors[] = 'جدول گزارش ' . substr_count( $html, '<td' ) . ' خانه دارد ولی باید '
			. ( count( $rows ) * count( $cols ) ) . ' باشد — ستون‌ها جابه‌جا شده‌اند';
	} else {
		echo "✓ جدول گزارش هر چهار مقدار هر ردیف را چاپ می‌کند\n";
	}

	// ردیف ناهماهنگ باید فریاد بزند، نه اینکه ستون‌ها را بلغزاند.
	ob_start();
	cyh_hub_table( $cols, [ [ 'برند', 'demag', 'intro' ] ], [ 1 ] );
	$bad = ob_get_clean();
	if ( false === strpos( $bad, 'خراب است' ) ) {
		$errors[] = 'ردیف ناهماهنگ بی‌صدا رندر شد — باگی که گزارش را دروغ‌گو کرده بود برگشته';
	} else {
		echo "✓ ردیف ناهماهنگ به‌جای لغزاندن ستون‌ها، قرمز و صریح گزارش می‌شود\n";
	}

	/* گروه‌های ACF یتیم — سه گروه بازنشسته ماه‌ها در وردپرس زنده ماندند
	   چون «حذف» فقط در مخزن انجام شده بود. */
	$saved_groups = $GLOBALS['cyh_test_acf_groups'] ?? [];
	$GLOBALS['cyh_test_acf_groups'] = [
		[ 'key' => 'group_cyh_content_blocks', 'title' => 'بلوک‌های محتوا' ],
		[ 'key' => 'group_cyh_brand_profile', 'title' => 'پروفایل تخصصی برند' ],
		[ 'key' => 'group_cyh_datasheet_fields', 'title' => 'Datasheet Fields' ],
		[ 'key' => 'group_other_plugin', 'title' => 'مال افزونه‌ی دیگر', 'local' => 'json' ],
	];

	$keys = array_column( cyh_acf_orphan_groups(), 0 );
	sort( $keys );
	$want = [ 'group_cyh_brand_profile', 'group_cyh_datasheet_fields' ];
	if ( $keys !== $want ) {
		$errors[] = 'تشخیص گروه یتیم غلط است: ' . json_encode( $keys, JSON_UNESCAPED_UNICODE );
	} else {
		echo "✓ گروه ACF یتیم تشخیص داده می‌شود (شناخته‌شده و local نادیده گرفته می‌شوند)\n";
	}

	$GLOBALS['cyh_test_acf_groups'] = $saved_groups;

	/* ═══════════════════════════════════════════════════════════════════════
	   قالب نویسنده → ردیف‌های ACF
	   ═══════════════════════════════════════════════════════════════════════
	   ابزار ورود تا امروز روی فیلدهای مدل **قدیمی** می‌نوشت (`seo_intro`،
	   `symptoms`، `series`…) که گروه‌هایشان در ۳.۰.۰ حذف شده بودند. یعنی
	   محتوا در postmeta می‌نشست و هیچ‌جا خوانده نمی‌شد — بی‌صدا. */
	$term_id = 9001;
	$GLOBALS['cyh_test_terms'][ $term_id ] = (object) [
		'term_id' => $term_id, 'slug' => 'wire-rope', 'name' => 'سیم‌بکسل',
	];

	list( $acf, $errs ) = cyh_hub_blocks_to_acf( [
		[ 'type' => 'text', 'heading' => 'معرفی', 'body' => '<p>متن</p>' ],
		[ 'type' => 'table', 'heading' => 'جدول', 'columns' => [ 'الف', 'ب' ], 'rows' => [ [ '۱', '۲' ] ] ],
		[ 'type' => 'faq', 'heading' => 'پرسش‌ها', 'faqs' => [ [ 'q' => 'چرا؟', 'a' => 'چون.' ] ] ],
		[ 'type' => 'specs', 'heading' => 'مشخصات', 'specs' => [ [ 'label' => 'قطر', 'value' => '۱۰', 'unit' => 'mm' ] ] ],
		[ 'type' => 'callout', 'tone' => 'danger', 'heading' => 'هشدار', 'body' => 'مراقب باشید.' ],
		[ 'type' => 'parts', 'heading' => 'قطعات', 'parts' => [ [ 'name' => 'قلاب', 'category' => 'wire-rope', 'reason' => 'سایش' ] ] ],
	] );

	if ( count( $acf ) !== 6 ) {
		$errors[] = 'تبدیل قالب نویسنده ' . count( $acf ) . ' بلوک ساخت، نه ۶';
	} elseif ( 'الف' !== $acf[1]['col1'] || '۲' !== $acf[1]['rows'][0]['c2'] ) {
		$errors[] = 'جدول: columns/rows به col1..5 و c1..5 نگاشت نشد';
	} elseif ( 'چرا؟' !== $acf[2]['faqs'][0]['question'] ) {
		$errors[] = 'پرسش: q/a به question/answer نگاشت نشد';
	} elseif ( 'danger' !== $acf[4]['tone'] || 'مراقب باشید.' !== $acf[4]['callout_body'] ) {
		$errors[] = 'هشدار: tone یا callout_body درست نشد';
	} elseif ( $term_id !== $acf[5]['parts'][0]['category'] ) {
		$errors[] = 'قطعات: اسلاگ دسته به شناسه‌ی ترم تبدیل نشد (ارجاع شکسته‌ی بی‌صدا)';
	} elseif ( $errs ) {
		$errors[] = 'ورودی سالم نباید خطا بدهد: ' . implode( ' | ', $errs );
	} else {
		echo "✓ قالب نویسنده به ردیف‌های ACF تبدیل می‌شود (۶ نوع بلوک)\n";
	}

	// ⚠️ بلوکی که روی سایت دیده نمی‌شود باید **گزارش** شود، نه بی‌صدا رد.
	list( $bad_acf, $bad_errs ) = cyh_hub_blocks_to_acf( [
		[ 'type' => 'table', 'heading' => 'بی‌ردیف', 'columns' => [ 'الف' ] ],
		[ 'type' => 'text', 'heading' => 'بی‌متن' ],
		[ 'type' => 'chart', 'heading' => 'نوع نامعتبر' ],
		[ 'type' => 'parts', 'heading' => 'دسته‌ی ناموجود', 'parts' => [ [ 'name' => 'x', 'category' => 'ghost-cat' ] ] ],
	] );
	if ( count( $bad_errs ) < 4 ) {
		$errors[] = 'ورودی خراب فقط ' . count( $bad_errs ) . ' خطا داد — بلوک نامرئی بی‌صدا رد می‌شود';
	} else {
		echo '✓ ' . count( $bad_errs ) . " مشکلِ «روی سایت دیده نمی‌شود» گزارش شد به‌جای سکوت\n";
	}

	/* ═══════════════════════════════════════════════════════════════════════
	   کلید ریشه‌ی فایل ورود
	   ═══════════════════════════════════════════════════════════════════════
	   `$kind . 's'` برای category می‌شد «categorys» — کلیدی که وجود ندارد.
	   پس ورود دسته هیچ‌وقت کار نکرده بود، و چون گزارش خالی برمی‌گشت و هیچ
	   خطایی نمی‌داد، کسی نفهمید. */
	$tid = 7701;
	$GLOBALS['cyh_test_terms'][ $tid ] = (object) [ 'term_id' => $tid, 'slug' => 'wire-rope', 'name' => 'سیم‌بکسل' ];

	$res = cyh_hub_import(
		[
			'_راهنما'    => [ 'هر' => 'چیزی' ],
			'categories' => [
				'wire-rope' => [
					'keyword' => 'سیم‌بکسل جرثقیل',
					'blocks'  => [
						[ 'type' => 'text', 'heading' => 'معرفی', 'body' => '<p>متن</p>' ],
						[ 'type' => 'faq', 'heading' => 'پرسش', 'faqs' => [ [ 'q' => 'چرا؟', 'a' => 'چون.' ] ] ],
					],
				],
			],
		],
		false,
		true
	);

	$fields_seen = array_column( $res['rows'], 2 );
	if ( ! in_array( 'blocks', $fields_seen, true ) ) {
		$errors[] = 'کلید «categories» خوانده نشد — همان باگی که ورود دسته را بی‌صدا از کار انداخته بود';
	} elseif ( ! in_array( 'keyword', $fields_seen, true ) ) {
		$errors[] = 'فیلد هویتی «keyword» در کنار بلوک‌ها نوشته نشد';
	} else {
		echo "✓ کلید «categories» خوانده می‌شود و بلوک‌ها به ردیف ACF تبدیل می‌شوند\n";
	}

	// کلید ریشه‌ی غلط باید گزارش شود، نه بلعیده.
	$noisy = cyh_hub_import( [ 'categorys' => [ 'wire-rope' => [ 'keyword' => 'x' ] ] ], false, true );
	if ( false === strpos( implode( ' ', array_column( $noisy['rows'], 3 ) ), 'کلید ناشناخته' ) ) {
		$errors[] = 'کلید ریشه‌ی غلط («categorys») بی‌صدا نادیده گرفته شد';
	} else {
		echo "✓ کلید ریشه‌ی ناشناخته گزارش می‌شود به‌جای سکوت\n";
	}

	// فایل بدون هیچ موجودیتی هم باید دلیلش را بگوید.
	if ( ! cyh_hub_import( [], false, true )['rows'] ) {
		$errors[] = 'فایل خالی یک جدول بی‌ردیف می‌دهد — کاربر باید حدس بزند چه شد';
	} else {
		echo "✓ فایل بدون برند و دسته، دلیلش را می‌گوید\n";
	}
}


/*
 * ⚠️ آزمون `craneCommerce` عمداً حذف شد — و این حذف، خودش یک آزمون است.
 *
 * آن فیلد بخشی از پل ووکامرس بود که به‌درخواست صریح شما کاملاً پاک شد.
 * ولی هارنس همچنان وجودش را الزامی می‌دانست، پس یک ❌ چاپ می‌کرد برای
 * چیزی که **درست** بود: نبودن کدی که خواسته بودیم نباشد.
 *
 * تستی که برای کد حذف‌شده شکست می‌خورد، بدتر از بی‌فایده است — آدم را
 * وادار می‌کند یا کد مرده را برگرداند یا یاد بگیرد خطای قرمز را نادیده
 * بگیرد. هر دو نتیجه بد است.
 *
 * چیزی که *هنوز* آزموده می‌شود و مهم است، بالاتر است: اگر ووکامرس نصب
 * شود، ما مالکیت نوع محتوای `product` را واگذار می‌کنیم ولی تنظیمات
 * گراف‌کیوال خودمان را تزریق می‌کنیم تا `craneProducts` از اسکیما نیفتد
 * و فرانت‌اند نشکند. آن محافظ ده‌خطی هنوز در `class-post-types.php` هست.
 */

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
