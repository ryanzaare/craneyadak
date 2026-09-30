<?php
/**
 * قیمت‌گذاری — تنها مرجع سمت سرور برای «این قطعه چند است و آیا آنلاین
 * پرداخت‌پذیر است؟». ایست ۲ در docs/backlog.md.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ چرا این فایل ساخته شد
 *
 * `class-quote-requests.php` قیمت را خودش حساب می‌کرد و **متفاوت** از
 * `computePrice()` در `src/lib/wp.ts`: `sale_price` را هر وقت پر بود
 * برمی‌داشت — بدون بازه‌ی تاریخ تخفیف و بدون شرط «کمتر از قیمت عادی» —
 * و محصول پیش‌نویس را هم می‌پذیرفت. برای برآورد استعلام بی‌خطر بود؛ برای
 * پرداخت یعنی کسر مبلغی متفاوت از آنچه صفحه نشان داده.
 *
 * قانون این فایل: **هم‌رفتار با computePrice**. هر تغییر در یکی، باید در
 * دیگری هم اعمال شود — هارنس (بررسی‌های قیمت) و تست‌های TS هر دو همان
 * موارد مرزی را می‌آزمایند.
 *
 * ---------------------------------------------------------------------------
 * اعتبار قیمت (تصمیم کارفرما، ۷ مهر ۱۴۰۵)
 *
 * بازار قطعات صنعتی نوسان شدید دارد؛ قیمتی که N روز (پیش‌فرض ۱۰، در
 * تنظیمات) تأیید نشده، دیگر آنلاین پرداخت‌پذیر نیست و به استعلام
 * برمی‌گردد. مرجع زمان، **تاریخ تغییر مقدار قیمت** است — نه تاریخ ویرایش
 * نوشته: اصلاح یک غلط تایپی در توضیحات نباید قیمت کهنه را «تازه» کند.
 * ---------------------------------------------------------------------------
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const CYH_PRICE_UPDATED_META   = '_cyh_price_updated_at';
const CYH_PRICE_CONFIRMED_META = '_cyh_price_confirmed_by';
const CYH_PRICE_TTL_OPTION     = 'cyh_price_ttl_days';
const CYH_PRICE_TTL_DEFAULT    = 10;

/**
 * ⚠️ ایران از ۱۴۰۱ ساعت تابستانی ندارد؛ منطقه‌ی زمانی ثابت +03:30.
 * تاریخ‌های تخفیف (Y-m-d) به وقت تهران تفسیر می‌شوند، شروع از ۰۰:۰۰ و
 * پایان تا ۲۳:۵۹:۵۹ همان روز — «تا ۱۰ مهر» یعنی خودِ ۱۰ مهر هم. نسخه‌ی
 * قبلی (فقط در TS) پایان را نیمه‌شب UTC آغاز همان روز حساب می‌کرد و
 * تخفیف در روز آخرش عملاً وجود نداشت.
 */
const CYH_TEHRAN_OFFSET = '+03:30';

function cyh_price_ttl_days() {
	$days = (int) get_option( CYH_PRICE_TTL_OPTION, CYH_PRICE_TTL_DEFAULT );
	return max( 1, min( 90, $days ?: CYH_PRICE_TTL_DEFAULT ) );
}

/** عدد مثبت یا null — ورودی ACF ممکن است رشته، عدد، خالی یا null باشد. */
function cyh_price_number( $raw ) {
	if ( is_string( $raw ) ) {
		$raw = trim( cyh_to_latin_digits( $raw ) );
	}
	if ( '' === $raw || null === $raw || ! is_numeric( $raw ) ) {
		return null;
	}
	$n = (float) $raw;
	return $n > 0 ? $n : null;
}

/**
 * «Y-m-d»، «Ymd» یا ISO → ثانیه‌ی یونیکس به وقت تهران.
 * ⚠️ همان الگوی saleBoundary() در src/lib/pricing.ts — get_field اینجا
 * Y-m-d می‌دهد، ولی WPGraphQL ممکن است قالب دیگری به فرانت‌اند بدهد؛ هر دو
 * طرف باید همه را یکسان بفهمند. نامعتبر → null → «بدون محدودیت».
 */
function cyh_price_date_ts( $raw, $end_of_day ) {
	if ( ! preg_match( '/^(\d{4})-?(\d{2})-?(\d{2})/', trim( (string) $raw ), $m ) ) {
		return null;
	}
	$ts = strtotime( "{$m[1]}-{$m[2]}-{$m[3]}" . ( $end_of_day ? 'T23:59:59' : 'T00:00:00' ) . CYH_TEHRAN_OFFSET );
	return false === $ts ? null : $ts;
}

/**
 * وضعیت کامل قیمت یک محصول.
 *
 * @param int      $post_id
 * @param int|null $now     برای آزمون؛ پیش‌فرض time().
 * @return array{
 *   exists: bool, published: bool, name: string, sku: string, slug: string,
 *   buy_mode: string, stock: string, base: float|null, sale: float|null,
 *   effective: float|null, on_sale: bool, updated_at: int|null,
 *   valid_until: int|null, payable: bool, reason: string|null
 * }
 *
 * `reason` وقتی payable نیست: not_found · not_published · rfq · no_price ·
 * not_in_stock · price_expired. همین کدها به کاربر پیام توضیحی می‌دهند.
 */
function cyh_product_pricing( $post_id, $now = null ) {
	$now  = null === $now ? time() : (int) $now;
	$post = get_post( $post_id );

	$out = [
		'exists'      => false,
		'published'   => false,
		'name'        => '',
		'sku'         => '',
		// 'original' | 'non_original' | '' (ثبت‌نشده). ثبت‌نشده *حدس زده نمی‌شود*.
		'authenticity' => '',
		'slug'        => '',
		'buy_mode'    => 'rfq',
		'stock'       => 'unknown',
		'base'        => null,
		'sale'        => null,
		'effective'   => null,
		'on_sale'     => false,
		'updated_at'  => null,
		'valid_until' => null,
		'payable'     => false,
		'reason'      => 'not_found',
	];

	if ( ! $post || 'product' !== ( $post->post_type ?? '' ) ) {
		return $out;
	}

	$field = static function ( $name ) use ( $post_id ) {
		return cyh_product_field( $post_id, $name );
	};

	$out['exists']    = true;
	$out['published'] = 'publish' === ( $post->post_status ?? '' );
	$out['name']      = (string) ( $post->post_title ?? '' );
	$out['slug']      = (string) ( $post->post_name ?? '' );
	$out['sku']       = trim( (string) $field( 'sku' ) );
	$auth             = (string) $field( 'authenticity' );
	$out['authenticity'] = in_array( $auth, [ 'original', 'non_original' ], true ) ? $auth : '';
	$out['buy_mode']  = 'cart' === $field( 'buy_mode' ) ? 'cart' : 'rfq';
	$stock            = (string) $field( 'stock_status' );
	$out['stock']     = in_array( $stock, [ 'in_stock', 'on_order' ], true ) ? $stock : 'unknown';

	$updated = (int) get_post_meta( $post_id, CYH_PRICE_UPDATED_META, true );
	if ( $updated > 0 ) {
		$out['updated_at']  = $updated;
		$out['valid_until'] = $updated + cyh_price_ttl_days() * DAY_IN_SECONDS;
	}

	if ( ! $out['published'] ) {
		$out['reason'] = 'not_published';
		return $out;
	}

	// حالت استعلام هرگز قیمت ندارد — همان قانون computePrice.
	if ( 'rfq' === $out['buy_mode'] ) {
		$out['reason'] = 'rfq';
		return $out;
	}

	$base = cyh_price_number( $field( 'price' ) );
	$sale = cyh_price_number( $field( 'sale_price' ) );
	$out['base'] = $base;
	$out['sale'] = $sale;

	if ( null === $base && null === $sale ) {
		$out['reason'] = 'no_price';
		return $out;
	}

	if ( null === $base ) {
		// بدون قیمت عادی، «تخفیف» معنا ندارد؛ قیمت تخفیف همان قیمت است.
		$out['effective'] = $sale;
	} else {
		$start      = cyh_price_date_ts( $field( 'sale_start' ), false );
		$end        = cyh_price_date_ts( $field( 'sale_end' ), true );
		$sale_valid = null !== $sale && $sale < $base
			&& ( null === $start || $start <= $now )
			&& ( null === $end || $end >= $now );
		$out['effective'] = $sale_valid ? $sale : $base;
		$out['on_sale']   = $sale_valid;
	}

	if ( 'in_stock' !== $out['stock'] ) {
		$out['reason'] = 'not_in_stock';
		return $out;
	}
	// بدون تاریخ = منقضی (پیش‌فرض امن): محصولی که پیش از این قاعده قیمت
	// گرفته، تا اولین تأیید در پنل پرداخت‌پذیر نیست.
	if ( null === $out['valid_until'] || $out['valid_until'] <= $now ) {
		$out['reason'] = 'price_expired';
		return $out;
	}

	$out['payable'] = true;
	$out['reason']  = null;
	return $out;
}

/**
 * خواندن یک فیلد محصول — یک راه برای همه‌ی فایل‌ها.
 * ⚠️ گارد ACF — همان دلیل class-quote-requests.php: بدون ACF، get_field
 * وجود ندارد و خطای مرگبار یعنی شکست ثبت سفارش. ACF همان متای نوشته را
 * می‌نویسد، پس جایگزین get_post_meta همان مقدار خام را می‌دهد.
 */
function cyh_product_field( $post_id, $name ) {
	return function_exists( 'get_field' ) ? get_field( $name, $post_id ) : get_post_meta( $post_id, $name, true );
}

/** پیام کاربرپسند برای هر reason — همان متنی که هنگام جابه‌جایی به سبد استعلام دیده می‌شود. */
function cyh_pricing_reason_label( $reason ) {
	$labels = [
		'not_found'     => 'این محصول دیگر در سایت نیست.',
		'not_published' => 'این محصول دیگر در سایت نیست.',
		'rfq'           => 'قیمت این قطعه با استعلام اعلام می‌شود.',
		'no_price'      => 'قیمت این قطعه ثبت نشده است.',
		'not_in_stock'  => 'این قطعه در حال حاضر موجود نیست؛ برای زمان تأمین استعلام بگیرید.',
		'price_expired' => 'قیمت این قطعه به‌روز نیست؛ برای قیمت روز استعلام بگیرید.',
	];
	return $labels[ $reason ] ?? 'این قطعه آنلاین قابل خرید نیست.';
}

/** تاریخ تغییر قیمت را امروز ثبت می‌کند (+ چه کسی). */
function cyh_price_mark_updated( $post_id, $user_id = null ) {
	update_post_meta( $post_id, CYH_PRICE_UPDATED_META, time() );
	update_post_meta( $post_id, CYH_PRICE_CONFIRMED_META, (int) ( null === $user_id ? get_current_user_id() : $user_id ) );
}

/**
 * ACF: وقتی *مقدار* قیمت یا قیمت تخفیف واقعاً عوض می‌شود، تاریخ ثبت شود.
 *
 * ⚠️ مقایسه با مقدار فعلی پایگاه داده (پیش از ذخیره) — نه «هر ذخیره».
 * ذخیره‌ی نوشته با همان قیمت، تاریخ را جلو نمی‌برد.
 * ⚠️ پارامترها پیش‌فرض دارند — دام CLAUDE.md: PHP 8 وگرنه fatal.
 */
function cyh_price_track_change( $value = null, $post_id = 0, $field = [], $original = null ) {
	if ( ! is_numeric( $post_id ) || 'product' !== get_post_type( (int) $post_id ) ) {
		return $value;
	}
	$name = is_array( $field ) ? ( $field['name'] ?? '' ) : '';
	if ( '' === $name ) {
		return $value;
	}
	$old = cyh_price_number( get_post_meta( (int) $post_id, $name, true ) );
	$new = cyh_price_number( $value );
	if ( $old !== $new && null !== $new ) {
		cyh_price_mark_updated( (int) $post_id );
	}
	return $value;
}
add_filter( 'acf/update_value/key=field_cyh_product_price', 'cyh_price_track_change', 10, 4 );
add_filter( 'acf/update_value/key=field_cyh_product_sale_price', 'cyh_price_track_change', 10, 4 );

/* =========================================================================
   گراف‌کیوال — دو فیلد روی CraneProduct
   =========================================================================
   ⚠️ فرانت‌اند این‌ها را در کوئری *اختیاری جدا* می‌خواند، نه در کوئری
   پایه‌ی محصولات (src/lib/wp.ts). دام «isDemo»: فیلد تازه در کوئری پایه
   یعنی تا نصب همین نسخه‌ی افزونه، کل کاتالوگ خالی می‌شود. */
function cyh_register_pricing_graphql() {
	if ( ! function_exists( 'register_graphql_field' ) ) {
		return;
	}
	$iso = static function ( $ts ) {
		return $ts ? gmdate( 'c', (int) $ts ) : null;
	};
	register_graphql_field(
		'CraneProduct',
		'priceUpdatedAt',
		[
			'type'        => 'String',
			'description' => 'آخرین تغییر یا تأیید مقدار قیمت (ISO 8601) — نه تاریخ ویرایش نوشته.',
			'resolve'     => static function ( $post ) use ( $iso ) {
				return $iso( get_post_meta( $post->ID, CYH_PRICE_UPDATED_META, true ) );
			},
		]
	);
	register_graphql_field(
		'CraneProduct',
		'priceValidUntil',
		[
			'type'        => 'String',
			'description' => 'پایان اعتبار قیمت (ISO 8601). null = بدون تاریخ = منقضی.',
			'resolve'     => static function ( $post ) use ( $iso ) {
				$updated = (int) get_post_meta( $post->ID, CYH_PRICE_UPDATED_META, true );
				return $updated > 0 ? $iso( $updated + cyh_price_ttl_days() * DAY_IN_SECONDS ) : null;
			},
		]
	);
}
add_action( 'graphql_register_types', 'cyh_register_pricing_graphql' );
