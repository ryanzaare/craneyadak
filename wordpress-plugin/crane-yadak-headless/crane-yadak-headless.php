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

require_once CYH_PLUGIN_DIR . 'includes/class-post-types.php';
require_once CYH_PLUGIN_DIR . 'includes/class-cors.php';
require_once CYH_PLUGIN_DIR . 'includes/class-rest-contact.php';
require_once CYH_PLUGIN_DIR . 'includes/class-admin-settings.php';
require_once CYH_PLUGIN_DIR . 'includes/class-options-page.php';
require_once CYH_PLUGIN_DIR . 'includes/class-deploy-webhook.php';

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
