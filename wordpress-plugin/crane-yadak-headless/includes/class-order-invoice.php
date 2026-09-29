<?php
/**
 * فاکتور غیررسمی سفارش + ایمیل تأیید سفارش به مشتری.
 *
 * ⚠️ این «فاکتور رسمی» نیست. فاکتور رسمی (سامانه‌ی مودیان) را شرکت همکار
 * جداگانه صادر می‌کند؛ این سند رسید فروشِ خودِ سایت است و همان را مشتری
 * می‌تواند از سایت دانلود کند و به ایمیلش می‌رسد. متن هشدار پایین سند
 * دقیقاً برای جلوگیری از اشتباه گرفتن این دو است.
 *
 * یک رندر برای هر دو خروجی (صفحه و ایمیل): همه‌چیز استایل درون‌خطی است،
 * چون بسیاری از کلاینت‌های ایمیل <style> را حذف می‌کنند، و یک تابع یعنی
 * عددی که در ایمیل هست با عددی که در صفحه دیده می‌شود هرگز نمی‌تواند فرق کند.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// نام ثابت CYH_QUOTE_CPT هنگام بارگذاری لازم است؛ همان دلیل class-checkout.php.
require_once __DIR__ . '/class-quote-requests.php';

/* ------------------------------ تاریخ و عدد ------------------------------ */

/** میلادی → شمسی (الگوریتم استاندارد jdf). آزمون با نوروز ۱۴۰۴ و ۱۴۰۵ در هارنس. */
function cyh_gregorian_to_jalali( $gy, $gm, $gd ) {
	$offsets = [ 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334 ];
	$gy2     = $gm > 2 ? $gy + 1 : $gy;
	$days    = 355666 + ( 365 * $gy ) + intdiv( $gy2 + 3, 4 ) - intdiv( $gy2 + 99, 100 ) + intdiv( $gy2 + 399, 400 ) + $gd + $offsets[ $gm - 1 ];
	$jy      = -1595 + ( 33 * intdiv( $days, 12053 ) );
	$days   %= 12053;
	$jy     += 4 * intdiv( $days, 1461 );
	$days   %= 1461;
	if ( $days > 365 ) {
		$jy  += intdiv( $days - 1, 365 );
		$days = ( $days - 1 ) % 365;
	}
	if ( $days < 186 ) {
		$jm = 1 + intdiv( $days, 31 );
		$jd = 1 + ( $days % 31 );
	} else {
		$jm = 7 + intdiv( $days - 186, 30 );
		$jd = 1 + ( ( $days - 186 ) % 30 );
	}
	return [ $jy, $jm, $jd ];
}

function cyh_fa_digits( $value ) {
	return strtr( (string) $value, [ '0' => '۰', '1' => '۱', '2' => '۲', '3' => '۳', '4' => '۴', '5' => '۵', '6' => '۶', '7' => '۷', '8' => '۸', '9' => '۹', ',' => '٬' ] );
}

function cyh_fa_number( $n ) {
	return cyh_fa_digits( number_format( (int) $n ) );
}

/** 'YYYY-MM-DD' → '۱۴۰۵/۰۷/۰۷'. ورودی نامعتبر = ''. */
function cyh_jalali_date_string( $ymd ) {
	if ( ! preg_match( '/^(\d{4})-(\d{2})-(\d{2})/', (string) $ymd, $m ) || (int) $m[2] < 1 || (int) $m[2] > 12 ) {
		return '';
	}
	list( $jy, $jm, $jd ) = cyh_gregorian_to_jalali( (int) $m[1], (int) $m[2], (int) $m[3] );
	return cyh_fa_digits( sprintf( '%04d/%02d/%02d', $jy, $jm, $jd ) );
}

/* ------------------------------ فاکتور ------------------------------ */

/** سفارش پرداخت‌شده‌ی این کاربر با این کد، یا null. */
function cyh_find_paid_order( $user_id, $code ) {
	$code = strtoupper( trim( (string) $code ) );
	if ( '' === $code || $user_id <= 0 ) {
		return null;
	}
	$found = get_posts(
		[
			'post_type'      => CYH_QUOTE_CPT,
			'post_status'    => 'publish',
			'author'         => (int) $user_id,
			'posts_per_page' => 1,
			'meta_query'     => [ // phpcs:ignore WordPress.DB.SlowDBQuery
				'relation' => 'AND',
				[ 'key' => 'cyh_code', 'value' => $code ],
				[ 'key' => 'cyh_payment', 'value' => 'paid' ],
			],
		]
	);
	return $found ? $found[0] : null;
}

/**
 * HTML کامل فاکتور غیررسمی. همه‌ی مقادیر متنی esc_html می‌شوند (نام کالا و
 * نشانی را خود مشتری/پنل نوشته است).
 */
function cyh_order_invoice_html( $post_id ) {
	$e         = 'esc_html';
	$code      = (string) get_post_meta( $post_id, 'cyh_code', true );
	$customer  = get_post_meta( $post_id, 'cyh_customer', true );
	$customer  = is_array( $customer ) ? $customer : [];
	$invoice   = get_post_meta( $post_id, 'cyh_invoice', true );
	$official  = is_array( $invoice );
	$sandbox   = (bool) get_post_meta( $post_id, 'cyh_sandbox', true );
	$vat       = (int) get_post_meta( $post_id, 'cyh_vat', true );
	$rate      = (float) get_post_meta( $post_id, 'cyh_vat_rate', true );
	$rate_txt  = cyh_fa_digits( rtrim( rtrim( number_format( $rate, 2, '.', '' ), '0' ), '.' ) );
	$post      = get_post( $post_id );
	$date      = cyh_jalali_date_string( get_the_date( 'Y-m-d', $post ) );
	$site      = (string) ( get_option( 'blogname' ) ?: 'کرین یدک' );
	$address   = implode( '، ', array_filter( [ $customer['province'] ?? '', $customer['city'] ?? '', $customer['address'] ?? '' ] ) );
	$ship      = (string) get_post_meta( $post_id, 'cyh_shipping_label', true );
	$th        = 'style="border:1px solid #d0d5dd;padding:8px;background:#f2f4f7;text-align:right"';
	$td        = 'style="border:1px solid #d0d5dd;padding:8px;text-align:right"';
	$rows      = '';
	$i         = 0;

	foreach ( (array) get_post_meta( $post_id, 'cyh_items', true ) as $item ) {
		++$i;
		$rows .= sprintf(
			'<tr><td %1$s>%2$s</td><td %1$s>%3$s%4$s</td><td %1$s>%5$s</td><td %1$s>%6$s</td><td %1$s>%7$s</td></tr>',
			$td,
			cyh_fa_digits( $i ),
			$e( (string) ( $item['name'] ?? '' ) ),
			! empty( $item['sku'] ) ? '<br><span dir="ltr" style="color:#667085;font-size:12px">' . $e( (string) $item['sku'] ) . '</span>' : '',
			cyh_fa_number( (int) ( $item['qty'] ?? 0 ) ),
			cyh_fa_number( (int) ( $item['unit'] ?? 0 ) ),
			cyh_fa_number( (int) ( $item['total'] ?? 0 ) )
		);
	}

	$total_row = static function ( $label, $value, $bold = false ) use ( $td, $e ) {
		$label = $e( $label );
		$value = $e( $value );
		if ( $bold ) {
			$label = '<strong>' . $label . '</strong>';
			$value = '<strong>' . $value . '</strong>';
		}
		return sprintf( '<tr><td %1$s colspan="4">%2$s</td><td %1$s>%3$s</td></tr>', $td, $label, $value );
	};

	$out  = '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:720px;margin:0 auto;color:#101828;line-height:1.9;font-size:14px">';
	if ( $sandbox ) {
		$out .= '<p style="background:#fffaeb;border:1px solid #f79009;padding:8px 12px;font-weight:bold">حالت آزمایشی — هیچ پول واقعی گرفته نشده و این سند اعتبار ندارد.</p>';
	}
	$out .= '<h1 style="font-size:20px;margin:0 0 4px">فاکتور فروش (غیررسمی)</h1>';
	$out .= '<p style="margin:0 0 12px;color:#475467">' . $e( $site ) . '</p>';
	$out .= '<table style="width:100%;border-collapse:collapse;margin-bottom:12px" cellpadding="0"><tr>';
	$out .= '<td style="padding:2px 0">شماره فاکتور / کد سفارش: <strong dir="ltr" style="white-space:nowrap">' . $e( $code ) . '</strong></td>';
	$out .= '<td style="padding:2px 0">تاریخ: <strong>' . $e( $date ) . '</strong></td>';
	$out .= '</tr><tr>';
	$out .= '<td style="padding:2px 0">شماره پیگیری پرداخت: <strong dir="ltr">' . $e( (string) get_post_meta( $post_id, 'cyh_ref_id', true ) ) . '</strong></td>';
	$out .= '<td style="padding:2px 0">وضعیت: <strong>پرداخت‌شده</strong></td>';
	$out .= '</tr></table>';
	$out .= '<p style="margin:0 0 4px"><strong>خریدار:</strong> ' . $e( (string) ( $customer['name'] ?? get_post_meta( $post_id, 'cyh_name', true ) ) ) . ' — <span dir="ltr">' . $e( (string) ( $customer['phone'] ?? get_post_meta( $post_id, 'cyh_phone', true ) ) ) . '</span></p>';
	if ( '' !== $address ) {
		$out .= '<p style="margin:0 0 12px"><strong>نشانی:</strong> ' . $e( $address ) . ( ! empty( $customer['postal'] ) ? ' — کد پستی ' . $e( cyh_fa_digits( $customer['postal'] ) ) : '' ) . '</p>';
	}
	$out .= '<table style="width:100%;border-collapse:collapse" cellpadding="0"><thead><tr>';
	$out .= '<th ' . $th . '>ردیف</th><th ' . $th . '>شرح کالا</th><th ' . $th . '>تعداد</th><th ' . $th . '>فی (ریال)</th><th ' . $th . '>مبلغ (ریال)</th>';
	$out .= '</tr></thead><tbody>' . $rows;
	$out .= $total_row( 'جمع اقلام', cyh_fa_number( (int) get_post_meta( $post_id, 'cyh_subtotal', true ) ) );
	if ( $official ) {
		$out .= $total_row( 'ارزش افزوده (' . $rate_txt . '٪)', cyh_fa_number( $vat ) );
	}
	$out .= $total_row( 'مبلغ کل پرداخت‌شده (ریال)', cyh_fa_number( (int) get_post_meta( $post_id, 'cyh_total', true ) ), true );
	$out .= '</tbody></table>';
	$out .= '<p style="margin:12px 0 4px"><strong>روش ارسال:</strong> ' . $e( '' === $ship ? 'پس‌کرایه' : $ship ) . '</p>';
	$out .= '<p style="margin:0 0 12px;color:#475467;font-size:13px">هزینه‌ی ارسال پس‌کرایه است و در مبلغ بالا نیامده.</p>';
	$out .= '<p style="border-top:1px solid #d0d5dd;padding-top:8px;margin:0;color:#475467;font-size:12px">';
	$out .= 'این سند رسید فروش سایت است و فاکتور رسمی نیست؛ در سامانه‌ی مودیان ثبت نمی‌شود.';
	if ( $official ) {
		$out .= ' فاکتور رسمی درخواستی شما جداگانه از سوی واحد مالی صادر می‌شود.';
	}
	$out .= '</p></div>';

	return $out;
}

/* ------------------------------ مسیر REST ------------------------------ */

function cyh_register_invoice_route() {
	register_rest_route(
		'crane-yadak/v1',
		'/account/invoice',
		[ 'methods' => 'GET', 'permission_callback' => '__return_true', 'callback' => 'cyh_rest_account_invoice' ]
	);
}
add_action( 'rest_api_init', 'cyh_register_invoice_route' );

function cyh_rest_account_invoice( $request ) {
	$user_id = cyh_customer_authenticate_request( $request );
	if ( is_wp_error( $user_id ) ) {
		return $user_id;
	}
	// ⚠️ سفارش دیگران و سفارش پرداخت‌نشده هر دو «پیدا نشد»؛ پیامِ یکسان تا کسی
	// نتواند کدهای دیگران را وارسی کند.
	$post = cyh_find_paid_order( (int) $user_id, (string) $request->get_param( 'code' ) );
	if ( ! $post ) {
		return new WP_Error( 'cyh_invoice_not_found', 'فاکتوری برای این سفارش پیدا نشد.', [ 'status' => 404 ] );
	}
	return rest_ensure_response(
		[
			'ok'   => true,
			'code' => (string) get_post_meta( $post->ID, 'cyh_code', true ),
			'html' => cyh_order_invoice_html( $post->ID ),
		]
	);
}

/* ------------------------------ ایمیل به مشتری ------------------------------ */

/**
 * ایمیل تأیید سفارش + جزئیات + فاکتور غیررسمی.
 * گیرنده: ایمیل واردشده هنگام پرداخت؛ نبود آن → ایمیل حساب (ثبت‌نام همیشه ایمیل
 * دارد). هیچ‌کدام معتبر نبود → ارسال نمی‌شود، بدون خطا: شکست ایمیل هرگز
 * نباید نتیجه‌ی پرداخت را خراب کند.
 */
/** ایمیل مشتری برای این سفارش: ایمیل فرم پرداخت، وگرنه ایمیل حساب؛ معتبر نبود = ''. */
function cyh_order_recipient( $post_id ) {
	$customer = get_post_meta( $post_id, 'cyh_customer', true );
	$to       = is_array( $customer ) ? sanitize_email( (string) ( $customer['email'] ?? '' ) ) : '';
	if ( ! is_email( $to ) ) {
		$post = get_post( $post_id );
		$user = $post && ! empty( $post->post_author ) ? get_userdata( (int) $post->post_author ) : null;
		$to   = $user ? (string) $user->user_email : '';
	}
	return is_email( $to ) ? $to : '';
}

function cyh_checkout_notify_customer( $post_id ) {
	$customer = get_post_meta( $post_id, 'cyh_customer', true );
	$to       = cyh_order_recipient( $post_id );
	if ( '' === $to ) {
		return false;
	}

	$code   = (string) get_post_meta( $post_id, 'cyh_code', true );
	$origin = rtrim( (string) get_post_meta( $post_id, 'cyh_return_origin', true ), '/' );
	$name   = (string) ( is_array( $customer ) ? ( $customer['name'] ?? '' ) : '' );
	$link   = '' === $origin ? '' : $origin . '/account/orders';

	$body  = '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:720px;margin:0 auto;color:#101828;line-height:1.9;font-size:14px">';
	$body .= '<p>' . esc_html( '' === $name ? 'مشتری گرامی' : $name ) . ' عزیز، پرداخت شما ثبت شد و سفارش <strong dir="ltr">' . esc_html( $code ) . '</strong> برای ارسال آماده می‌شود.</p>';
	$body .= '<p>جزئیات سفارش و فاکتور غیررسمی در ادامه آمده است. می‌توانید آن را هر زمان از بخش «سفارش‌های من» سایت هم دانلود کنید.</p>';
	if ( '' !== $link ) {
		$body .= '<p><a href="' . esc_url( $link ) . '">مشاهده‌ی سفارش‌های من</a></p>';
	}
	$body .= '</div>' . cyh_order_invoice_html( $post_id );

	return wp_mail(
		$to,
		sprintf( '%sتأیید سفارش %s', get_post_meta( $post_id, 'cyh_sandbox', true ) ? '[آزمایشی] ' : '', $code ),
		$body,
		[ 'Content-Type: text/html; charset=UTF-8' ]
	);
}
