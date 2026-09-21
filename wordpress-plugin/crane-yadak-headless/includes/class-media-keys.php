<?php
/**
 * کلید رسانه — آدرس پایدار برای ارجاع به تصویر از داخل محتوا.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * مسئله
 * ═══════════════════════════════════════════════════════════════════════════
 * بلوک «رسانه» باید بتواند از داخل یک فایل JSON محتوا به یک تصویر مشخص
 * اشاره کند. با شناسه‌ی عددیِ پیوست نمی‌شود: آن عدد در هر نصب وردپرس
 * فرق می‌کند، و یک فایل محتوا باید روی استیجینگ و پروداکشن یکسان کار کند.
 *
 * پس هر پیوست یک **کلید** می‌گیرد — رشته‌ای پایدار و خوانا که از نام
 * فایل ساخته می‌شود و در هر نصبی یکی است:
 *
 *     { "type": "media",
 *       "media": [ { "key": "wire-rope-cutaway", "alt": "برش عرضی" } ] }
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ این فایل یک بار بزرگ‌تر بود و کوچک شد
 * ═══════════════════════════════════════════════════════════════════════════
 * نسخه‌ی اول، هشِ SHA-256 و اندپوینت `/media-lookup` را هم داشت. هر دو
 * فقط یک مصرف‌کننده داشتند: اسکریپت آپلود گروهیِ عکس‌های تامین‌کننده.
 * کارفرما آن مسیر را کنار گذاشت (تصاویر از این پس سفارشی و با هویت
 * بصری خودِ برند ساخته می‌شوند، نه از پوشه‌ی عکس تامین‌کننده) و اسکریپت
 * حذف شد.
 *
 * طبق قاعده‌ی ۲ («هر افزوده، حذفش را با خودش می‌آورد») هش و اندپوینت هم
 * با همان کامیت رفتند. چیزی که ماند، تنها بخشی است که هنوز مصرف‌کننده
 * دارد: تبدیل کلید به شناسه، که `class-content-import-hub.php` صدایش
 * می‌زند.
 *
 * ⚠️ و یک شکافِ تازه بسته شد: تا وقتی اسکریپت وجود داشت، *او* کلید را
 * روی پیوست می‌نوشت. بدون او هیچ‌چیز نمی‌نوشت — یعنی ابزار ورود با کلید
 * جستجو می‌کرد، ستون پنل کلید نشان می‌داد، و هیچ کلیدی هرگز ساخته
 * نمی‌شد. نیمه‌فیچرِ بی‌صدا. حالا `add_attachment` خودش کلید را از نام
 * فایل می‌سازد و در صفحه‌ی ویرایش پیوست قابل تغییر است.
 *
 * @package CraneYadakHeadless
 */

defined( 'ABSPATH' ) || exit;

const CYH_MEDIA_KEY = '_cyh_key';

/**
 * نام فایل → کلید.
 *
 * ⚠️ نیم‌فاصله به خط تیره تبدیل می‌شود و حذف نمی‌شود. حذفش «سیم‌بکسل» را
 * به «سیمبکسل» می‌چسباند — همان باگی که یک بار در لنگرهای صفحه و یک بار
 * در اسکریپت آپلود تکرار شد. نشانه‌گذاری و اعراب فارسی هم داخل بازه‌ی
 * U+0600–U+06FF‌اند و باید جداگانه حذف شوند.
 */
function cyh_media_make_key( $filename ) {
	$name = pathinfo( (string) $filename, PATHINFO_FILENAME );
	$name = mb_strtolower( $name, 'UTF-8' );

	// نشانه‌گذاری و اعراب فارسی/عربی
	$name = preg_replace(
		'/[\x{0600}-\x{0605}\x{060C}\x{060D}\x{061B}\x{061E}\x{061F}'
		. '\x{066A}-\x{066D}\x{06D4}\x{06DD}\x{0610}-\x{061A}'
		. '\x{064B}-\x{065F}\x{0670}\x{06D6}-\x{06ED}]/u',
		'',
		$name
	);

	$name = preg_replace( '/[\x{200C}\s_\/]+/u', '-', $name );
	$name = preg_replace( '/[^\x{0600}-\x{06FF}0-9a-z-]/u', '', $name );
	$name = preg_replace( '/-{2,}/', '-', $name );
	$name = trim( (string) $name, '-' );

	return mb_substr( $name, 0, 50, 'UTF-8' );
}

/**
 * پیوست را با کلیدش پیدا کن.
 *
 * @return int شناسه‌ی پیوست، یا ۰ اگر نبود.
 */
function cyh_media_by_key( $key ) {
	$key = cyh_media_make_key( $key );
	if ( '' === $key ) {
		return 0;
	}

	$found = get_posts(
		[
			'post_type'        => 'attachment',
			'post_status'      => 'inherit',
			'posts_per_page'   => 1,
			'fields'           => 'ids',
			'meta_key'         => CYH_MEDIA_KEY, // phpcs:ignore WordPress.DB.SlowDBQuery
			'meta_value'       => $key,          // phpcs:ignore WordPress.DB.SlowDBQuery
			'suppress_filters' => false,
		]
	);

	return $found ? (int) $found[0] : 0;
}

/* =========================================================================
   کلید خودکار هنگام آپلود
   ========================================================================= */
/**
 * ⚠️ فقط وقتی کلید خالی است نوشته می‌شود. اگر مدیر محتوا کلید را دستی
 * عوض کرده باشد و بعد تصویر را جایگزین کند، بازنویسیِ خودکار همه‌ی
 * ارجاع‌های JSON به آن کلید را بی‌صدا می‌شکست.
 */
function cyh_media_autokey( $attachment_id ) {
	if ( get_post_meta( $attachment_id, CYH_MEDIA_KEY, true ) ) {
		return;
	}

	$file = get_post_meta( $attachment_id, '_wp_attached_file', true );
	$key  = cyh_media_make_key( $file ? basename( $file ) : get_the_title( $attachment_id ) );
	if ( '' === $key ) {
		return;
	}

	/* کلید تکراری یعنی دو تصویر با یک آدرس — ارجاعِ JSON همیشه به اولی
	   می‌رسد و دومی نامرئی می‌ماند. پس شماره می‌گیرد. */
	$base = $key;
	$n    = 2;
	while ( cyh_media_by_key( $key ) ) {
		$key = $base . '-' . $n;
		$n++;
		if ( $n > 99 ) {
			return; // چیزی عجیب است؛ بی‌کلید بهتر از حلقه‌ی بی‌پایان است.
		}
	}

	update_post_meta( $attachment_id, CYH_MEDIA_KEY, $key );
}
add_action( 'add_attachment', 'cyh_media_autokey' );

/* =========================================================================
   ویرایش کلید در صفحه‌ی پیوست
   ========================================================================= */
function cyh_media_key_field( $fields, $post ) {
	$fields['cyh_key'] = [
		'label' => 'کلید محتوا',
		'input' => 'text',
		'value' => get_post_meta( $post->ID, CYH_MEDIA_KEY, true ),
		'helps' => 'برای ارجاع از داخل فایل JSON محتوا: <code>"key": "…"</code>. '
			. 'از نام فایل ساخته می‌شود؛ تغییرش ارجاع‌های موجود را می‌شکند.',
	];
	return $fields;
}
add_filter( 'attachment_fields_to_edit', 'cyh_media_key_field', 10, 2 );

function cyh_media_key_save( $post, $attachment ) {
	if ( ! isset( $attachment['cyh_key'] ) ) {
		return $post;
	}

	$key = cyh_media_make_key( $attachment['cyh_key'] );
	if ( '' === $key ) {
		delete_post_meta( $post['ID'], CYH_MEDIA_KEY );
		return $post;
	}

	// کلیدِ گرفته‌شده توسط پیوست دیگر پذیرفته نمی‌شود.
	$owner = cyh_media_by_key( $key );
	if ( $owner && (int) $owner !== (int) $post['ID'] ) {
		$post['errors']['cyh_key']['errors'][] =
			'این کلید قبلاً برای پیوست #' . (int) $owner . ' ثبت شده است.';
		return $post;
	}

	update_post_meta( $post['ID'], CYH_MEDIA_KEY, $key );
	return $post;
}
add_filter( 'attachment_fields_to_save', 'cyh_media_key_save', 10, 2 );

/* =========================================================================
   ستون «کلید محتوا» در کتابخانه‌ی رسانه
   =========================================================================
   بدون این، کلیدها نامرئی‌اند: نویسنده‌ی محتوا باید حدس بزند کلیدِ یک
   تصویر چیست، و حدسِ اشتباه یعنی بلوکی که روی سایت خالی می‌ماند.
   ========================================================================= */
function cyh_media_key_column( $cols ) {
	$cols['cyh_key'] = 'کلید محتوا';
	return $cols;
}
add_filter( 'manage_media_columns', 'cyh_media_key_column' );

function cyh_media_key_column_body( $col, $id ) {
	if ( 'cyh_key' !== $col ) {
		return;
	}
	$key = get_post_meta( $id, CYH_MEDIA_KEY, true );
	if ( $key ) {
		// با یک کلیک کامل انتخاب می‌شود — برای کپی داخل فایل JSON.
		echo '<code style="user-select:all">' . esc_html( $key ) . '</code>';
	} else {
		echo '<span style="color:#787c82">—</span>';
	}
}
add_action( 'manage_media_custom_column', 'cyh_media_key_column_body', 10, 2 );
