<?php
/**
 * پرداخت آنلاین با زرین‌پال — ایست ۲، فاز ۴.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * مسیر، در سه گام
 * ═══════════════════════════════════════════════════════════════════════════
 *   ۱) POST /checkout/session — مرورگر فقط اسلاگ و تعداد می‌فرستد. سرور
 *      قیمت هر قلم را از cyh_product_pricing() می‌خواند، اقلام
 *      پرداخت‌ناپذیر را جدا برمی‌گرداند (مرورگر آن‌ها را با پیام به سبد
 *      استعلام می‌برد)، و از بقیه یک «عکس» قیمت با انقضای ۳۰ دقیقه
 *      می‌سازد.
 *   ۲) POST /checkout/pay — نشانی، فاکتور رسمی (اختیاری) و همان نشست.
 *      سفارش با وضعیت پرداخت «در انتظار» ساخته و از زرین‌پال authority
 *      گرفته می‌شود.
 *   ۳) GET /checkout/callback — زرین‌پال مرورگر را به این‌جا برمی‌گرداند.
 *      سرور verify می‌کند و به صفحه‌ی نتیجه‌ی سایت استاتیک ریدایرکت
 *      می‌کند.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * قاعده‌هایی که هرکدام یک شکست را می‌بندند
 * ═══════════════════════════════════════════════════════════════════════════
 *   • قیمت هرگز از مرورگر پذیرفته نمی‌شود — سبد در localStorage است.
 *   • «قیمتِ نشان‌داده‌شده محترم است» (تصمیم کارفرما): مبلغ از عکس نشست
 *     کسر می‌شود، حتی اگر وسط کار قیمت در پنل عوض یا منقضی شود. خطای
 *     «قیمت تغییر کرد» وجود ندارد. «نشان‌داده‌شده» یعنی عددی که *سرور* در
 *     گام ۱ داده، نه عدد صفحه‌ی استاتیک که ممکن است از build چند روز پیش
 *     باشد.
 *   • پارامتر Status زرین‌پال (OK/NOK) هرگز مبنای «پرداخت شد» نیست. هر
 *     کسی می‌تواند آدرس بازگشت را با Status=OK باز کند. فقط پاسخ verify
 *     (کد ۱۰۰ یا ۱۰۱) سفارش را پرداخت‌شده می‌کند.
 *   • Authority بازگشتی باید همانی باشد که برای همین سفارش گرفته شده —
 *     وگرنه authority پرداختِ ارزان‌تری می‌توانست سفارش گران‌تر را ببندد.
 *   • callback تکرارپذیر است: رفرش صفحه، دکمه‌ی back یا دو درخواست
 *     هم‌زمان، سفارش را دوباره پردازش نمی‌کند (قفل add_option).
 *   • مالیات ارزش افزوده فقط با تیک «درخواست فاکتور رسمی» و فقط سمت سرور
 *     (تصمیم کارفرما، ۳ مهر ۱۴۰۵). نرخ تنظیم پنل است، نه هاردکد.
 *
 * API زرین‌پال v4 از مستندات رسمی (zarinpal.com/docs، ۷ مهر ۱۴۰۵):
 * request.json / verify.json / StartPay؛ sandbox همان مسیرها روی
 * sandbox.zarinpal.com با هر UUID دلخواه به‌جای merchant_id.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const CYH_ZP_MERCHANT_OPTION = 'cyh_zarinpal_merchant';
const CYH_ZP_SANDBOX_OPTION  = 'cyh_zarinpal_sandbox';
const CYH_VAT_RATE_OPTION    = 'cyh_vat_rate';
const CYH_CHECKOUT_TTL       = 1800; // ۳۰ دقیقه — عکس قیمت بیش از این محترم نیست
const CYH_PAYMENT_PAGE       = 'cyh-payment';

/* =========================================================================
   ۱) تنظیمات
   ========================================================================= */

/** نرخ مالیات ارزش افزوده (درصد). پیش‌فرض ۱۰؛ ۰ تا ۳۰. */
function cyh_checkout_vat_rate() {
	$raw = get_option( CYH_VAT_RATE_OPTION, 10 );
	return is_numeric( $raw ) ? max( 0.0, min( 30.0, (float) $raw ) ) : 10.0;
}

/** ⚠️ پیش‌فرض sandbox است: نصب تازه‌ی افزونه هرگز پول واقعی نمی‌گیرد. */
function cyh_zp_sandbox() {
	return (bool) get_option( CYH_ZP_SANDBOX_OPTION, true );
}

function cyh_zp_merchant() {
	return trim( (string) get_option( CYH_ZP_MERCHANT_OPTION, '' ) );
}

function cyh_zp_base() {
	return cyh_zp_sandbox() ? 'https://sandbox.zarinpal.com' : 'https://payment.zarinpal.com';
}

function cyh_sanitize_vat_rate( $value = null ) {
	$value = cyh_to_latin_digits( (string) $value );
	return is_numeric( $value ) ? max( 0, min( 30, (float) $value ) ) : 10;
}

function cyh_sanitize_zp_merchant( $value = null ) {
	return sanitize_text_field( trim( (string) $value ) );
}

function cyh_register_payment_settings() {
	register_setting( 'cyh_payment_group', CYH_ZP_MERCHANT_OPTION, [ 'sanitize_callback' => 'cyh_sanitize_zp_merchant' ] );
	register_setting( 'cyh_payment_group', CYH_ZP_SANDBOX_OPTION, [ 'sanitize_callback' => 'rest_sanitize_boolean', 'default' => true ] );
	register_setting( 'cyh_payment_group', CYH_VAT_RATE_OPTION, [ 'sanitize_callback' => 'cyh_sanitize_vat_rate', 'default' => 10 ] );
}
add_action( 'admin_init', 'cyh_register_payment_settings' );

function cyh_register_payment_page() {
	add_options_page( 'پرداخت آنلاین', 'پرداخت آنلاین', 'manage_options', CYH_PAYMENT_PAGE, 'cyh_render_payment_page' );
}
add_action( 'admin_menu', 'cyh_register_payment_page' );

function cyh_render_payment_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
	<div class="wrap">
		<h1>پرداخت آنلاین (زرین‌پال)</h1>
		<?php if ( cyh_zp_sandbox() ) : ?>
			<div class="notice notice-warning inline"><p>
				<strong>حالت آزمایشی (sandbox) روشن است.</strong> هیچ پول واقعی گرفته نمی‌شود و
				سفارش‌ها با برچسب «[آزمایشی]» ثبت می‌شوند. پیش از راه‌اندازی، merchant ID واقعی را وارد و
				این گزینه را خاموش کنید.
			</p></div>
		<?php endif; ?>
		<form method="post" action="options.php">
			<?php settings_fields( 'cyh_payment_group' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="<?php echo esc_attr( CYH_ZP_MERCHANT_OPTION ); ?>">مرچنت کد (merchant ID)</label></th>
					<td>
						<input type="text" dir="ltr" class="regular-text code" id="<?php echo esc_attr( CYH_ZP_MERCHANT_OPTION ); ?>"
							name="<?php echo esc_attr( CYH_ZP_MERCHANT_OPTION ); ?>" value="<?php echo esc_attr( cyh_zp_merchant() ); ?>"
							placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
						<p class="description">کد ۳۶ کاراکتری از پنل زرین‌پال. در حالت آزمایشی هر UUID دلخواه کار می‌کند. تا خالی است، دکمه‌ی پرداخت پیام «درگاه هنوز پیکربندی نشده» می‌دهد.</p>
					</td>
				</tr>
				<tr>
					<th scope="row">حالت آزمایشی</th>
					<td>
						<label>
							<input type="checkbox" name="<?php echo esc_attr( CYH_ZP_SANDBOX_OPTION ); ?>" value="1" <?php checked( cyh_zp_sandbox() ); ?> />
							sandbox.zarinpal.com — بدون پول واقعی
						</label>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="<?php echo esc_attr( CYH_VAT_RATE_OPTION ); ?>">نرخ ارزش افزوده (درصد)</label></th>
					<td>
						<input type="number" min="0" max="30" step="0.5" class="small-text" id="<?php echo esc_attr( CYH_VAT_RATE_OPTION ); ?>"
							name="<?php echo esc_attr( CYH_VAT_RATE_OPTION ); ?>" value="<?php echo esc_attr( (string) cyh_checkout_vat_rate() ); ?>" />
						<p class="description">فقط وقتی خریدار «درخواست فاکتور رسمی» را تیک بزند اضافه می‌شود. نرخ با قانون بودجه‌ی هر سال عوض می‌شود.</p>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
	</div>
	<?php
}

/* =========================================================================
   ۲) اعتبارسنجی
   ========================================================================= */

function cyh_digits_only( $value ) {
	return preg_replace( '/\D/', '', cyh_to_latin_digits( (string) $value ) );
}

/**
 * کد ملی ۱۰ رقمی با رقم کنترل.
 * مجموع رقم i (از چپ، ۰ تا ۸) × (۱۰ − i)، باقی‌مانده بر ۱۱ = r؛
 * رقم کنترل = r اگر r < ۲، وگرنه ۱۱ − r. ده رقم یکسان رد می‌شود (از
 * فرمول رد می‌شوند ولی کد واقعی نیستند).
 */
function cyh_valid_national_code( $code ) {
	$c = cyh_digits_only( $code );
	if ( ! preg_match( '/^\d{10}$/', $c ) || preg_match( '/^(\d)\1{9}$/', $c ) ) {
		return false;
	}
	$sum = 0;
	for ( $i = 0; $i < 9; $i++ ) {
		$sum += (int) $c[ $i ] * ( 10 - $i );
	}
	$r     = $sum % 11;
	$check = (int) $c[9];
	return $r < 2 ? $check === $r : $check === 11 - $r;
}

/**
 * شناسه ملی اشخاص حقوقی، ۱۱ رقمی با رقم کنترل.
 * d = رقم دهم + ۲؛ مجموع (رقم i + d) × ضریب i با ضرایب
 * [29,27,23,19,17,29,27,23,19,17]؛ باقی‌مانده بر ۱۱ (۱۰ → ۰) = رقم یازدهم.
 * 🔶 با شناسه‌ی واقعی شرکت همکار آزموده شود (docs/backlog.md).
 */
function cyh_valid_legal_id( $id ) {
	$c = cyh_digits_only( $id );
	if ( ! preg_match( '/^\d{11}$/', $c ) || preg_match( '/^(\d)\1{10}$/', $c ) ) {
		return false;
	}
	$d       = (int) $c[9] + 2;
	$weights = [ 29, 27, 23, 19, 17, 29, 27, 23, 19, 17 ];
	$sum     = 0;
	for ( $i = 0; $i < 10; $i++ ) {
		$sum += ( (int) $c[ $i ] + $d ) * $weights[ $i ];
	}
	$r = $sum % 11;
	if ( 10 === $r ) {
		$r = 0;
	}
	return (int) $c[10] === $r;
}

function cyh_valid_postal_code( $code ) {
	$c = cyh_digits_only( $code );
	return (bool) preg_match( '/^\d{10}$/', $c ) && ! preg_match( '/^(\d)\1{9}$/', $c );
}

/** تلفن ثابت یا فکس با پیش‌شماره: ۱۱ رقم، با ۰ شروع، و موبایل (۰۹) نیست. */
function cyh_valid_landline( $phone ) {
	$c = cyh_digits_only( $phone );
	return (bool) preg_match( '/^0[1-8]\d{9}$/', $c );
}

/**
 * مشخصات گیرنده و ارسال. خروجی: [داده‌ی پاک، خطاها به تفکیک فیلد].
 * ⚠️ ارسال پس‌کرایه است (تصمیم کارفرما) — نشانی برای بسته است، نه
 * محاسبه‌ی هزینه.
 */
function cyh_checkout_validate_customer( $raw ) {
	$raw    = is_array( $raw ) ? $raw : [];
	$get    = static function ( $k ) use ( $raw ) { return sanitize_text_field( (string) ( $raw[ $k ] ?? '' ) ); };
	$errors = [];

	$clean = [
		'name'     => $get( 'name' ),
		'phone'    => cyh_digits_only( $raw['phone'] ?? '' ),
		'email'    => sanitize_email( (string) ( $raw['email'] ?? '' ) ),
		'province' => $get( 'province' ),
		'city'     => $get( 'city' ),
		'address'  => sanitize_textarea_field( (string) ( $raw['address'] ?? '' ) ),
		'postal'   => cyh_digits_only( $raw['postal'] ?? '' ),
	];

	if ( mb_strlen( $clean['name'] ) < 3 ) {
		$errors['name'] = 'نام و نام خانوادگی گیرنده را کامل بنویسید.';
	}
	if ( ! preg_match( '/^(0)?9\d{9}$/', $clean['phone'] ) ) {
		$errors['phone'] = 'شماره موبایل معتبر نیست (مثل ۰۹۱۲۱۲۳۴۵۶۷).';
	}
	if ( '' !== $clean['email'] && ! is_email( $clean['email'] ) ) {
		$errors['email'] = 'ایمیل معتبر نیست.';
	}
	if ( '' === $clean['province'] ) {
		$errors['province'] = 'استان را بنویسید.';
	}
	if ( '' === $clean['city'] ) {
		$errors['city'] = 'شهر را بنویسید.';
	}
	if ( mb_strlen( trim( $clean['address'] ) ) < 10 ) {
		$errors['address'] = 'نشانی را کامل بنویسید (خیابان، کوچه، پلاک).';
	}
	if ( ! cyh_valid_postal_code( $clean['postal'] ) ) {
		$errors['postal'] = 'کد پستی باید ۱۰ رقم باشد.';
	}
	return [ $clean, $errors ];
}

/**
 * فاکتور رسمی — فقط وقتی wanted روشن است، و آن‌وقت همه‌ی فیلدها اجباری.
 * خاموش: null (فیلدها نادیده، مالیات ۰).
 */
function cyh_checkout_validate_invoice( $raw ) {
	$raw = is_array( $raw ) ? $raw : [];
	if ( empty( $raw['wanted'] ) ) {
		return [ null, [] ];
	}
	$type   = 'legal' === ( $raw['type'] ?? '' ) ? 'legal' : 'real';
	$errors = [];
	$clean  = [
		'type'          => $type,
		'name'          => sanitize_text_field( (string) ( $raw['name'] ?? '' ) ),
		'national_id'   => cyh_digits_only( $raw['national_id'] ?? '' ),
		'economic_code' => cyh_digits_only( $raw['economic_code'] ?? '' ),
		'reg_no'        => 'legal' === $type ? cyh_digits_only( $raw['reg_no'] ?? '' ) : '',
		'postal'        => cyh_digits_only( $raw['postal'] ?? '' ),
		'address'       => sanitize_textarea_field( (string) ( $raw['address'] ?? '' ) ),
		'landline'      => cyh_digits_only( $raw['landline'] ?? '' ),
	];

	if ( mb_strlen( $clean['name'] ) < 3 ) {
		$errors['invoice.name'] = 'legal' === $type ? 'نام کامل شرکت را بنویسید.' : 'نام و نام خانوادگی را کامل بنویسید.';
	}
	if ( 'legal' === $type ? ! cyh_valid_legal_id( $clean['national_id'] ) : ! cyh_valid_national_code( $clean['national_id'] ) ) {
		$errors['invoice.national_id'] = 'legal' === $type ? 'شناسه ملی ۱۱ رقمی معتبر نیست.' : 'کد ملی ۱۰ رقمی معتبر نیست.';
	}
	// 🔶 طول کد اقتصادی: قدیمی ۱۲ رقم؛ در سامانه‌ی مودیان همان کد/شناسه ملی.
	if ( ! preg_match( '/^\d{10,14}$/', $clean['economic_code'] ) ) {
		$errors['invoice.economic_code'] = 'کد اقتصادی باید ۱۰ تا ۱۴ رقم باشد.';
	}
	if ( 'legal' === $type && ! preg_match( '/^\d{1,10}$/', $clean['reg_no'] ) ) {
		$errors['invoice.reg_no'] = 'شماره ثبت شرکت را بنویسید.';
	}
	if ( ! cyh_valid_postal_code( $clean['postal'] ) ) {
		$errors['invoice.postal'] = 'کد پستی فاکتور باید ۱۰ رقم باشد.';
	}
	if ( mb_strlen( trim( $clean['address'] ) ) < 10 ) {
		$errors['invoice.address'] = 'نشانی کامل فاکتور را بنویسید.';
	}
	if ( ! cyh_valid_landline( $clean['landline'] ) ) {
		$errors['invoice.landline'] = 'تلفن ثابت یا فکس با پیش‌شماره (۱۱ رقم، مثل ۰۲۱۱۲۳۴۵۶۷۸).';
	}
	return [ $clean, $errors ];
}

/** مبالغ به ریال، عدد صحیح. مالیات فقط با فاکتور رسمی. */
function cyh_checkout_totals( $subtotal, $invoice_wanted, $rate ) {
	$subtotal = (int) round( $subtotal );
	$vat      = $invoice_wanted ? (int) round( $subtotal * $rate / 100 ) : 0;
	return [
		'subtotal' => $subtotal,
		'vat_rate' => $invoice_wanted ? (float) $rate : 0.0,
		'vat'      => $vat,
		'total'    => $subtotal + $vat,
	];
}

/* =========================================================================
   ۳) نشست پرداخت (عکس قیمت)
   ========================================================================= */

/**
 * اقلام مرورگر → [lines پرداخت‌پذیر، moved پرداخت‌ناپذیر، subtotal].
 * تکراری‌ها ادغام، تعداد ۱..۹۹۹۹، حداکثر ۵۰ قلم (همان سقف استعلام).
 */
function cyh_checkout_build( $items, $now = null ) {
	$qty = [];
	foreach ( array_slice( is_array( $items ) ? $items : [], 0, 50 ) as $item ) {
		if ( ! is_array( $item ) ) {
			continue;
		}
		$slug = sanitize_title( (string) ( $item['slug'] ?? '' ) );
		if ( '' === $slug ) {
			continue;
		}
		$qty[ $slug ] = min( 9999, ( $qty[ $slug ] ?? 0 ) + max( 1, min( 9999, (int) ( $item['qty'] ?? 1 ) ) ) );
	}

	$lines    = [];
	$moved    = [];
	$subtotal = 0;
	foreach ( $qty as $slug => $n ) {
		$found   = get_posts(
			[
				'post_type'      => 'product',
				'name'           => $slug,
				'post_status'    => 'publish',
				'posts_per_page' => 1,
			]
		);
		$pricing = $found ? cyh_product_pricing( $found[0]->ID, $now ) : null;
		if ( ! $pricing || ! $pricing['payable'] ) {
			$moved[] = [
				'slug'   => $slug,
				'name'   => $pricing ? $pricing['name'] : $slug,
				'reason' => cyh_pricing_reason_label( $pricing ? $pricing['reason'] : 'not_found' ),
			];
			continue;
		}
		$unit      = (int) round( $pricing['effective'] );
		$lines[]   = [
			'slug'     => $slug,
			'name'     => $pricing['name'],
			'sku'      => $pricing['sku'],
			'qty'      => $n,
			'unit'     => $unit,
			'buy_mode' => 'cart',
		];
		$subtotal += $unit * $n;
	}
	return [ 'lines' => $lines, 'moved' => $moved, 'subtotal' => $subtotal ];
}

function cyh_checkout_session_key( $token ) {
	return 'cyh_cos_' . hash( 'sha256', (string) $token );
}

/** شمارنده‌ی ساده‌ی نرخ درخواست به تفکیک مسیر. */
function cyh_checkout_rate_limited( $bucket, $max ) {
	$key   = 'cyh_corl_' . $bucket . '_' . md5( cyh_client_ip() );
	$count = (int) get_transient( $key );
	if ( $count >= $max ) {
		return true;
	}
	set_transient( $key, $count + 1, 10 * MINUTE_IN_SECONDS );
	return false;
}

function cyh_register_checkout_routes() {
	register_rest_route(
		'crane-yadak/v1',
		'/checkout/session',
		[
			'methods'             => 'POST',
			'permission_callback' => '__return_true',
			'callback'            => 'cyh_rest_checkout_session',
		]
	);
	register_rest_route(
		'crane-yadak/v1',
		'/checkout/pay',
		[
			'methods'             => 'POST',
			'permission_callback' => '__return_true',
			'callback'            => 'cyh_rest_checkout_pay',
		]
	);
	register_rest_route(
		'crane-yadak/v1',
		'/checkout/callback',
		[
			'methods'             => 'GET',
			'permission_callback' => '__return_true',
			'callback'            => 'cyh_rest_checkout_callback',
		]
	);
}
add_action( 'rest_api_init', 'cyh_register_checkout_routes' );

function cyh_rest_checkout_session( $request ) {
	if ( cyh_checkout_rate_limited( 'session', 30 ) ) {
		return new WP_REST_Response( [ 'ok' => false, 'message' => 'تعداد درخواست زیاد بود. چند دقیقه بعد دوباره امتحان کنید.' ], 429 );
	}
	$built = cyh_checkout_build( $request->get_param( 'items' ) );
	$out   = [
		'ok'           => true,
		'moved'        => $built['moved'],
		'lines'        => [],
		'subtotal'     => 0,
		'vatRate'      => cyh_checkout_vat_rate(),
		'sandbox'      => cyh_zp_sandbox(),
		'gatewayReady' => '' !== cyh_zp_merchant(),
		'session'      => null,
		'expiresAt'    => null,
	];
	if ( ! $built['lines'] ) {
		return new WP_REST_Response( $out, 200 );
	}

	$token   = wp_generate_password( 32, false );
	$expires = time() + CYH_CHECKOUT_TTL;
	set_transient(
		cyh_checkout_session_key( $token ),
		[
			'lines'    => $built['lines'],
			'subtotal' => $built['subtotal'],
			'expires'  => $expires,
		],
		CYH_CHECKOUT_TTL
	);

	$out['session']   = $token;
	$out['expiresAt'] = gmdate( 'c', $expires );
	$out['subtotal']  = $built['subtotal'];
	$out['lines']     = array_map(
		static function ( $l ) {
			return [
				'slug'  => $l['slug'],
				'name'  => $l['name'],
				'sku'   => $l['sku'],
				'qty'   => $l['qty'],
				'unit'  => $l['unit'],
				'total' => $l['unit'] * $l['qty'],
			];
		},
		$built['lines']
	);
	return new WP_REST_Response( $out, 200 );
}

/* =========================================================================
   ۴) زرین‌پال
   ========================================================================= */

/**
 * POST به زرین‌پال. خروجی: network (نرسید)، code (data.code یا errors.code)،
 * data. ⚠️ در خطا، زرین‌پال "data": [] و "errors": {code, message} می‌دهد —
 * خواندن فقط data.code خطا را «بدون کد» نشان می‌داد.
 */
function cyh_zp_post( $path, array $body ) {
	$res = wp_remote_post(
		cyh_zp_base() . $path,
		[
			'timeout' => 20,
			'headers' => [
				'Content-Type' => 'application/json',
				'Accept'       => 'application/json',
			],
			'body'    => wp_json_encode( $body ),
		]
	);
	if ( is_wp_error( $res ) ) {
		return [ 'network' => true, 'code' => null, 'data' => [] ];
	}
	$json = json_decode( (string) wp_remote_retrieve_body( $res ), true );
	$data = is_array( $json['data'] ?? null ) ? $json['data'] : [];
	$code = null;
	if ( isset( $data['code'] ) ) {
		$code = (int) $data['code'];
	} elseif ( is_array( $json['errors'] ?? null ) && isset( $json['errors']['code'] ) ) {
		$code = (int) $json['errors']['code'];
	}
	return [ 'network' => ! is_array( $json ), 'code' => $code, 'data' => $data ];
}

/** مبدأ سایت استاتیک برای بازگشت: فقط از فهرست CORS، وگرنه پیش‌فرض. */
function cyh_checkout_return_origin( $request ) {
	$origin = untrailingslashit( (string) $request->get_header( 'origin' ) );
	return in_array( $origin, cyh_get_allowed_origins(), true ) ? $origin : untrailingslashit( cyh_get_frontend_url() );
}

function cyh_checkout_result_url( $origin, $code, $result, $ref = '' ) {
	$url = $origin . '/checkout/result?r=' . rawurlencode( $result );
	if ( '' !== $code ) {
		$url .= '&code=' . rawurlencode( $code );
	}
	if ( '' !== $ref ) {
		$url .= '&ref=' . rawurlencode( $ref );
	}
	return $url;
}

function cyh_rest_checkout_pay( $request ) {
	if ( '' !== trim( (string) $request->get_param( 'website' ) ) ) {
		return new WP_REST_Response( [ 'ok' => false, 'message' => 'درخواست نامعتبر.' ], 400 );
	}
	if ( cyh_checkout_rate_limited( 'pay', 10 ) ) {
		return new WP_REST_Response( [ 'ok' => false, 'message' => 'تعداد تلاش زیاد بود. چند دقیقه بعد دوباره امتحان کنید.' ], 429 );
	}

	$token   = (string) $request->get_param( 'session' );
	$session = '' !== $token ? get_transient( cyh_checkout_session_key( $token ) ) : false;
	if ( ! is_array( $session ) || ( $session['expires'] ?? 0 ) < time() ) {
		return new WP_REST_Response(
			[ 'ok' => false, 'expired' => true, 'message' => 'مهلت این صفحه‌ی پرداخت تمام شد. صفحه را دوباره باز کنید تا قیمت‌ها تازه شوند.' ],
			410
		);
	}

	[ $customer, $errors ]  = cyh_checkout_validate_customer( $request->get_param( 'customer' ) );
	[ $invoice, $inv_errs ] = cyh_checkout_validate_invoice( $request->get_param( 'invoice' ) );
	$errors                 = array_merge( $errors, $inv_errs );
	if ( ! $request->get_param( 'terms' ) ) {
		$errors['terms'] = 'پذیرش قوانین و شرایط لازم است.';
	}
	if ( $errors ) {
		return new WP_REST_Response( [ 'ok' => false, 'errors' => $errors, 'message' => 'چند فیلد نیاز به اصلاح دارد.' ], 400 );
	}

	$merchant = cyh_zp_merchant();
	if ( '' === $merchant ) {
		return new WP_REST_Response(
			[ 'ok' => false, 'message' => 'درگاه پرداخت هنوز پیکربندی نشده است. لطفاً از سبد استعلام پیش‌فاکتور بگیرید یا تماس بگیرید.' ],
			503
		);
	}

	$totals  = cyh_checkout_totals( $session['subtotal'], null !== $invoice, cyh_checkout_vat_rate() );
	$sandbox = cyh_zp_sandbox();
	$code    = cyh_generate_tracking_code();
	$origin  = cyh_checkout_return_origin( $request );
	$user_id = 0;
	if ( '' !== cyh_customer_request_token( $request ) ) {
		$auth    = cyh_customer_authenticate_request( $request );
		$user_id = is_wp_error( $auth ) ? 0 : (int) $auth;
	}

	$post_id = wp_insert_post(
		[
			'post_type'   => CYH_QUOTE_CPT,
			'post_status' => 'publish',
			'post_author' => $user_id,
			'post_title'  => sprintf(
				'%s%s — %s (سفارش، %d قلم)',
				$sandbox ? '[آزمایشی] ' : '',
				$code,
				$customer['name'],
				count( $session['lines'] )
			),
		],
		true
	);
	if ( is_wp_error( $post_id ) ) {
		return new WP_REST_Response( [ 'ok' => false, 'message' => 'ثبت سفارش ناموفق بود. لطفاً تماس بگیرید.' ], 500 );
	}

	$meta = [
		'cyh_code'          => $code,
		'cyh_kind'          => 'order',
		'cyh_status'        => 'new',
		'cyh_name'          => $customer['name'],
		// پیگیری با کد + همین شماره (cyh_rest_quote_status) — بدون صفر اول هم.
		'cyh_phone'         => $customer['phone'],
		'cyh_org'           => $invoice && 'legal' === $invoice['type'] ? $invoice['name'] : '',
		'cyh_note'          => '',
		'cyh_items'         => $session['lines'],
		'cyh_estimate'      => '',
		'cyh_customer'      => $customer,
		'cyh_invoice'       => $invoice ? $invoice : '',
		'cyh_subtotal'      => $totals['subtotal'],
		'cyh_vat_rate'      => $totals['vat_rate'],
		'cyh_vat'           => $totals['vat'],
		'cyh_total'         => $totals['total'],
		'cyh_payment'       => 'pending',
		'cyh_sandbox'       => $sandbox ? 1 : 0,
		'cyh_return_origin' => $origin,
		'cyh_user'          => $user_id,
	];
	foreach ( $meta as $k => $v ) {
		update_post_meta( $post_id, $k, $v );
	}

	$callback = rest_url( 'crane-yadak/v1/checkout/callback' );
	$callback .= ( false === strpos( $callback, '?' ) ? '?' : '&' ) . 'order=' . rawurlencode( $code );

	$zp = cyh_zp_post(
		'/pg/v4/payment/request.json',
		[
			'merchant_id'  => $merchant,
			'amount'       => $totals['total'],
			'currency'     => 'IRR',
			'description'  => sprintf( 'سفارش %s — کرین یدک', $code ),
			'callback_url' => $callback,
			'metadata'     => array_filter(
				[
					'mobile'   => $customer['phone'],
					'email'    => $customer['email'],
					'order_id' => $code,
				]
			),
		]
	);
	$authority = (string) ( $zp['data']['authority'] ?? '' );
	if ( 100 !== $zp['code'] || '' === $authority ) {
		update_post_meta( $post_id, 'cyh_payment', 'failed' );
		update_post_meta( $post_id, 'cyh_pay_error', $zp['network'] ? 'network' : (string) $zp['code'] );
		return new WP_REST_Response(
			[ 'ok' => false, 'message' => 'اتصال به درگاه پرداخت برقرار نشد. چند دقیقه بعد دوباره امتحان کنید.' ],
			502
		);
	}
	update_post_meta( $post_id, 'cyh_authority', $authority );

	// نشست یک‌بارمصرف است — فقط پس از گرفتن authority. اگر درگاه بالا نیامد،
	// خریدار با همان عکس قیمت دوباره تلاش می‌کند.
	delete_transient( cyh_checkout_session_key( $token ) );

	return new WP_REST_Response(
		[
			'ok'       => true,
			'code'     => $code,
			'redirect' => cyh_zp_base() . '/pg/StartPay/' . rawurlencode( $authority ),
		],
		200
	);
}

/**
 * بازگشت از زرین‌پال → verify → [result, url].
 * result: ok | fail | pending | error. جدا از REST تا هارنس بیازمایدش.
 */
function cyh_checkout_complete( $code, $authority ) {
	$default = untrailingslashit( cyh_get_frontend_url() );
	$code    = strtoupper( sanitize_text_field( (string) $code ) );
	$found   = '' === $code ? [] : get_posts(
		[
			'post_type'      => CYH_QUOTE_CPT,
			'post_status'    => 'publish',
			'posts_per_page' => 1,
			'meta_query'     => [ // phpcs:ignore WordPress.DB.SlowDBQuery
				'relation' => 'AND',
				[ 'key' => 'cyh_code', 'value' => $code ],
				[ 'key' => 'cyh_kind', 'value' => 'order' ],
			],
		]
	);
	if ( ! $found ) {
		return [ 'result' => 'error', 'url' => cyh_checkout_result_url( $default, '', 'error' ) ];
	}

	$id     = $found[0]->ID;
	$origin = (string) get_post_meta( $id, 'cyh_return_origin', true ) ?: $default;
	$done   = static function ( $result, $ref = '' ) use ( $origin, $code ) {
		return [ 'result' => $result, 'url' => cyh_checkout_result_url( $origin, $code, $result, $ref ) ];
	};

	if ( 'paid' === get_post_meta( $id, 'cyh_payment', true ) ) {
		return $done( 'ok', (string) get_post_meta( $id, 'cyh_ref_id', true ) );
	}
	$stored = (string) get_post_meta( $id, 'cyh_authority', true );
	if ( '' === $stored || ! hash_equals( $stored, (string) $authority ) ) {
		return $done( 'error' );
	}

	/* ⚠️ قفل: دو درخواست هم‌زمان (دو زبانه، رفرش سریع) نباید هر دو verify و
	   ایمیل «پرداخت شد» بفرستند. add_option در وردپرس اگر کلید باشد false
	   برمی‌گرداند (INSERT یکتا). قفل رهاشده‌ی بیش از ۶۰ ثانیه — از پردازشی
	   که وسط کار مرد — بازپس گرفته می‌شود. */
	$lock = 'cyh_zp_lock_' . $id;
	if ( ! add_option( $lock, time(), '', 'no' ) ) {
		if ( time() - (int) get_option( $lock, 0 ) < 60 ) {
			return $done( 'pending' );
		}
		update_option( $lock, time() );
	}

	try {
		$zp = cyh_zp_post(
			'/pg/v4/payment/verify.json',
			[
				'merchant_id' => cyh_zp_merchant(),
				'amount'      => (int) get_post_meta( $id, 'cyh_total', true ),
				'authority'   => $stored,
			]
		);
		if ( $zp['network'] ) {
			// وضعیت نامعلوم: «در انتظار» می‌ماند، نه «ناموفق» — شاید پول کسر شده.
			return $done( 'pending' );
		}
		if ( 100 === $zp['code'] || 101 === $zp['code'] ) {
			$ref = (string) ( $zp['data']['ref_id'] ?? '' );
			update_post_meta( $id, 'cyh_payment', 'paid' );
			update_post_meta( $id, 'cyh_ref_id', $ref );
			update_post_meta( $id, 'cyh_card_pan', sanitize_text_field( (string) ( $zp['data']['card_pan'] ?? '' ) ) );
			update_post_meta( $id, 'cyh_paid_at', time() );
			cyh_checkout_notify_paid( $id );
			return $done( 'ok', $ref );
		}
		update_post_meta( $id, 'cyh_payment', 'failed' );
		update_post_meta( $id, 'cyh_pay_error', (string) $zp['code'] );
		return $done( 'fail' );
	} finally {
		delete_option( $lock );
	}
}

function cyh_rest_checkout_callback( $request ) {
	$out      = cyh_checkout_complete( $request->get_param( 'order' ), $request->get_param( 'Authority' ) );
	$response = new WP_REST_Response( null, 302 );
	$response->header( 'Location', $out['url'] );
	return $response;
}

function cyh_checkout_notify_paid( $post_id ) {
	$lines = [];
	foreach ( (array) get_post_meta( $post_id, 'cyh_items', true ) as $item ) {
		$lines[] = sprintf( '- %s%s × %d', $item['name'], $item['sku'] ? ' (کد ' . $item['sku'] . ')' : '', $item['qty'] );
	}
	$invoice = get_post_meta( $post_id, 'cyh_invoice', true );
	wp_mail(
		get_option( 'cyh_notification_email' ) ?: get_option( 'admin_email' ),
		sprintf(
			'%sسفارش پرداخت‌شده %s',
			get_post_meta( $post_id, 'cyh_sandbox', true ) ? '[آزمایشی] ' : '',
			get_post_meta( $post_id, 'cyh_code', true )
		),
		implode(
			"\n",
			[
				'کد سفارش: ' . get_post_meta( $post_id, 'cyh_code', true ),
				'مبلغ پرداخت‌شده (ریال): ' . number_format( (int) get_post_meta( $post_id, 'cyh_total', true ) ),
				'شماره پیگیری زرین‌پال: ' . get_post_meta( $post_id, 'cyh_ref_id', true ),
				'فاکتور رسمی: ' . ( is_array( $invoice ) ? 'بله' : 'خیر' ),
				'گیرنده: ' . get_post_meta( $post_id, 'cyh_name', true ) . ' — ' . get_post_meta( $post_id, 'cyh_phone', true ),
				'',
				'اقلام:',
				implode( "\n", $lines ),
				'',
				'ارسال: پس‌کرایه',
			]
		)
	);
}
