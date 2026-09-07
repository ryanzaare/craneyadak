<?php
/**
 * پاک‌سازی بازمانده‌های قدیمی.
 *
 * ---------------------------------------------------------------------------
 * مسئله
 *
 * یک نوع محتوای سفارشی به نام `crane-part` با برچسب «قطعات جرثقیل» در پنل
 * وجود دارد که **این پلاگین آن را ثبت نکرده** (با grep روی کل کد تایید شد).
 * از یک نسخه‌ی قدیمی، قالب، یا افزونه‌ی دیگری می‌آید.
 *
 * نتیجه‌اش یک منوی خالی و گمراه‌کننده است: مدیر محتوا محصول را آنجا وارد
 * می‌کند، فرانت‌اند هیچ‌وقت آن را نمی‌بیند، و کسی نمی‌فهمد چرا.
 *
 * ---------------------------------------------------------------------------
 * چرا unregister و نه حذف
 *
 * `unregister_post_type()` فقط نوع محتوا را از وردپرس برمی‌دارد — **هیچ
 * پستی حذف نمی‌شود**. رکوردها در جدول `wp_posts` دست‌نخورده می‌مانند.
 * اگر روزی معلوم شد داده‌ی واقعی داخلشان بوده، با غیرفعال کردن این فایل
 * (ثابت `CYH_KEEP_LEGACY_CRANE_PART`) همه‌چیز برمی‌گردد.
 *
 * ⚠️ به همین دلیل، پیش از پنهان کردن، تعداد پست‌های داخلش شمرده می‌شود و
 * اگر خالی نبود به مدیر هشدار داده می‌شود. پنهان کردنِ خاموشِ داده‌ی واقعی
 * دقیقاً همان «شکست خاموش»ی است که در این پروژه ممنوع است.
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** نوع‌های محتوای بازمانده که باید پنهان شوند. */
function cyh_legacy_post_types() {
	return [ 'crane-part' ];
}

/**
 * پنهان کردن نوع محتوای بازمانده.
 *
 * اولویت ۹۹۹ عمدی است: هر چیزی که این نوع را ثبت می‌کند (قالب یا افزونه‌ی
 * دیگر) روی `init` با اولویت پیش‌فرض ۱۰ این کار را می‌کند. اگر ما زودتر
 * اجرا شویم، چیزی برای برداشتن وجود ندارد و کار بی‌اثر می‌ماند.
 */
function cyh_unregister_legacy_post_types() {
	if ( defined( 'CYH_KEEP_LEGACY_CRANE_PART' ) && CYH_KEEP_LEGACY_CRANE_PART ) {
		return;
	}

	foreach ( cyh_legacy_post_types() as $type ) {
		if ( ! post_type_exists( $type ) ) {
			continue;
		}

		// ⚠️ نگهبان: هرگز نوع محتوای خودمان را حذف نکن. اگر روزی کسی
		// اشتباهی نام یکی از CPTهای ما را در فهرست بالا بگذارد، این خط
		// جلوی خاموش‌شدن نیمی از سایت را می‌گیرد.
		if ( in_array( $type, [ 'product', 'brand', 'inquiry', 'cyh_quote' ], true ) ) {
			continue;
		}

		// شمارش پست‌های داخلش — برای هشدار، نه برای جلوگیری.
		$counts = (array) wp_count_posts( $type );
		$total  = 0;
		foreach ( $counts as $state => $n ) {
			if ( 'auto-draft' !== $state ) {
				$total += (int) $n;
			}
		}
		if ( $total > 0 ) {
			$GLOBALS['cyh_legacy_with_data'][ $type ] = $total;
		}

		unregister_post_type( $type );
	}
}
add_action( 'init', 'cyh_unregister_legacy_post_types', 999 );

/**
 * حذف منو — کمربند ایمنی دوم.
 *
 * اگر آن افزونه/قالب منو را مستقیم با `add_menu_page()` ساخته باشد (نه از
 * راه CPT)، unregister بالا کاری نمی‌کند و منو سر جایش می‌ماند.
 */
function cyh_remove_legacy_menus() {
	if ( defined( 'CYH_KEEP_LEGACY_CRANE_PART' ) && CYH_KEEP_LEGACY_CRANE_PART ) {
		return;
	}

	foreach ( cyh_legacy_post_types() as $type ) {
		remove_menu_page( 'edit.php?post_type=' . $type );
	}
}
add_action( 'admin_menu', 'cyh_remove_legacy_menus', 999 );

/**
 * هشدار اگر نوع پنهان‌شده داده‌ی واقعی داشت.
 */
function cyh_notice_legacy_with_data() {
	if ( empty( $GLOBALS['cyh_legacy_with_data'] ) ) {
		return;
	}

	foreach ( $GLOBALS['cyh_legacy_with_data'] as $type => $count ) {
		printf(
			'<div class="notice notice-warning"><p><strong>کرین یدک:</strong> منوی قدیمی <code>%s</code> پنهان شد، اما <strong>%d رکورد</strong> داخلش وجود دارد.</p>' .
			'<p>هیچ داده‌ای حذف نشده است. اگر محتوای واقعی داخلشان است، پیش از ادامه آن را به «محصولات کرین یدک» منتقل کنید. ' .
			'برای برگرداندن موقت منو، این خط را به <code>wp-config.php</code> اضافه کنید:<br>' .
			'<code>define( \'CYH_KEEP_LEGACY_CRANE_PART\', true );</code></p></div>',
			esc_html( $type ),
			(int) $count
		);
	}
}
add_action( 'admin_notices', 'cyh_notice_legacy_with_data' );
