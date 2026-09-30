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

/**
 * مقصد GitHub Actions (repository_dispatch): مخزن `owner/repo` از تنظیمات، و توکن
 * **فقط از ثابت CYH_GITHUB_TOKEN در wp-config.php** — هرگز در پایگاه داده (نسخه‌ی
 * پشتیبان یا خروجی گرفتن از پایگاه داده توکن را لو نمی‌دهد).
 */
/**
 * owner: حرف/عدد/خط‌تیره (بدون شروع با نقطه)؛ repo: حرف/عدد/._- ولی نه «.» و «..».
 * ⚠️ الگوی ساده‌ی [\w.-]+ کلمه‌ی «../x» را می‌پذیرفت و به نشانی /repos/../x/dispatches می‌رسید.
 */
function cyh_valid_github_repo( $value ) {
	$value = trim( (string) $value );
	if ( ! preg_match( '#^[A-Za-z0-9][A-Za-z0-9-]*/([A-Za-z0-9_.-]+)$#', $value, $m ) ) {
		return '';
	}
	return in_array( $m[1], [ '.', '..' ], true ) ? '' : $value;
}

function cyh_github_repo() {
	return cyh_valid_github_repo( get_option( 'cyh_github_repo', '' ) );
}

function cyh_github_token() {
	return defined( 'CYH_GITHUB_TOKEN' ) ? trim( (string) CYH_GITHUB_TOKEN ) : '';
}

function cyh_github_configured() {
	return '' !== cyh_github_repo() && '' !== cyh_github_token();
}

/** حداقل یک مقصد انتشار (Deploy Hook یا GitHub) تنظیم شده؟ */
function cyh_deploy_configured() {
	return '' !== trim( (string) get_option( 'cyh_deploy_hook_url', '' ) ) || cyh_github_configured();
}

function cyh_maybe_schedule_deploy() {
	if ( ! (bool) get_option( 'cyh_deploy_hook_enabled', false ) ) {
		return;
	}

	if ( ! cyh_deploy_configured() ) {
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
	$relevant_types = [ 'product', 'brand', 'post' ]; // 'post' = مقالات مجله

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
	$errors   = [];

	if ( ! cyh_deploy_configured() ) {
		return;
	}

	if ( '' !== $hook_url ) {
		$response = wp_remote_post(
			$hook_url,
			[
				'timeout'  => 10,
				'blocking' => false, // منتظر پاسخ نمی‌مانیم؛ فقط فراخوانی را شلیک می‌کنیم.
				'body'     => [ 'source' => 'crane-yadak-headless', 'triggered_at' => current_time( 'mysql' ) ],
			]
		);
		if ( is_wp_error( $response ) ) {
			$errors[] = $response->get_error_message();
		}
	}

	// GitHub Actions: POST /repos/{owner}/{repo}/dispatches → ۲۰۴ = پذیرفته شد. برخلاف
	// Deploy Hook ساده، اینجا منتظر پاسخ می‌مانیم (داخل WP-Cron است، نه درخواست کاربر) تا
	// توکن نامعتبر/مخزن اشتباه در پنل دیده شود، نه اینکه بی‌صدا هیچ انتشاری اتفاق نیفتد.
	if ( cyh_github_configured() ) {
		$gh = wp_remote_post(
			'https://api.github.com/repos/' . cyh_github_repo() . '/dispatches',
			[
				'timeout' => 10,
				'headers' => [
					'Authorization'        => 'Bearer ' . cyh_github_token(),
					'Accept'               => 'application/vnd.github+json',
					'X-GitHub-Api-Version' => '2022-11-28',
					'User-Agent'           => 'crane-yadak-headless',
					'Content-Type'         => 'application/json',
				],
				'body'    => wp_json_encode( [ 'event_type' => 'wp-content-changed' ] ),
			]
		);
		if ( is_wp_error( $gh ) ) {
			$errors[] = 'GitHub: ' . $gh->get_error_message();
		} else {
			$code = wp_remote_retrieve_response_code( $gh );
			if ( 204 !== $code ) {
				// توکن هرگز در پیام خطا نمی‌آید.
				$errors[] = 401 === $code || 403 === $code
					? "GitHub کد {$code}: توکن نامعتبر است یا دسترسی «Contents: write» ندارد."
					: ( 404 === $code ? 'GitHub کد 404: مخزن اشتباه است یا توکن به آن دسترسی ندارد.' : "GitHub کد {$code}" );
			}
		}
	}

	// ثبت زمان آخرین تلاش برای نمایش در پنل ادمین (بازخورد به کاربر
	// غیرفنی که "آیا واقعاً دیپلوی زده شد؟" را می‌خواهد ببیند).
	update_option( 'cyh_deploy_last_triggered', current_time( 'mysql' ) );

	if ( $errors ) {
		update_option( 'cyh_deploy_last_error', implode( ' | ', $errors ) );
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
