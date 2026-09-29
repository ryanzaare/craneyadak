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
 *   • پرداخت مهمان ممنوع است (تصمیم کارفرما، ۷ مهر ۱۴۰۵): فاکتور رسمی به
 *     هویت ثبت‌شده نیاز دارد. هر دو مسیر session و pay بدون توکن معتبر
 *     ۴۰۱ می‌دهند؛ سفارش همیشه به یک کاربر وصل است.
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

/**
 * روش‌های ارسال. همه پس‌کرایه‌اند: هزینه‌ی ارسال در مبلغ پرداختی نیست.
 * ⚠️ عبارت داخل پرانتز روش هوایی الزام حقوقی کارفرماست؛ متن *کامل* در
 * سفارش ثبت می‌شود (cyh_shipping_label) تا بعداً معلوم باشد خریدار چه
 * شرطی را دیده است. همین فهرست در src/lib/checkout.ts (SHIPPING_METHODS)
 * تکرار شده و src/lib/checkout.test.mts آن‌ها را با هم مقایسه می‌کند.
 */
function cyh_shipping_methods() {
	return [
		'tipax'   => 'تیپاکس',
		'bus'     => 'اتوبوس',
		'freight' => 'باربری',
		'air'     => 'ارسال هوایی (پس‌کرایه - مشروط به وضعیت نرمال مرزها و پروازها)',
	];
}

/** کد روش ارسال → کد پاک، یا ['', خطا]. */
function cyh_checkout_validate_shipping( $raw ) {
	// ⚠️ تطبیق دقیق، نه sanitize_key: آن حروف بزرگ را کوچک می‌کند و آرایه‌ی
	// ارسالی را با هشدار «Array to string» می‌شکند. کد باید عیناً یکی از
	// چهار کد فهرست باشد.
	$code    = is_string( $raw ) ? $raw : '';
	$methods = cyh_shipping_methods();
	if ( ! isset( $methods[ $code ] ) ) {
		return [ '', 'روش ارسال را انتخاب کنید.' ];
	}
	return [ $code, '' ];
}

/**
 * مبالغ به ریال، عدد صحیح. مالیات فقط با فاکتور رسمی.
 *
 * ⚠️ گرد کردن فقط یک بار و روی جمع نهایی: total = round(sub × (۱۰۰+نرخ) ÷ ۱۰۰)
 * و vat = total − sub. مالیات جدا گرد نمی‌شود، پس اقلام همیشه با جمع
 * می‌خوانند و ریال کسری وجود ندارد (زرین‌پال عدد صحیح می‌خواهد). چون
 * subtotal صحیح است، نتیجه با sub + round(sub × نرخ ÷ ۱۰۰) یکی است.
 * همان فرمول در src/lib/checkout.ts (checkoutTotals).
 */
function cyh_checkout_totals( $subtotal, $invoice_wanted, $rate ) {
	$subtotal = (int) round( $subtotal );
	$total    = $invoice_wanted ? (int) round( $subtotal * ( 100 + $rate ) / 100 ) : $subtotal;
	return [
		'subtotal' => $subtotal,
		'vat_rate' => $invoice_wanted ? (float) $rate : 0.0,
		'vat'      => $total - $subtotal,
		'total'    => $total,
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

/**
 * پرداخت مهمان ممنوع است — کاربر را از توکن می‌شناسد، وگرنه پاسخ ۴۰۱.
 * خروجی: شناسه‌ی کاربر (int) یا WP_REST_Response ۴۰۱.
 */
function cyh_checkout_require_user( $request ) {
	$auth = cyh_customer_authenticate_request( $request );
	if ( is_wp_error( $auth ) ) {
		return new WP_REST_Response(
			[ 'ok' => false, 'auth' => true, 'message' => 'برای پرداخت باید وارد حساب کاربری شوید.' ],
			401
		);
	}
	return (int) $auth;
}

function cyh_rest_checkout_session( $request ) {
	$user = cyh_checkout_require_user( $request );
	if ( $user instanceof WP_REST_Response ) {
		return $user;
	}
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
	$user_id = cyh_checkout_require_user( $request );
	if ( $user_id instanceof WP_REST_Response ) {
		return $user_id;
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
	[ $shipping, $ship_err ] = cyh_checkout_validate_shipping( $request->get_param( 'shipping' ) );
	if ( '' !== $ship_err ) {
		$errors['shipping'] = $ship_err;
	}
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
		'cyh_shipping'      => $shipping,
		'cyh_shipping_label' => cyh_shipping_methods()[ $shipping ],
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
			cyh_checkout_notify_customer( $id );
			cyh_checkout_save_profile( $id );
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
	$ship    = (string) get_post_meta( $post_id, 'cyh_shipping_label', true );
	$ship    = '' === $ship ? 'پس‌کرایه' : ( false === mb_strpos( $ship, 'پس‌کرایه' ) ? $ship . ' (پس‌کرایه)' : $ship );
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
				'ارسال: ' . $ship,
			]
		)
	);
}

/* =========================================================================
   پنل: «سفارش‌ها» جدا از «درخواست‌های استعلام»
   =========================================================================
   ⚠️ هر دو در همان CPT (cyh_quote) می‌مانند، نه CPT تازه: کد رهگیری،
   /track، callback زرین‌پال و «سفارش‌های من» همه با همین CPT کار می‌کنند و
   جداکردنش یعنی مهاجرت داده‌ی پرداخت‌شده. تفکیک با یک ملاک است: **متای
   cyh_payment** (فقط checkout آن را می‌گذارد). سفارش‌های قدیمیِ /quote با
   kind=order ولی بدون cyh_payment استعلام حساب می‌شوند — پرداختی نداشته‌اند. */

// ⚠️ ثابت CYH_QUOTE_CPT همین‌جا در نام هوک‌ها به کار می‌رود (زمان بارگذاری، نه
// زمان فراخوانی). ترتیب بارگذاری افزونه درست است، ولی هارنس فایل‌ها را الفبایی
// می‌خواند و class-checkout زودتر می‌آید — require_once وابستگی را صریح می‌کند.
require_once __DIR__ . '/class-quote-requests.php';

function cyh_payment_labels() {
	return [
		'pending' => 'در انتظار پرداخت',
		'paid'    => 'پرداخت‌شده',
		'failed'  => 'ناموفق',
	];
}

/** کدام فهرست: 'orders' یا 'quotes'. هر مقدار دیگری = استعلام (پیش‌فرض امن). */
function cyh_admin_quote_view() {
	return ( isset( $_GET['cyh_view'] ) && 'orders' === $_GET['cyh_view'] ) ? 'orders' : 'quotes'; // phpcs:ignore WordPress.Security.NonceVerification
}

function cyh_quote_view_meta_query( $view ) {
	return [
		'key'     => 'cyh_payment',
		'compare' => 'orders' === $view ? 'EXISTS' : 'NOT EXISTS',
	];
}

function cyh_quote_view_url( $view ) {
	return admin_url( 'edit.php?post_type=' . CYH_QUOTE_CPT . ( 'orders' === $view ? '&cyh_view=orders' : '' ) );
}

function cyh_quote_admin_filter_query( $query ) {
	if ( ! is_admin() || ! $query->is_main_query() || CYH_QUOTE_CPT !== $query->get( 'post_type' ) ) {
		return;
	}
	$query->set( 'meta_query', [ cyh_quote_view_meta_query( cyh_admin_quote_view() ) ] );
}
add_action( 'pre_get_posts', 'cyh_quote_admin_filter_query' );

function cyh_quote_view_count( $view ) {
	return count(
		get_posts(
			[
				'post_type'      => CYH_QUOTE_CPT,
				'post_status'    => 'publish',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'meta_query'     => [ cyh_quote_view_meta_query( $view ) ], // phpcs:ignore WordPress.DB.SlowDBQuery
			]
		)
	);
}

/** «همه | منتشرشده» وردپرس هر دو نوع را با هم می‌شمرد؛ جایش دو زبانه‌ی جدا. */
function cyh_quote_views( $views ) {
	$current = cyh_admin_quote_view();
	$out     = [];
	foreach ( [ 'quotes' => 'استعلام‌ها', 'orders' => 'سفارش‌ها' ] as $view => $label ) {
		$out[ 'cyh_' . $view ] = sprintf(
			'<a href="%s"%s>%s <span class="count">(%d)</span></a>',
			esc_url( cyh_quote_view_url( $view ) ),
			$view === $current ? ' class="current" aria-current="page"' : '',
			esc_html( $label ),
			cyh_quote_view_count( $view )
		);
	}
	if ( isset( $views['trash'] ) ) {
		$out['trash'] = $views['trash'];
	}
	return $out;
}
add_filter( 'views_edit-' . CYH_QUOTE_CPT, 'cyh_quote_views' );

function cyh_orders_menu() {
	add_menu_page(
		'سفارش‌ها',
		'سفارش‌ها',
		'edit_posts',
		'edit.php?post_type=' . CYH_QUOTE_CPT . '&cyh_view=orders',
		'',
		'dashicons-cart',
		28
	);
}
add_action( 'admin_menu', 'cyh_orders_menu' );

/** منوی فعال: فهرست سفارش‌ها یا صفحه‌ی ویرایش خودِ یک سفارش. */
function cyh_orders_parent_file( $parent_file ) {
	$on_orders = 'orders' === cyh_admin_quote_view() && 'edit.php?post_type=' . CYH_QUOTE_CPT === $parent_file;
	$post_id   = isset( $_GET['post'] ) ? (int) $_GET['post'] : 0; // phpcs:ignore WordPress.Security.NonceVerification
	$on_edit   = $post_id > 0 && CYH_QUOTE_CPT === get_post_type( $post_id ) && '' !== (string) get_post_meta( $post_id, 'cyh_payment', true );
	return ( $on_orders || $on_edit ) ? 'edit.php?post_type=' . CYH_QUOTE_CPT . '&cyh_view=orders' : $parent_file;
}
add_filter( 'parent_file', 'cyh_orders_parent_file' );

function cyh_orders_columns( $columns ) {
	if ( 'orders' !== cyh_admin_quote_view() ) {
		return $columns;
	}
	return [
		'cb'          => $columns['cb'] ?? '',
		'title'       => 'سفارش',
		'cyh_pay'     => 'پرداخت',
		'cyh_total'   => 'مبلغ کل (ریال)',
		'cyh_phone'   => 'تلفن',
		'cyh_ship'    => 'روش ارسال',
		'cyh_ref'     => 'شماره پیگیری',
		'cyh_status'  => 'وضعیت رسیدگی',
		'date'        => 'تاریخ',
	];
}
add_filter( 'manage_' . CYH_QUOTE_CPT . '_posts_columns', 'cyh_orders_columns', 30 );

function cyh_orders_column_content( $column, $post_id ) {
	$labels = cyh_payment_labels();
	switch ( $column ) {
		case 'cyh_pay':
			$pay    = (string) get_post_meta( $post_id, 'cyh_payment', true );
			$colors = [ 'paid' => '#00a32a', 'pending' => '#996800', 'failed' => '#d63638' ];
			printf(
				'<span style="color:%s;font-weight:700">%s</span>%s',
				esc_attr( $colors[ $pay ] ?? '#646970' ),
				esc_html( $labels[ $pay ] ?? $pay ),
				get_post_meta( $post_id, 'cyh_sandbox', true ) ? ' <em>(آزمایشی)</em>' : ''
			);
			break;
		case 'cyh_total':
			echo esc_html( number_format( (int) get_post_meta( $post_id, 'cyh_total', true ) ) );
			break;
		case 'cyh_ship':
			echo esc_html( (string) get_post_meta( $post_id, 'cyh_shipping_label', true ) ?: '—' );
			break;
		case 'cyh_ref':
			$ref = 'paid' === get_post_meta( $post_id, 'cyh_payment', true ) ? (string) get_post_meta( $post_id, 'cyh_ref_id', true ) : '';
			echo '' === $ref ? '—' : '<code>' . esc_html( $ref ) . '</code>';
			break;
	}
}
add_action( 'manage_' . CYH_QUOTE_CPT . '_posts_custom_column', 'cyh_orders_column_content', 10, 2 );

function cyh_order_metabox( $post_type = '', $post = null ) {
	if ( CYH_QUOTE_CPT !== $post_type || ! is_object( $post ) || '' === (string) get_post_meta( $post->ID, 'cyh_payment', true ) ) {
		return;
	}
	add_meta_box(
		'cyh_order_details',
		'سفارش و پرداخت',
		function ( $post ) {
			$labels   = cyh_payment_labels();
			$pay      = (string) get_post_meta( $post->ID, 'cyh_payment', true );
			$customer = get_post_meta( $post->ID, 'cyh_customer', true );
			$invoice  = get_post_meta( $post->ID, 'cyh_invoice', true );
			$row      = static function ( $label, $value ) {
				printf( '<p><strong>%s:</strong> %s</p>', esc_html( $label ), esc_html( (string) $value ) );
			};
			$row( 'وضعیت پرداخت', ( $labels[ $pay ] ?? $pay ) . ( get_post_meta( $post->ID, 'cyh_sandbox', true ) ? ' (آزمایشی — پول واقعی نیست)' : '' ) );
			$row( 'شماره پیگیری زرین‌پال', 'paid' === $pay ? get_post_meta( $post->ID, 'cyh_ref_id', true ) : '—' );
			$row( 'جمع اقلام (ریال)', number_format( (int) get_post_meta( $post->ID, 'cyh_subtotal', true ) ) );
			$row( 'ارزش افزوده (ریال)', number_format( (int) get_post_meta( $post->ID, 'cyh_vat', true ) ) );
			$row( 'مبلغ کل (ریال)', number_format( (int) get_post_meta( $post->ID, 'cyh_total', true ) ) );
			$row( 'روش ارسال', get_post_meta( $post->ID, 'cyh_shipping_label', true ) ?: '—' );
			if ( is_array( $customer ) ) {
				$row( 'نشانی گیرنده', implode( '، ', array_filter( [ $customer['province'] ?? '', $customer['city'] ?? '', $customer['address'] ?? '' ] ) ) );
				$row( 'کد پستی', $customer['postal'] ?? '' );
			}
			if ( is_array( $invoice ) ) {
				echo '<hr><p><strong>فاکتور رسمی</strong></p>';
				$row( 'نوع', 'legal' === ( $invoice['type'] ?? '' ) ? 'حقوقی' : 'حقیقی' );
				$row( 'نام', $invoice['name'] ?? '' );
				$row( 'کد ملی / شناسه ملی', $invoice['national_id'] ?? '' );
				$row( 'کد اقتصادی', $invoice['economic_code'] ?? '' );
				$row( 'شماره ثبت', $invoice['reg_no'] ?? '' );
				$row( 'کد پستی', $invoice['postal'] ?? '' );
				$row( 'تلفن ثابت', $invoice['landline'] ?? '' );
				$row( 'نشانی', $invoice['address'] ?? '' );
			}
		},
		CYH_QUOTE_CPT,
		'normal',
		'high'
	);
}
add_action( 'add_meta_boxes', 'cyh_order_metabox', 10, 2 );

/* =========================================================================
   ذخیره‌ی مشخصات برای سفارش بعدی
   ========================================================================= */
const CYH_SAVED_CHECKOUT_META = 'cyh_saved_checkout';

/**
 * پس از پرداخت *موفق* مشخصات همین سفارش روی حساب ذخیره می‌شود تا سفارش بعدی
 * پیش‌پر باشد. مشخصات فاکتور فقط وقتی فاکتور رسمی خواسته شده به‌روز می‌شود؛
 * سفارش بدون فاکتور، مشخصات ذخیره‌ی قبلی را پاک نمی‌کند. روش ارسال عمداً ذخیره
 * نمی‌شود: انتخاب آگاهانه است (ارسال هوایی شرط حقوقی دارد).
 */
function cyh_checkout_save_profile( $post_id ) {
	$post = get_post( $post_id );
	$uid  = $post && ! empty( $post->post_author ) ? (int) $post->post_author : 0;
	if ( $uid <= 0 ) {
		return;
	}
	$customer = get_post_meta( $post_id, 'cyh_customer', true );
	if ( ! is_array( $customer ) ) {
		return;
	}
	$saved             = cyh_checkout_saved( $uid ) ?: [];
	$saved['customer'] = $customer;
	$invoice           = get_post_meta( $post_id, 'cyh_invoice', true );
	if ( is_array( $invoice ) ) {
		$saved['invoice'] = $invoice;
	}
	update_user_meta( $uid, CYH_SAVED_CHECKOUT_META, $saved );
}

/** مشخصات ذخیره‌شده یا null. فقط کلیدهای شناخته‌شده برگردانده می‌شود. */
function cyh_checkout_saved( $user_id ) {
	$raw = get_user_meta( $user_id, CYH_SAVED_CHECKOUT_META, true );
	if ( ! is_array( $raw ) || empty( $raw['customer'] ) || ! is_array( $raw['customer'] ) ) {
		return null;
	}
	$pick = static function ( $src, $keys ) {
		$out = [];
		foreach ( $keys as $k ) {
			$out[ $k ] = isset( $src[ $k ] ) ? (string) $src[ $k ] : '';
		}
		return $out;
	};
	$out = [ 'customer' => $pick( $raw['customer'], [ 'name', 'phone', 'email', 'province', 'city', 'address', 'postal' ] ) ];
	if ( ! empty( $raw['invoice'] ) && is_array( $raw['invoice'] ) ) {
		$out['invoice'] = $pick( $raw['invoice'], [ 'type', 'name', 'national_id', 'economic_code', 'reg_no', 'postal', 'landline', 'address' ] );
	}
	return $out;
}
