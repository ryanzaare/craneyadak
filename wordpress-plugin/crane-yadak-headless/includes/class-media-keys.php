<?php
/**
 * کلید و اثرانگشت رسانه — برای ورود گروهی تصویر.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * دو مسئله‌ای که این فایل حل می‌کند
 * ═══════════════════════════════════════════════════════════════════════════
 * کارفرما هزار تصویر آماده دارد و دو ایراد درست به طرح اولیه گرفت:
 *
 *   ۱) «اسکریپت از کجا بداند این نقشهٔ برش مالِ کدام بلوک است؟»
 *      نمی‌داند و **نباید بداند**. جای این تصمیم، متنِ محتواست.
 *
 *   ۲) «ماه بعد سه تصویر تازه اضافه می‌کنم؛ چطور تکراری آپلود نشود؟»
 *      با نامِ فایل نمی‌شود فهمید. با *محتوای* فایل می‌شود.
 *
 * پاسخ این فایل به هر دو، یک ایده است: **تصویر آدرس‌پذیر شود.**
 *
 * ─── تفکیک مسئولیت ───────────────────────────────────────────────────────
 *   اسکریپت آپلود  → فقط *حمل*: فایل را به کتابخانه‌ی رسانه می‌برد و یک
 *                     «کلید» پایدار رویش می‌گذارد. هیچ تصمیمی درباره‌ی
 *                     جایگاه نمی‌گیرد.
 *   فایل JSON محتوا → *جایگاه*: نویسنده‌ای که متن را می‌نویسد و می‌داند
 *                     نقشهٔ برش وسط بخش «ساختار» می‌نشیند، همان‌جا
 *                     می‌نویسد `"key": "wire-rope-cutaway"`.
 *
 * تصویرِ گالری استثنا نیست، فقط قاعده‌اش ساده‌تر است: نامِ فایل که با
 * الگوی `{کد فنی}-{شماره}` بخواند، خودکار به گالری همان محصول می‌چسبد،
 * چون آنجا جایگاه از خود نام پیداست.
 *
 * ─── چرا هش و نه نام فایل ────────────────────────────────────────────────
 * `_cyh_hash` اثرانگشت SHA-256 خود فایل است. اجرای دوباره‌ی اسکریپت،
 * تغییر نام فایل، یا کپی‌شدن یک تصویر با نام دیگر — هر سه با هش تشخیص
 * داده می‌شوند. نامِ فایل هیچ‌کدام را نمی‌گیرد.
 *
 * @package CraneYadakHeadless
 */

defined( 'ABSPATH' ) || exit;

const CYH_MEDIA_KEY  = '_cyh_key';
const CYH_MEDIA_HASH = '_cyh_hash';

/**
 * پیوست را با کلیدش پیدا کن.
 *
 * @param string $key کلید پایدار (معمولاً ریشه‌ی نام فایل).
 * @return int شناسه‌ی پیوست، یا ۰.
 */
function cyh_media_by_key( $key ) {
	$key = sanitize_title( (string) $key );
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

/**
 * پیوست را با اثرانگشت محتوایش پیدا کن.
 *
 * ⚠️ این تابع قلبِ «همگام‌سازی افزایشی» است. بدون آن، هر بار اجرای
 * اسکریپت یعنی هزار فایل تکراری در کتابخانه‌ی رسانه.
 */
function cyh_media_by_hash( $hash ) {
	$hash = preg_replace( '/[^a-f0-9]/', '', strtolower( (string) $hash ) );
	if ( 64 !== strlen( (string) $hash ) ) {
		return 0;
	}

	$found = get_posts(
		[
			'post_type'        => 'attachment',
			'post_status'      => 'inherit',
			'posts_per_page'   => 1,
			'fields'           => 'ids',
			'meta_key'         => CYH_MEDIA_HASH, // phpcs:ignore WordPress.DB.SlowDBQuery
			'meta_value'       => $hash,          // phpcs:ignore WordPress.DB.SlowDBQuery
			'suppress_filters' => false,
		]
	);

	return $found ? (int) $found[0] : 0;
}

/* =========================================================================
   اندپوینت REST — «این فایل را قبلاً دارید؟»
   =========================================================================
   اسکریپت پیش از هر آپلود این را می‌پرسد. یک درخواست کوچک به‌جای یک
   آپلود چندمگابایتی؛ برای هزار فایل، تفاوتِ چند دقیقه و چند ساعت است.
   ========================================================================= */
function cyh_register_media_routes() {
	register_rest_route(
		'crane-yadak/v1',
		'/media-lookup',
		[
			'methods'             => 'GET',
			// ⚠️ عمومی نیست. این اندپوینت می‌گوید چه چیزی در کتابخانه هست؛
			// برای کسی که حق ویرایش ندارد، هیچ کاری ندارد.
			'permission_callback' => static function () {
				return current_user_can( 'upload_files' );
			},
			'callback'            => 'cyh_rest_media_lookup',
			'args'                => [
				'hash' => [ 'type' => 'string', 'required' => false ],
				'key'  => [ 'type' => 'string', 'required' => false ],
			],
		]
	);
}
add_action( 'rest_api_init', 'cyh_register_media_routes' );

function cyh_rest_media_lookup( $request ) {
	$hash = (string) $request->get_param( 'hash' );
	$key  = (string) $request->get_param( 'key' );

	$id = $hash ? cyh_media_by_hash( $hash ) : 0;
	if ( ! $id && $key ) {
		$id = cyh_media_by_key( $key );
	}

	return rest_ensure_response(
		[
			'found' => $id > 0,
			'id'    => $id,
			'url'   => $id ? wp_get_attachment_url( $id ) : null,
			'key'   => $id ? get_post_meta( $id, CYH_MEDIA_KEY, true ) : null,
		]
	);
}

/* =========================================================================
   ستون «کلید» در کتابخانه‌ی رسانه
   =========================================================================
   بدون این، کلیدها نامرئی‌اند: نویسنده‌ی محتوا باید حدس بزند کلیدِ یک
   تصویر چیست، و حدسِ اشتباه یعنی بلوکی که بی‌صدا خالی می‌ماند.
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
		// قابل انتخاب با دوبار کلیک — برای کپی‌کردن داخل فایل JSON.
		echo '<code style="user-select:all">' . esc_html( $key ) . '</code>';
	} else {
		echo '<span style="color:#787c82">—</span>';
	}
}
add_action( 'manage_media_custom_column', 'cyh_media_key_column_body', 10, 2 );

/**
 * کلید و هش را روی پیوست ثبت کن.
 *
 * از اندپوینت آپلودِ خود وردپرس (`/wp/v2/media`) استفاده می‌شود، پس
 * اسکریپت بعد از آپلود فقط این دو متا را می‌فرستد. ثبت با
 * `register_post_meta` انجام شده تا REST اجازه‌ی نوشتن بدهد.
 */
function cyh_register_media_meta() {
	$auth = static function () {
		return current_user_can( 'upload_files' );
	};

	register_post_meta( 'attachment', CYH_MEDIA_KEY, [
		'type'          => 'string',
		'single'        => true,
		'show_in_rest'  => true,
		'auth_callback' => $auth,
	] );

	register_post_meta( 'attachment', CYH_MEDIA_HASH, [
		'type'          => 'string',
		'single'        => true,
		'show_in_rest'  => true,
		'auth_callback' => $auth,
	] );
}
add_action( 'init', 'cyh_register_media_meta' );
