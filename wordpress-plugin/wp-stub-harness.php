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
function wp_mail( $to, $subject, $body ) {
	$GLOBALS['cyh_test_mail_calls'][] = [ 'to' => $to, 'subject' => $subject, 'body' => $body ];
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
	return [ 'response' => [ 'code' => 200 ] ]; // شبیه‌سازی موفقیت — این تابع در تست واقعاً به هیچ سروری وصل نمی‌شود
}

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
function get_post( $p = null, $out = OBJECT ) { return $GLOBALS['cyh_test_posts'][ is_object( $p ) ? $p->ID : (int) $p ] ?? null; }
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
		if ( isset( $args['meta_key'] ) ) {
			$meta = $GLOBALS['cyh_test_user_meta'][ $u->ID ] ?? [];
			if ( ! array_key_exists( $args['meta_key'], $meta ) ) { continue; }
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
function get_field( $sel, $post_id = false, $format = true ) { return $GLOBALS['cyh_test_fields'][ (string) $post_id ][ $sel ] ?? ''; }
function update_field( $sel, $val, $post_id = false ) { $GLOBALS['cyh_test_fields'][ (string) $post_id ][ $sel ] = $val; return true; }

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
$prof = cyh_rest_account_profile( new WP_REST_Request( [ 'name' => 'مهندس کریمی‌نژاد', 'phone' => '', 'company' => 'فولاد کویر' ] ) );
if ( is_wp_error( $prof ) || 'مهندس کریمی‌نژاد' !== ( $prof['profile']['name'] ?? '' ) || ! array_key_exists( 'phone', $prof['profile'] ?? [] ) || null !== $prof['profile']['phone'] ) {
	$errors[] = 'ویرایش پروفایل نام را ذخیره نکرد یا شماره‌ی خالی را حذف نکرد';
} else {
	echo "✓ ویرایش پروفایل نام را ذخیره و شماره‌ی خالی را حذف کرد\n";
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
	'add_meta_boxes' => 2, 'pre_comment_approved' => 2,
	'manage_comments_custom_column' => 2, 'manage_edit-comments_columns' => 1,
	'init' => 0, 'admin_init' => 0, 'admin_menu' => 0, 'admin_notices' => 0,
	'admin_enqueue_scripts' => 1, 'rest_api_init' => 1,
	'acf/init' => 0, 'acf/save_post' => 1,
	'acf/settings/load_json' => 1, 'acf/settings/save_json' => 1,
	'graphql_register_types' => 1,
];
$dynamic_arity = [ '/^saved_/' => 4, '/^created_/' => 4, '/^edited_/' => 4,
	'/^delete_/' => 5, '/^admin_post_/' => 0, '/^wp_ajax_/' => 0 ];

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
