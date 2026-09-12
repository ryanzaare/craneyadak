<?php
/**
 * تشخیص گروه‌های ACF یتیم.
 *
 * ⚠️ چرا این فایل در `includes/` است و نه در فایل اصلی افزونه:
 *
 * هارنس آزمون فقط `includes/*.php` را require می‌کند. این دو تابع اول در
 * فایل اصلی نوشته شدند، پس هارنس هرگز نمی‌دیدشان و آزمونشان با
 * «Call to undefined function» می‌مرد — در حالی که در وردپرس واقعی کاملاً
 * سالم بودند.
 *
 * یعنی یک تابع می‌تواند درست باشد و آزمونش غیرممکن، فقط به خاطر اینکه در
 * کدام فایل نوشته شده. از این پس هر تابعی که آزمون لازم دارد، باید در
 * `includes/` باشد — و `check-stub-coverage.php` این را الزام می‌کند.
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * گروه‌های ACF یتیم — آن‌هایی که در وردپرس هستند ولی مخزن نمی‌شناسدشان.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * شکافی که این تابع می‌بندد
 * ═══════════════════════════════════════════════════════════════════════
 * سند معماری فهرستی از گروه‌های ACF داشت با عنوان «پاک می‌شوند»، و بعداً
 * علامت «✅ اجرا شد» خورد چون **فایل‌های فرانت‌اند** بررسی و تأیید شدند
 * که حذف شده‌اند. ولی گروه ACF فقط در مخزن حذف نشده بود — باید از خودِ
 * وردپرس هم حذف می‌شد، و نشد.
 *
 * نتیجه: سه گروه (`datasheet_fields`، `category_content`، `brand_profile`)
 * ماه‌ها در پنل زنده ماندند. یعنی صفحه‌ی ویرایش برند هنوز ۱۲ فیلد قدیمی
 * نشان می‌داد، در حالی که همه‌ی مستندات می‌گفتند آن مدل بازنشسته شده.
 *
 * ریشه‌ی مسئله ساختاری است: `check-architecture.mjs` فقط پوشه‌ی `acf-json`
 * را می‌بیند. هیچ ابزاری در سمت مخزن نمی‌تواند بداند در پایگاه داده‌ی
 * وردپرس چه هست. تنها جایی که می‌شود این را فهمید، **داخل خود وردپرس**
 * است — یعنی همین‌جا.
 *
 * این تابع چیزی حذف نمی‌کند. حذف تصمیم انسان است؛ کار این تابع فقط این
 * است که دیگر ممکن نباشد کسی نداند.
 */
function cyh_acf_orphan_groups() {
	if ( ! function_exists( 'acf_get_field_groups' ) ) {
		return [];
	}

	$known = [];
	foreach ( (array) glob( CYH_PLUGIN_DIR . 'acf-json/*.json' ) as $file ) {
		$raw = file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		if ( false === $raw ) {
			continue;
		}
		$g = json_decode( $raw, true );
		if ( is_array( $g ) && ! empty( $g['key'] ) ) {
			$known[ $g['key'] ] = true;
		}
	}

	// اگر هیچ JSONای خوانده نشد یعنی مسیر خراب است، نه اینکه همه یتیم‌اند.
	if ( ! $known ) {
		return [];
	}

	$orphans = [];
	foreach ( (array) acf_get_field_groups() as $group ) {
		$key = $group['key'] ?? '';
		if ( '' === $key || isset( $known[ $key ] ) ) {
			continue;
		}
		// گروه‌های local متعلق به افزونه‌های دیگرند و به ما ربطی ندارند.
		if ( ! empty( $group['local'] ) ) {
			continue;
		}
		$orphans[] = [ $key, (string) ( $group['title'] ?? $key ) ];
	}

	return $orphans;
}

function cyh_acf_orphan_notice() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	$id     = is_object( $screen ) ? (string) ( $screen->id ?? '' ) : '';
	if ( false === strpos( $id, 'acf-field-group' ) ) {
		return;
	}

	$orphans = cyh_acf_orphan_groups();
	if ( ! $orphans ) {
		return;
	}

	$rows = [];
	foreach ( $orphans as $o ) {
		$rows[] = sprintf( '<li><strong>%s</strong> — <code>%s</code></li>', esc_html( $o[1] ), esc_html( $o[0] ) );
	}

	printf(
		'<div class="notice notice-warning"><p><strong>%d گروه فیلد در وردپرس هست که افزونه نمی‌شناسد:</strong></p><ul style="margin-inline-start:20px;list-style:disc">%s</ul>' .
		'<p>این‌ها یا از نسخه‌های قدیمی مانده‌اند یا دستی ساخته شده‌اند. اگر بازنشسته‌اند، ' .
		'<strong>حذفشان از همین صفحه لازم است</strong> — حذف از مخزن کافی نیست و آن‌ها را از پنل پاک نمی‌کند. ' .
		'مقادیر ذخیره‌شده در پایگاه داده با حذف گروه از بین نمی‌روند.</p></div>',
		count( $orphans ),
		implode( '', $rows )
	);
}
add_action( 'admin_notices', 'cyh_acf_orphan_notice' );
