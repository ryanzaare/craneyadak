<?php
/**
 * آپلود عکس در فرم استعلام.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * چرا لازم است
 * ═══════════════════════════════════════════════════════════════════════════
 * راهنمای خواندن پلاک به مشتری می‌گوید «عکس پلاک را بفرستید» — و هیچ راهی
 * برایش وجود نداشت. شکافی که خودمان ساختیم.
 *
 * برای این کسب‌وکار، عکس پلاک *مهم‌ترین* داده‌ی یک استعلام است: بدون کد
 * فنی، تأمین قطعه به حدس زدن از روی ابعاد تبدیل می‌شود.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ این یک نقطه‌ی آپلود *بدون احراز هویت* است
 * ═══════════════════════════════════════════════════════════════════════════
 * یعنی هر کسی روی اینترنت می‌تواند صدایش بزند. پس اعتماد به هیچ چیزی که
 * مرورگر می‌گوید:
 *
 *   • **پسوند فایل دروغ می‌گوید.** `nameplate.jpg.php` پسوندش `.php` است.
 *     نوع واقعی با `wp_check_filetype_and_ext` بررسی می‌شود که محتوای
 *     فایل را می‌خواند، نه نامش را.
 *   • **`Content-Type` ارسالی مرورگر دروغ می‌گوید.** نادیده گرفته می‌شود.
 *   • **SVG ممنوع است.** SVG می‌تواند `<script>` داشته باشد؛ آپلود آزاد
 *     SVG یعنی XSS ذخیره‌شده روی دامنه‌ی خودمان.
 *   • **سقف تعداد و حجم** — وگرنه یک درخواست می‌تواند دیسک را پر کند.
 *
 * شکست آپلود، **استعلام را از بین نمی‌برد**. لید از عکس مهم‌تر است: اگر
 * فایل رد شود، درخواست ذخیره می‌شود و دلیل رد در همان استعلام ثبت می‌شود
 * تا فروش بداند چرا عکسی نیست.
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const CYH_UPLOAD_MAX_FILES = 3;
const CYH_UPLOAD_MAX_BYTES = 5242880; // ۵ مگابایت

/** فقط قالب‌های عکسِ بی‌خطر. SVG عمداً نیست. */
function cyh_upload_allowed_types() {
	return [
		'jpg|jpeg' => 'image/jpeg',
		'png'      => 'image/png',
		'webp'     => 'image/webp',
	];
}

/**
 * `$_FILES` را به آرایه‌ای از فایل‌های تکی تخت می‌کند.
 *
 * ⚠️ PHP برای `<input name="photos[]" multiple>` ساختار را **وارونه**
 * می‌دهد: `['name' => [f1, f2], 'size' => [s1, s2]]` نه فهرستی از فایل‌ها.
 * نادیده گرفتن این نکته یعنی فقط اولین فایل دیده شود و بقیه بی‌صدا گم شوند.
 */
function cyh_upload_flatten( $entry ) {
	if ( ! is_array( $entry ) || empty( $entry['name'] ) ) {
		return [];
	}

	if ( ! is_array( $entry['name'] ) ) {
		return [ $entry ];
	}

	$out = [];
	foreach ( array_keys( $entry['name'] ) as $i ) {
		if ( '' === (string) $entry['name'][ $i ] ) {
			continue;
		}
		$out[] = [
			'name'     => $entry['name'][ $i ],
			'type'     => $entry['type'][ $i ] ?? '',
			'tmp_name' => $entry['tmp_name'][ $i ] ?? '',
			'error'    => $entry['error'][ $i ] ?? UPLOAD_ERR_NO_FILE,
			'size'     => $entry['size'][ $i ] ?? 0,
		];
	}
	return $out;
}

/**
 * پردازش عکس‌های یک استعلام.
 *
 * @param array $files   خروجی `$request->get_file_params()`.
 * @param int   $post_id شناسه‌ی استعلام ذخیره‌شده.
 * @return array{attached:int,errors:string[]}
 */
function cyh_inquiry_attach_photos( $files, $post_id ) {
	$result = [ 'attached' => 0, 'errors' => [] ];

	$list = cyh_upload_flatten( $files['photos'] ?? null );
	if ( empty( $list ) ) {
		return $result;
	}

	if ( count( $list ) > CYH_UPLOAD_MAX_FILES ) {
		$result['errors'][] = sprintf( 'بیش از %d عکس فرستاده شد؛ فقط %d عکس اول بررسی شد.', CYH_UPLOAD_MAX_FILES, CYH_UPLOAD_MAX_FILES );
		$list               = array_slice( $list, 0, CYH_UPLOAD_MAX_FILES );
	}

	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';

	$allowed = cyh_upload_allowed_types();

	foreach ( $list as $n => $file ) {
		$label = sprintf( 'عکس %d', $n + 1 );

		if ( UPLOAD_ERR_OK !== (int) $file['error'] ) {
			$result['errors'][] = "$label: آپلود ناقص ماند.";
			continue;
		}

		if ( (int) $file['size'] > CYH_UPLOAD_MAX_BYTES ) {
			$result['errors'][] = sprintf( '%s: بزرگ‌تر از ۵ مگابایت بود.', $label );
			continue;
		}

		// ⚠️ نوع *واقعی* — بر اساس محتوای فایل، نه پسوند و نه هدر مرورگر.
		$check = wp_check_filetype_and_ext( $file['tmp_name'], $file['name'], $allowed );
		if ( empty( $check['type'] ) || ! in_array( $check['type'], $allowed, true ) ) {
			$result['errors'][] = sprintf( '%s: فقط JPG، PNG و WebP پذیرفته می‌شود.', $label );
			continue;
		}

		// نام امن و بی‌ربط به نام اصلی — نام فایلِ کاربر خودش یک ورودی است.
		$file['name'] = sprintf( 'inquiry-%d-%d.%s', $post_id, $n + 1, $check['ext'] );

		$moved = wp_handle_upload( $file, [ 'test_form' => false, 'mimes' => $allowed ] );

		if ( ! empty( $moved['error'] ) ) {
			$result['errors'][] = sprintf( '%s: %s', $label, $moved['error'] );
			continue;
		}

		$attachment_id = wp_insert_attachment(
			[
				'post_mime_type' => $moved['type'],
				'post_title'     => sprintf( 'عکس استعلام #%d', $post_id ),
				'post_content'   => '',
				'post_status'    => 'inherit',
			],
			$moved['file'],
			$post_id
		);

		if ( is_wp_error( $attachment_id ) || ! $attachment_id ) {
			$result['errors'][] = "$label: ذخیره در کتابخانه‌ی رسانه انجام نشد.";
			continue;
		}

		wp_update_attachment_metadata( $attachment_id, wp_generate_attachment_metadata( $attachment_id, $moved['file'] ) );
		$result['attached']++;
	}

	return $result;
}

/**
 * نمایش عکس‌ها در صفحه‌ی ویرایش استعلام.
 *
 * بدون این، عکس در کتابخانه‌ی رسانه دفن می‌شود و کسی که استعلام را باز
 * می‌کند نمی‌داند اصلاً عکسی هست — یعنی همان مشکل «ساختم و کسی ندید».
 */
function cyh_inquiry_photos_box() {
	add_meta_box(
		'cyh_inquiry_photos',
		'عکس‌های ارسالی مشتری',
		'cyh_inquiry_photos_render',
		'inquiry',
		'normal',
		'high'
	);
}
add_action( 'add_meta_boxes', 'cyh_inquiry_photos_box' );

function cyh_inquiry_photos_render( $post ) {
	$images = get_attached_media( 'image', $post->ID );

	if ( empty( $images ) ) {
		$why = get_post_meta( $post->ID, 'inquiry_upload_errors', true );
		echo '<p>مشتری عکسی نفرستاده است.</p>';
		if ( $why ) {
			printf( '<p style="color:#b32d2e"><strong>علت رد شدن فایل:</strong> %s</p>', esc_html( $why ) );
		}
		return;
	}

	echo '<div style="display:flex;gap:12px;flex-wrap:wrap">';
	foreach ( $images as $img ) {
		$full  = wp_get_attachment_url( $img->ID );
		$thumb = wp_get_attachment_image( $img->ID, 'medium', false, [ 'style' => 'max-width:260px;height:auto;border-radius:8px;display:block' ] );
		printf( '<a href="%s" target="_blank" rel="noopener">%s</a>', esc_url( $full ), $thumb );
	}
	echo '</div>';
}
