<?php
/**
 * وبهوک انتشار خودکار (Auto-Deploy Webhook).
 *
 * چرا این فایل لازم است؟ Astro یک سایت «استاتیک» می‌سازد — یعنی وقتی
 * مشتری (که هیچ دانش کدنویسی ندارد) در وردپرس یک محصول جدید Publish
 * می‌کند، آن تغییر فوراً در دیتابیس وردپرس ذخیره می‌شود اما در سایت
 * زنده (Live) نمایش داده نمی‌شود، مگر این‌که فرانت‌اند Astro دوباره
 * Build و Deploy شود. بدون این فایل، مشتری بعد از هر ویرایش باید به یک
 * توسعه‌دهنده پیام بدهد تا سایت را دستی rebuild کند — که دقیقاً همان
 * وابستگی‌ای است که قرار بود از بین برود.
 *
 * راه‌حل: هر میزبان استاتیک مدرن (Cloudflare Pages، Netlify، Vercel) یک
 * «Deploy Hook URL» ارائه می‌دهد — یک آدرس مخصوص که با یک درخواست POST
 * ساده به آن، کل فرآیند build+deploy را از راه دور فعال می‌کند. این
 * فایل، آن URL را (که مدیر سایت یک‌بار در تنظیمات پلاگین وارد می‌کند)
 * به‌صورت خودکار بعد از هر انتشار/ویرایش محتوای مرتبط فراخوانی می‌کند.
 *
 * نکته Debounce: اگر مشتری در عرض چند دقیقه ۱۰ محصول را پشت‌سرهم ویرایش
 * کند، فراخوانی ۱۰ باره‌ی جداگانه‌ی وبهوک هم برای بیشتر پلتفرم‌های
 * دیپلوی نامناسب است (Rate Limit پلتفرم دیپلوی) و هم بی‌فایده (فقط
 * آخرین build واقعاً به‌روز است). به همین دلیل، از WP-Cron برای «جمع
 * کردن» چند تغییر پشت‌سرهم در یک فراخوانی واحد (۶۰ ثانیه بعد از آخرین
 * تغییر) استفاده شده.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CYH_DEPLOY_CRON_HOOK', 'cyh_trigger_deploy_event' );

function cyh_maybe_schedule_deploy() {
	if ( ! (bool) get_option( 'cyh_deploy_hook_enabled', false ) ) {
		return;
	}

	$hook_url = trim( (string) get_option( 'cyh_deploy_hook_url', '' ) );

	if ( empty( $hook_url ) ) {
		return;
	}

	// Debounce: اگر از قبل یک رویداد زمان‌بندی‌شده در صف باشد، دوباره
	// اضافه نمی‌کنیم — یعنی ۵ ویرایش پشت‌سرهم فقط یک فراخوانی وبهوک
	// نتیجه می‌دهد، نه ۵ تا.
	if ( wp_next_scheduled( CYH_DEPLOY_CRON_HOOK ) ) {
		return;
	}

	wp_schedule_single_event( time() + 60, CYH_DEPLOY_CRON_HOOK );
}

/**
 * فقط برای CPTهایی که واقعاً محتوای مصرف‌شده توسط فرانت‌اند هستند فعال
 * می‌شود — نه هر پست/صفحه‌ای در وردپرس (مثلاً CPT «inquiry» عمداً
 * مستثنا شده چون آن داده اصلاً به فرانت‌اند Astro نمایش داده نمی‌شود).
 */
function cyh_on_post_save( $post_id, $post ) {
	$relevant_types = [ 'product', 'brand', 'industry', 'datasheet', 'post' ]; // 'post' = مقالات مجله

	if ( ! in_array( $post->post_type, $relevant_types, true ) ) {
		return;
	}

	// فقط تغییرات واقعاً منتشرشده باعث دیپلوی می‌شوند — Draft/Auto-Draft
	// نباید سایت زنده را rebuild کند.
	if ( 'publish' !== $post->post_status ) {
		return;
	}

	// Autosave و Revision را نادیده می‌گیریم — این‌ها هر چند ثانیه توسط
	// خودِ وردپرس ساخته می‌شوند و هیچ ربطی به محتوای نهایی ندارند.
	if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) ) {
		return;
	}

	cyh_maybe_schedule_deploy();
}
add_action( 'save_post', 'cyh_on_post_save', 10, 2 );

/**
 * تغییر در ترم‌های تکسونومی (مثل ویرایش نام یک دسته‌بندی) هم باید
 * دیپلوی را فعال کند — این تغییرات از هوک save_post عبور نمی‌کنند.
 */
function cyh_on_term_save( $term_id, $tt_id, $taxonomy ) {
	if ( 'crane_category' !== $taxonomy ) {
		return;
	}

	cyh_maybe_schedule_deploy();
}
add_action( 'saved_crane_category', 'cyh_on_term_save', 10, 3 );
add_action( 'delete_crane_category', 'cyh_on_term_save', 10, 3 );

/**
 * تابعی که واقعاً وبهوک را فراخوانی می‌کند — روی رویداد WP-Cron اجرا
 * می‌شود، نه مستقیم روی درخواست کاربر ادمین (تا صفحه‌ی ویرایش پست بدون
 * تاخیر شبکه‌ای لود شود).
 */
function cyh_execute_deploy_webhook() {
	$hook_url = trim( (string) get_option( 'cyh_deploy_hook_url', '' ) );

	if ( empty( $hook_url ) ) {
		return;
	}

	$response = wp_remote_post(
		$hook_url,
		[
			'timeout'  => 10,
			'blocking' => false, // منتظر پاسخ نمی‌مانیم؛ فقط فراخوانی را شلیک می‌کنیم.
			'body'     => [ 'source' => 'crane-yadak-headless', 'triggered_at' => current_time( 'mysql' ) ],
		]
	);

	// ثبت زمان آخرین تلاش برای نمایش در پنل ادمین (بازخورد به کاربر
	// غیرفنی که "آیا واقعاً دیپلوی زده شد؟" را می‌خواهد ببیند).
	update_option( 'cyh_deploy_last_triggered', current_time( 'mysql' ) );

	if ( is_wp_error( $response ) ) {
		update_option( 'cyh_deploy_last_error', $response->get_error_message() );
	} else {
		delete_option( 'cyh_deploy_last_error' );
	}
}
add_action( CYH_DEPLOY_CRON_HOOK, 'cyh_execute_deploy_webhook' );

/**
 * پاک‌سازی رویداد زمان‌بندی‌شده هنگام غیرفعال‌سازی پلاگین — بدون این،
 * یک رویداد Cron یتیم ممکن است باقی بماند. این تابع از cyh_deactivate()
 * در فایل اصلی پلاگین (crane-yadak-headless.php) فراخوانی می‌شود تا
 * register_deactivation_hook فقط یک‌بار و از فایل اصلی ثبت شود.
 */
function cyh_clear_deploy_cron() {
	$timestamp = wp_next_scheduled( CYH_DEPLOY_CRON_HOOK );
	if ( $timestamp ) {
		wp_unschedule_event( $timestamp, CYH_DEPLOY_CRON_HOOK );
	}
}
