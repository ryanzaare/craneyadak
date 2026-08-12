<?php
/**
 * Plugin Name:       Crane Yadak — Headless Backend
 * Plugin URI:        https://craneyadak.com
 * Description:       بک‌اند Headless برای فرانت‌اند Astro سایت کرین یدک. CPTهای محصول/برند/صنعت/سند فنی
 *                     را با پشتیبانی WPGraphQL ثبت می‌کند، فیلدهای ACF Pro را از طریق Local JSON همگام
 *                     نگه می‌دارد، و یک اندپوینت REST امن برای فرم استعلام قیمت فراهم می‌کند.
 * Version:           1.0.0
 * Requires PHP:      8.0
 * Requires Plugins:  advanced-custom-fields-pro, wp-graphql
 * Author:            Crane Yadak Engineering
 * Text Domain:       crane-yadak-headless
 *
 * ---------------------------------------------------------------------------
 * نکته معماری مهم: این پلاگین به‌عمد به‌جای افزودن منطق پراکنده در functions.php
 * قالب، به‌صورت یک پلاگین مستقل نوشته شده. چرا؟ چون در معماری Headless، قالب
 * (Theme) اصلاً رندر نمی‌شود — تنها وردپرس به‌عنوان منبع داده (از طریق
 * WPGraphQL) استفاده می‌شود. نگه‌داشتن منطق CPT/ACF/REST در یک پلاگین یعنی
 * حتی با تعویض قالب هم، بک‌اند سالم می‌ماند.
 * ---------------------------------------------------------------------------
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // دسترسی مستقیم مجاز نیست.
}

define( 'CYH_VERSION', '1.0.0' );
define( 'CYH_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'CYH_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * بررسی پیش‌نیازها — به‌جای شکست خاموش، به مدیر سایت هشدار واضح می‌دهد که
 * ACF Pro و WPGraphQL نصب/فعال نیستند. این یک تصمیم آگاهانه است: بدون این
 * دو افزونه، هیچ‌کدام از CPTها یا فیلدها در گراف‌کیوال قابل مشاهده نخواهند
 * بود و دیباگ آن بدون این پیام هشدار بسیار زمان‌بر خواهد بود.
 */
function cyh_check_dependencies() {
	$missing = [];

	if ( ! class_exists( 'ACF' ) ) {
		$missing[] = 'Advanced Custom Fields PRO';
	}

	if ( ! class_exists( 'WPGraphQL' ) ) {
		$missing[] = 'WPGraphQL';
	}

	if ( ! empty( $missing ) ) {
		add_action(
			'admin_notices',
			function () use ( $missing ) {
				printf(
					'<div class="notice notice-error"><p><strong>Crane Yadak Headless:</strong> افزونه(های) پیش‌نیاز فعال نیستند: %s. تا نصب و فعال‌سازی این افزونه‌ها، محصولات/برندها/صنایع در WPGraphQL قابل کوئری نخواهند بود.</p></div>',
					esc_html( implode( '، ', $missing ) )
				);
			}
		);
	}
}
add_action( 'admin_init', 'cyh_check_dependencies' );

/**
 * ⚠️ حیاتی: معرفی پوشه‌ی acf-json این پلاگین به ACF.
 *
 * باگی که این تابع رفع می‌کند: ACF به‌صورت پیش‌فرض فقط پوشه‌ی `acf-json`
 * داخل *قالب* را برای Local JSON اسکن می‌کند. یک پلاگین باید مسیر خودش را
 * صراحتاً با فیلتر `acf/settings/load_json` معرفی کند؛ وگرنه فایل‌های JSON
 * گروه‌های فیلد هرگز خوانده نمی‌شوند و عملاً انگار وجود ندارند.
 *
 * علامت این باگ در فرانت‌اند دقیقاً همین بود:
 *   Cannot query field "productFields" on type "CraneProduct"
 *   Cannot query field "brandFields" on type "CraneBrand"
 * یعنی CPTها درست ثبت شده بودند اما هیچ گروه فیلدی به آن‌ها وصل نبود، چون
 * ACF اصلاً این پنج فایل JSON را ندیده بود.
 *
 * نکته: مسیر پیش‌فرض قالب حذف نمی‌شود، فقط مسیر این پلاگین به آن اضافه
 * می‌شود — تا اگر روزی گروه فیلدی سمت قالب تعریف شد، از کار نیفتد.
 */
function cyh_register_acf_json_load_path( $paths ) {
	$paths[] = CYH_PLUGIN_DIR . 'acf-json';
	return $paths;
}
add_filter( 'acf/settings/load_json', 'cyh_register_acf_json_load_path' );

/**
 * محل ذخیره‌ی تغییرات گروه‌های فیلد نیز همین پوشه است، تا اگر مدیر سایت در
 * پنل ACF چیزی را ویرایش کرد، همان فایل JSON داخل پلاگین به‌روز شود و
 * تعریف فیلدها بین وردپرس و مخزن کد از هم واگرا نشود.
 */
function cyh_register_acf_json_save_path( $path ) {
	return CYH_PLUGIN_DIR . 'acf-json';
}
add_filter( 'acf/settings/save_json', 'cyh_register_acf_json_save_path' );

/**
 * هشدار «شما در صفحه‌ی اشتباه هستید».
 *
 * مسئله‌ی واقعی که این تابع حل می‌کند: روی این نصب وردپرس، یک نوع پست
 * دیگر با نامی شبیه «قطعات جرثقیل» وجود دارد که متعلق به این پلاگین نیست.
 * ادمین سایت (که لزوماً فنی نیست) وارد آن صفحه می‌شود، هیچ فیلدی از
 * فیلدهای محصول را نمی‌بیند و طبیعتاً نتیجه می‌گیرد که «پلاگین خراب است».
 * این دقیقاً یک بار اتفاق افتاد و یک چرخه‌ی کامل دیباگ هدر داد.
 *
 * وردپرس راهی برای جلوگیری از ثبت CPT توسط کد دیگر ندارد؛ اما می‌توان
 * لحظه‌ای که کاربر در صفحه‌ی اشتباه است را تشخیص داد و او را به صفحه‌ی
 * درست هدایت کرد.
 */
function cyh_warn_on_foreign_crane_post_type() {
	if ( ! function_exists( 'get_current_screen' ) ) {
		return;
	}

	$screen = get_current_screen();
	if ( ! $screen || ! in_array( $screen->base, [ 'post', 'edit' ], true ) ) {
		return;
	}

	$current = $screen->post_type;
	$ours    = [ 'product', 'brand', 'industry', 'datasheet', 'inquiry' ];

	// فقط وقتی هشدار می‌دهیم که: نوع پست جاری مال ما نباشد، و نامش به‌وضوح
	// شبیه محتوای همین پلاگین باشد. این محدودیت عمدی است تا روی نوشته‌ها و
	// برگه‌های عادی وردپرس هشدار بی‌ربط نشان داده نشود.
	if ( in_array( $current, $ours, true ) ) {
		return;
	}

	$object = get_post_type_object( $current );
	if ( ! $object ) {
		return;
	}

	$label = $object->labels->name ?? '';
	if ( ! preg_match( '/جرثقیل|قطعه|قطعات|crane|part/iu', $label . ' ' . $current ) ) {
		return;
	}

	$correct_url = admin_url( 'post-new.php?post_type=product' );

	printf(
		'<div class="notice notice-warning"><p><strong>توجه:</strong> این صفحه («%1$s») متعلق به افزونه‌ی کرین یدک نیست و فیلدهای محصول (کد فنی، برند، قیمت، دسته‌بندی) در آن نمایش داده نمی‌شوند. برای ثبت قطعه از منوی <strong>«محصولات کرین یدک»</strong> استفاده کنید. &nbsp;<a class="button button-primary" href="%2$s">افزودن محصول در صفحه‌ی درست</a></p></div>',
		esc_html( $label ),
		esc_url( $correct_url )
	);
}
add_action( 'admin_notices', 'cyh_warn_on_foreign_crane_post_type' );

require_once CYH_PLUGIN_DIR . 'includes/class-post-types.php';
require_once CYH_PLUGIN_DIR . 'includes/class-cors.php';
require_once CYH_PLUGIN_DIR . 'includes/class-rest-contact.php';
require_once CYH_PLUGIN_DIR . 'includes/class-admin-settings.php';
require_once CYH_PLUGIN_DIR . 'includes/class-options-page.php';
require_once CYH_PLUGIN_DIR . 'includes/class-deploy-webhook.php';
require_once CYH_PLUGIN_DIR . 'includes/class-content-seeder.php';
require_once CYH_PLUGIN_DIR . 'includes/class-demo-seeder.php';

/**
 * فلاش‌کردن Rewrite Rules هنگام فعال/غیرفعال‌سازی — بدون این، اسلاگ‌های
 * سفارشی CPT (مثل /brands/) تا اولین ذخیره‌ی دستی Permalinks کار نمی‌کنند
 * و یک باگ کلاسیک و گیج‌کننده‌ی وردپرس برای هرکسی است که این مرحله را فراموش کند.
 */
function cyh_activate() {
	cyh_register_post_types();
	cyh_register_taxonomies();
	flush_rewrite_rules();
}
register_activation_hook( __FILE__, 'cyh_activate' );

function cyh_deactivate() {
	flush_rewrite_rules();
	cyh_clear_deploy_cron(); // تعریف در includes/class-deploy-webhook.php
}
register_deactivation_hook( __FILE__, 'cyh_deactivate' );

/**
 * نکته آگاهانه (یافته‌شده در بازبینی — تصمیم عمدی، نه یک قلم فراموش‌شده):
 * این پلاگین عمداً هیچ uninstall.php ندارد که محصولات/برندها/و مخصوصاً
 * درخواست‌های استعلام (CPT «inquiry» که شامل نام و شماره تماس مشتریان
 * واقعی است) را هنگام حذف پلاگین پاک کند. حذف خودکار داده‌ی مشتری با یک
 * کلیک تصادفی «Delete» روی پلاگین، خطرناک‌تر از نگه‌داشتن چند رکورد
 * اضافه در دیتابیس است. اگر روزی نیاز به پاک‌سازی کامل بود، این کار باید
 * آگاهانه و دستی از داشبورد وردپرس انجام شود، نه خودکار و برگشت‌ناپذیر.
 */
