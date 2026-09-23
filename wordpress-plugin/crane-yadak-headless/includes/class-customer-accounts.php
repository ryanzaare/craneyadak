<?php
/**
 * حساب کاربری مشتری — ایست ۶ در docs/backlog.md.
 *
 * ---------------------------------------------------------------------------
 * چرا کاربران بومی وردپرس، نه CPT سفارشی
 *
 * هش رمز عبور، جدول کاربران و گردش «فراموشی رمز» را خودِ وردپرس امن و
 * تست‌شده می‌دهد. ساختن این‌ها از نو دقیقاً همان «فنجان یک‌بارمصرف»ای است
 * که این پروژه همیشه از آن پرهیز کرده. فقط لایه‌ی روی آن — صدور توکن
 * برای فرانت‌اند استاتیک — مال ما است.
 *
 * چرا توکن سفارشی، نه یک افزونه‌ی JWT
 *
 * سایت استاتیک است، پس session سمت سرور وجود ندارد و فرانت‌اند باید
 * ورودش را با چیزی جدا از کوکی نگه دارد. یک افزونه‌ی JWT این را می‌دهد،
 * ولی یک وابستگی تازه است برای کاری که دو تابع کوچک حل می‌کند: توکن
 * تصادفی، هش‌شده در متای کاربر، با انقضا. همان فلسفه‌ی «دو
 * wp_remote_post() کافی است» در ایست ۲.
 *
 * چرا هش توکن در *نام* متا، نه در مقدارش
 *
 * برگرداندن کاربر از روی توکن باید سریع باشد. جدول wp_usermeta روی
 * meta_key ایندکس دارد، نه meta_value؛ پس اگر هش را کلید متا کنیم
 * (`_cyh_token_<hash>`)، پیداکردن صاحب توکن یک get_users با meta_key
 * دقیق است — همان الگویی که Application Passwords خودِ وردپرس هم
 * استفاده می‌کند. اگر هش را مقدار می‌گذاشتیم، هر بررسی توکن یک اسکن
 * کامل جدول متا می‌شد.
 * ---------------------------------------------------------------------------
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const CYH_CUSTOMER_ROLE       = 'crane_customer';
const CYH_TOKEN_TTL           = 30 * DAY_IN_SECONDS;
const CYH_PASSWORD_RESET_TTL  = HOUR_IN_SECONDS;
const CYH_TOKEN_META_PREFIX   = '_cyh_token_';
const CYH_RESET_HASH_META     = '_cyh_pwreset_hash';
const CYH_RESET_EXPIRY_META   = '_cyh_pwreset_expires';

/* =========================================================================
   ۰) نقش
   ========================================================================= */
/**
 * ⚠️ `add_role` فقط هنگام فعال‌سازی افزونه اجرا می‌شود (کامنت بالای
 * `cyh_activate()` در فایل اصلی). یعنی نصب‌های از قبل فعال — مثل همین
 * سایت در لحظه‌ی نوشتن این کد — این نقش تازه را با overwrite صرف فایل‌ها
 * نمی‌گیرند. `cyh_maybe_reregister_roles()` پایین همین فایل این را با
 * یک نگهبان نسخه روی `admin_init` جبران می‌کند.
 */
function cyh_register_customer_role() {
	add_role(
		CYH_CUSTOMER_ROLE,
		'مشتری',
		[
			'read' => true,
		]
	);
}

/**
 * نگهبان ارتقا — نقش‌ها را برای نصب‌های موجود هم به‌روز نگه می‌دارد.
 *
 * ⚠️ بدون این، افزودن هر نقش تازه در نسخه‌های بعدی فقط روی نصب‌های
 * *تازه* اثر می‌کرد، نه روی سایتی که از نسخه‌ی قبل‌تر فعال بوده — دقیقاً
 * همان «شکست بی‌صدا» که این پروژه چند بار به آن برخورده: کد درست است،
 * ولی هیچ‌وقت روی سایت واقعی اجرا نمی‌شود.
 */
function cyh_maybe_reregister_roles() {
	if ( get_option( 'cyh_roles_version' ) === CYH_VERSION ) {
		return;
	}
	cyh_register_customer_role();
	if ( function_exists( 'cyh_register_roles' ) ) {
		cyh_register_roles(); // نقش‌های سازمانی — class-community.php
	}
	update_option( 'cyh_roles_version', CYH_VERSION );
}
add_action( 'admin_init', 'cyh_maybe_reregister_roles' );

/* =========================================================================
   ۱) توکن — صدور، تأیید، ابطال
   ========================================================================= */

/** توکن خام را برای مشتری صادر می‌کند و هش آن را در متای کاربر ذخیره می‌کند. */
function cyh_customer_issue_token( $user_id ) {
	$token = bin2hex( wp_generate_password( 64, false, false ) );
	// ⚠️ wp_generate_password طول را به‌صورت *کاراکتر* می‌گیرد، نه بایت؛
	// hex کردنش تصادفی‌بودن را کم نمی‌کند چون خودِ کاراکترها از یک
	// الفبای گسترده‌اند، فقط طول رشته را دو برابر می‌کند. طول واقعی
	// اهمیتی ندارد — فقط باید به‌اندازه‌ی کافی حدس‌ناپذیر باشد.
	$hash = hash( 'sha256', $token );
	update_user_meta( $user_id, CYH_TOKEN_META_PREFIX . $hash, time() + CYH_TOKEN_TTL );
	return $token;
}

/** توکن خام از هدر → شناسه‌ی کاربر، یا false اگر نامعتبر/منقضی. */
function cyh_customer_verify_token( $token ) {
	$token = trim( (string) $token );
	if ( '' === $token ) {
		return false;
	}
	$hash  = hash( 'sha256', $token );
	$users = get_users(
		[
			'meta_key'   => CYH_TOKEN_META_PREFIX . $hash,
			'number'     => 1,
			'fields'     => 'ID',
		]
	);
	if ( empty( $users ) ) {
		return false;
	}
	$user_id = (int) $users[0];
	$expires = (int) get_user_meta( $user_id, CYH_TOKEN_META_PREFIX . $hash, true );
	if ( $expires < time() ) {
		delete_user_meta( $user_id, CYH_TOKEN_META_PREFIX . $hash );
		return false;
	}
	return $user_id;
}

/** فقط همین توکن (یک دستگاه/نشست) را باطل می‌کند — بقیه دست‌نخورده می‌مانند. */
function cyh_customer_revoke_token( $token ) {
	$user_id = cyh_customer_verify_token( $token );
	if ( ! $user_id ) {
		return;
	}
	delete_user_meta( $user_id, CYH_TOKEN_META_PREFIX . hash( 'sha256', trim( (string) $token ) ) );
}

/**
 * همه‌ی توکن‌های یک کاربر را باطل می‌کند — بعد از تغییر رمز.
 *
 * ⚠️ بدون این، تغییر رمز فقط رمز را عوض می‌کرد ولی نشست‌های باز (مثلاً
 * روی دستگاهی که گم شده) همچنان معتبر می‌ماندند. تغییر رمز باید یعنی
 * «همه‌جا خارج شو»، نه فقط «از این به بعد رمز تازه لازم است».
 */
function cyh_customer_revoke_all_tokens( $user_id ) {
	foreach ( get_user_meta( $user_id ) as $key => $value ) {
		if ( str_starts_with( $key, CYH_TOKEN_META_PREFIX ) ) {
			delete_user_meta( $user_id, $key );
		}
	}
}

/**
 * توکن خام درخواست — اول هدر X-Crane-Token، بعد Authorization: Bearer.
 *
 * ⚠️ چرا هدر سفارشی اول است: روی بسیاری از هاست‌های اشتراکی (Apache با
 * PHP به‌شکل CGI/FastCGI) هدر Authorization پیش از رسیدن به PHP حذف
 * می‌شود، مگر قاعده‌ای در .htaccess آن را برگرداند. هدرهای X- این
 * مشکل را ندارند. 🔶 این‌که هاست این پروژه Authorization را حذف
 * می‌کند یا نه آزموده نشده؛ هدر سفارشی آن سؤال را بی‌اهمیت می‌کند.
 * Authorization فقط برای سازگاری نگه داشته شد.
 */
function cyh_customer_request_token( $request ) {
	$custom = trim( (string) $request->get_header( 'x-crane-token' ) );
	if ( '' !== $custom ) {
		return $custom;
	}
	$header = trim( (string) $request->get_header( 'authorization' ) );
	return preg_match( '/^Bearer\s+(.+)$/i', $header, $m ) ? trim( $m[1] ) : '';
}

/** توکن درخواست را می‌خواند و کاربر را برمی‌گرداند. */
function cyh_customer_authenticate_request( $request ) {
	$token = cyh_customer_request_token( $request );
	if ( '' === $token ) {
		return new WP_Error( 'cyh_no_token', 'وارد نشده‌اید.', [ 'status' => 401 ] );
	}
	$user_id = cyh_customer_verify_token( $token );
	if ( ! $user_id ) {
		return new WP_Error( 'cyh_bad_token', 'نشست منقضی شده — دوباره وارد شوید.', [ 'status' => 401 ] );
	}
	return $user_id;
}

/* =========================================================================
   ۲) کمک‌کننده‌های اعتبارسنجی
   ========================================================================= */

/** همان الگوی موبایل ایران که فرم تماس استفاده می‌کند (class-rest-contact.php). */
/**
 * سیاست رمز عبور — مشکل را برمی‌گرداند، یا null اگر رمز قابل قبول است.
 *
 * تاریخچه‌ی تصمیم (هر دو از کارفرما):
 *   • نسخه‌ی اول فقط «حداقل ۸ کاراکتر» بود — `12345678` و `password`
 *     از آن رد می‌شدند. قیدهای ۲ تا ۵ اضافه شد.
 *   • یک نسخه‌ی میانی حداقل را ۱۰ کرد؛ کارفرما گفت زیاد است. با وجود
 *     قیدهای ۲ تا ۵، ۸ کافی است — طول تنها قید نیست.
 *
 * قیدها، هرکدام برای یک مشکل مشخص:
 *   ۱) طول ≥ ۸ — mb_strlen، چون حرف فارسی چندبایتی است.
 *   ۲) ارقام فارسی/عربی **ممنوع**، فقط 0-9 انگلیسی. رمز با ارقام فارسی
 *      روی صفحه‌کلید دیگر (یا دستگاه دیگر) عملاً قابل تایپ نیست و کاربر
 *      از حساب خودش بیرون می‌ماند. ⚠️ عمداً به لاتین تبدیل *نمی‌شوند*:
 *      تبدیل یعنی «۱۲۳» و «123» دو رمز یکسان باشند، ولی wp_authenticate
 *      رشته‌ی خام را مقایسه می‌کند و ورود بعدی شکست می‌خورد.
 *   ۳) حداقل یک حرف و یک رقم.
 *   ۴) فهرست سیاه + تکرار یک کاراکتر — اولین حدس‌های هر حمله.
 *   ۵) نام ایمیل داخل رمز نباشد.
 *
 * این تابع تنها مرجع است؛ فرم‌های فرانت‌اند فقط پیامش را نشان می‌دهند.
 */
function cyh_customer_password_problem( $pass, $email = '' ) {
	$pass = (string) $pass;

	if ( mb_strlen( $pass ) < 8 ) {
		return 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
	}

	if ( preg_match( '/[\x{06F0}-\x{06F9}\x{0660}-\x{0669}]/u', $pass ) ) {
		return 'در رمز عبور فقط از اعداد انگلیسی (0-9) استفاده کنید، نه اعداد فارسی.';
	}

	if ( ! preg_match( '/\p{L}/u', $pass ) || ! preg_match( '/[0-9]/', $pass ) ) {
		return 'رمز عبور باید هم حرف داشته باشد و هم عدد.';
	}

	$lower = mb_strtolower( $pass );
	$blocked = [
		'password1', 'password12', 'password123', 'password1234', 'passw0rd',
		'qwerty123', 'qwerty1234', 'qwerty12345', 'abc12345', 'abcd1234',
		'12345678a', 'a12345678', '1q2w3e4r', '1qaz2wsx', 'iloveyou1',
		'admin123', 'admin1234', 'welcome1', 'welcome123', 'test1234',
		'pass1234', 'crane123', 'craneyadak1', 'craneyadak123',
	];
	if ( in_array( $lower, $blocked, true ) ) {
		return 'این رمز عبور بسیار رایج است و به‌راحتی حدس زده می‌شود.';
	}

	// یک کاراکتر تکراری با یک رقم ته آن (aaaaaaaaa1) — طولش گول می‌زند.
	if ( preg_match( '/^(.)\1+\d*$/u', $lower ) ) {
		return 'رمز عبور نباید از تکرار یک کاراکتر ساخته شود.';
	}

	$local = mb_strtolower( (string) strstr( (string) $email, '@', true ) );
	if ( mb_strlen( $local ) >= 4 && false !== mb_strpos( $lower, $local ) ) {
		return 'رمز عبور نباید شامل نام ایمیل شما باشد.';
	}

	return null;
}

function cyh_customer_valid_phone( $digits ) {
	return (bool) preg_match( '/^(0)?9\d{9}$/', $digits );
}

function cyh_customer_profile( $user ) {
	return [
		'id'      => (int) $user->ID,
		'name'    => $user->display_name,
		'email'   => $user->user_email,
		'phone'   => get_user_meta( $user->ID, 'cyh_phone', true ) ?: null,
		'company' => get_user_meta( $user->ID, 'cyh_company', true ) ?: null,
	];
}

/* =========================================================================
   ۳) اندپوینت‌های REST
   ========================================================================= */
function cyh_register_customer_routes() {
	$public = [ 'methods' => 'POST', 'permission_callback' => '__return_true' ];

	register_rest_route( 'crane-yadak/v1', '/account/register', array_merge( $public, [ 'callback' => 'cyh_rest_account_register' ] ) );
	register_rest_route( 'crane-yadak/v1', '/account/login', array_merge( $public, [ 'callback' => 'cyh_rest_account_login' ] ) );
	register_rest_route( 'crane-yadak/v1', '/account/logout', array_merge( $public, [ 'callback' => 'cyh_rest_account_logout' ] ) );
	register_rest_route( 'crane-yadak/v1', '/account/forgot-password', array_merge( $public, [ 'callback' => 'cyh_rest_account_forgot_password' ] ) );
	register_rest_route( 'crane-yadak/v1', '/account/reset-password', array_merge( $public, [ 'callback' => 'cyh_rest_account_reset_password' ] ) );
	register_rest_route(
		'crane-yadak/v1',
		'/account/me',
		[ 'methods' => 'GET', 'permission_callback' => '__return_true', 'callback' => 'cyh_rest_account_me' ]
	);
	register_rest_route( 'crane-yadak/v1', '/account/profile', array_merge( $public, [ 'callback' => 'cyh_rest_account_profile' ] ) );
	register_rest_route( 'crane-yadak/v1', '/account/change-password', array_merge( $public, [ 'callback' => 'cyh_rest_account_change_password' ] ) );
	register_rest_route(
		'crane-yadak/v1',
		'/account/wishlist',
		[
			[ 'methods' => 'GET', 'permission_callback' => '__return_true', 'callback' => 'cyh_rest_account_wishlist_get' ],
			[ 'methods' => 'POST', 'permission_callback' => '__return_true', 'callback' => 'cyh_rest_account_wishlist_update' ],
		]
	);
}
add_action( 'rest_api_init', 'cyh_register_customer_routes' );

/**
 * ثبت‌نام.
 *
 * ⚠️ ایمیل **اجباری** است، حتی اگر شماره هم داده شود — تصمیم صریح
 * کارفرما (docs/backlog.md، ایست ۶). بدون سرویس پیامک، ایمیل تنها
 * کانالی است که «فراموشی رمز» می‌تواند از آن عبور کند؛ حساب فقط-شماره
 * یعنی حسابی که هرگز نمی‌تواند رمزش را بازیابی کند.
 */
function cyh_rest_account_register( $request ) {
	$ip = cyh_client_ip();
	if ( '' !== trim( (string) $request->get_param( 'website' ) ) ) {
		return new WP_Error( 'cyh_spam', 'ارسال نامعتبر.', [ 'status' => 400 ] );
	}
	if ( cyh_is_rate_limited( $ip ) ) {
		return new WP_Error( 'cyh_rate_limited', 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.', [ 'status' => 429 ] );
	}

	$name  = sanitize_text_field( (string) $request->get_param( 'name' ) );
	$email = sanitize_email( (string) $request->get_param( 'email' ) );
	$pass  = (string) $request->get_param( 'password' );
	$phone = cyh_to_latin_digits( sanitize_text_field( (string) $request->get_param( 'phone' ) ) );
	$org   = sanitize_text_field( (string) $request->get_param( 'company' ) );

	if ( mb_strlen( $name ) < 2 ) {
		return new WP_Error( 'cyh_bad_name', 'نام را کامل وارد کنید.', [ 'status' => 400 ] );
	}
	if ( ! is_email( $email ) ) {
		return new WP_Error( 'cyh_bad_email', 'ایمیل معتبر نیست.', [ 'status' => 400 ] );
	}
	if ( email_exists( $email ) ) {
		return new WP_Error( 'cyh_email_taken', 'حسابی با این ایمیل قبلاً ساخته شده — وارد شوید.', [ 'status' => 409 ] );
	}
	$pw_problem = cyh_customer_password_problem( $pass, $email );
	if ( null !== $pw_problem ) {
		return new WP_Error( 'cyh_weak_password', $pw_problem, [ 'status' => 400 ] );
	}
	if ( '' !== $phone && ! cyh_customer_valid_phone( $phone ) ) {
		return new WP_Error( 'cyh_bad_phone', 'شماره موبایل معتبر نیست.', [ 'status' => 400 ] );
	}

	$user_id = wp_insert_user(
		[
			'user_login'   => $email,
			'user_email'   => $email,
			'user_pass'    => $pass,
			'display_name' => $name,
			'role'         => CYH_CUSTOMER_ROLE,
		]
	);
	if ( is_wp_error( $user_id ) ) {
		return new WP_Error( 'cyh_register_failed', 'ثبت‌نام انجام نشد. دوباره تلاش کنید.', [ 'status' => 500 ] );
	}

	if ( '' !== $phone ) {
		update_user_meta( $user_id, 'cyh_phone', $phone );
	}
	if ( '' !== $org ) {
		update_user_meta( $user_id, 'cyh_company', $org );
	}

	$token = cyh_customer_issue_token( $user_id );
	return rest_ensure_response(
		[
			'success' => true,
			'token'   => $token,
			'profile' => cyh_customer_profile( get_userdata( $user_id ) ),
		]
	);
}

function cyh_rest_account_login( $request ) {
	$ip = cyh_client_ip();
	if ( cyh_is_rate_limited( $ip ) ) {
		return new WP_Error( 'cyh_rate_limited', 'تعداد تلاش‌ها زیاد است. کمی بعد دوباره تلاش کنید.', [ 'status' => 429 ] );
	}

	$email = sanitize_email( (string) $request->get_param( 'email' ) );
	$pass  = (string) $request->get_param( 'password' );

	$user = wp_authenticate( $email, $pass );
	if ( is_wp_error( $user ) ) {
		// ⚠️ پیام عمداً مبهم است — نمی‌گوید کدام فیلد اشتباه بود، تا
		// حدس‌زدن ایمیل‌های ثبت‌شده روی سایت ممکن نشود.
		return new WP_Error( 'cyh_bad_login', 'ایمیل یا رمز عبور اشتباه است.', [ 'status' => 401 ] );
	}

	$token = cyh_customer_issue_token( $user->ID );
	return rest_ensure_response(
		[
			'success' => true,
			'token'   => $token,
			'profile' => cyh_customer_profile( $user ),
		]
	);
}

function cyh_rest_account_logout( $request ) {
	$token = cyh_customer_request_token( $request );
	if ( '' !== $token ) {
		cyh_customer_revoke_token( $token );
	}
	return rest_ensure_response( [ 'success' => true ] );
}

/**
 * ⚠️ همیشه پاسخ موفق برمی‌گرداند — چه ایمیل وجود داشته باشد چه نه.
 *
 * برگرداندن خطای «این ایمیل ثبت نیست» یعنی هر کسی می‌تواند با امتحان‌
 * کردن ایمیل‌ها بفهمد کدام‌ها روی سایت حساب دارند (User Enumeration).
 * همان دلیلی که هانی‌پات این پروژه هم به ربات پاسخ موفق جعلی می‌دهد.
 */
function cyh_rest_account_forgot_password( $request ) {
	$ip = cyh_client_ip();
	if ( cyh_is_rate_limited( $ip ) ) {
		return new WP_Error( 'cyh_rate_limited', 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.', [ 'status' => 429 ] );
	}

	$email = sanitize_email( (string) $request->get_param( 'email' ) );
	$user  = is_email( $email ) ? get_user_by( 'email', $email ) : false;

	if ( $user ) {
		$token = bin2hex( wp_generate_password( 64, false, false ) );
		update_user_meta( $user->ID, CYH_RESET_HASH_META, hash( 'sha256', $token ) );
		update_user_meta( $user->ID, CYH_RESET_EXPIRY_META, time() + CYH_PASSWORD_RESET_TTL );

		$reset_url = trailingslashit( cyh_get_frontend_url() ) . 'account/reset-password?email=' . rawurlencode( $email ) . '&token=' . $token;
		wp_mail(
			$email,
			'بازیابی رمز عبور — کرین یدک',
			"برای تعیین رمز تازه، روی لینک زیر بزنید (تا یک ساعت معتبر است):\n\n{$reset_url}\n\nاگر این درخواست را شما نفرستاده‌اید، این پیام را نادیده بگیرید."
		);
	}

	return rest_ensure_response( [ 'success' => true ] );
}

function cyh_rest_account_reset_password( $request ) {
	$ip = cyh_client_ip();
	if ( cyh_is_rate_limited( $ip ) ) {
		return new WP_Error( 'cyh_rate_limited', 'تعداد تلاش‌ها زیاد است. کمی بعد دوباره تلاش کنید.', [ 'status' => 429 ] );
	}

	$email = sanitize_email( (string) $request->get_param( 'email' ) );
	$token = (string) $request->get_param( 'token' );
	$pass  = (string) $request->get_param( 'password' );

	$user = is_email( $email ) ? get_user_by( 'email', $email ) : false;
	if ( ! $user ) {
		return new WP_Error( 'cyh_bad_reset', 'لینک نامعتبر یا منقضی است.', [ 'status' => 400 ] );
	}

	$stored_hash = get_user_meta( $user->ID, CYH_RESET_HASH_META, true );
	$expires     = (int) get_user_meta( $user->ID, CYH_RESET_EXPIRY_META, true );

	if ( '' === $stored_hash || $expires < time() || ! hash_equals( $stored_hash, hash( 'sha256', $token ) ) ) {
		return new WP_Error( 'cyh_bad_reset', 'لینک نامعتبر یا منقضی است.', [ 'status' => 400 ] );
	}
	$pw_problem = cyh_customer_password_problem( $pass, $email );
	if ( null !== $pw_problem ) {
		return new WP_Error( 'cyh_weak_password', $pw_problem, [ 'status' => 400 ] );
	}

	wp_set_password( $pass, $user->ID );
	delete_user_meta( $user->ID, CYH_RESET_HASH_META );
	delete_user_meta( $user->ID, CYH_RESET_EXPIRY_META );
	// ⚠️ تغییر رمز یعنی «همه‌جا خارج شو» — نشست‌های قبلی باطل می‌شوند.
	cyh_customer_revoke_all_tokens( $user->ID );

	return rest_ensure_response( [ 'success' => true ] );
}

function cyh_rest_account_me( $request ) {
	$user_id = cyh_customer_authenticate_request( $request );
	if ( is_wp_error( $user_id ) ) {
		return $user_id;
	}

	/* ⚠️ سفارش‌ها هنوز به حساب وصل نمی‌شوند — ایست ۲ (درگاه پرداخت) که این
	   اتصال را می‌سازد هنوز نوشته نشده. لیست خالی صادقانه است؛ ساختن یک
	   اتصال حدسی (مثلاً تطبیق با شماره تلفن) دقیقاً همان داده‌ی ساختگی‌ای
	   است که قاعده‌ی ۲ پروژه ممنوعش می‌کند. */
	$orders = get_posts(
		[
			'post_type'   => 'cyh_quote',
			'author'      => $user_id,
			'post_status' => 'publish',
			'numberposts' => 50,
		]
	);

	return rest_ensure_response(
		[
			'profile' => cyh_customer_profile( get_userdata( $user_id ) ),
			'orders'  => array_map(
				static function ( $post ) {
					return [
						'code'   => get_post_meta( $post->ID, 'cyh_code', true ),
						'kind'   => get_post_meta( $post->ID, 'cyh_kind', true ) ?: 'quote',
						'status' => get_post_meta( $post->ID, 'cyh_status', true ) ?: 'new',
						'date'   => get_the_date( 'Y-m-d', $post ),
					];
				},
				$orders
			),
		]
	);
}

/* =========================================================================
   ۴) تنظیمات حساب
   ========================================================================= */

/**
 * ویرایش نام، موبایل و شرکت.
 *
 * ⚠️ ایمیل اینجا قابل تغییر نیست — عمدی. ایمیل تنها کانال بازیابی رمز
 * است؛ تغییرش بدون تأیید ایمیل تازه یعنی یک غلط تایپی کاربر را برای
 * همیشه از حسابش بیرون می‌گذارد. تأیید ایمیل (backlog، پیشنهاد ۹) تا
 * راه‌اندازی سایت و داشتن سرویس ایمیل کنار گذاشته شد.
 */
function cyh_rest_account_profile( $request ) {
	$user_id = cyh_customer_authenticate_request( $request );
	if ( is_wp_error( $user_id ) ) {
		return $user_id;
	}

	$name  = sanitize_text_field( (string) $request->get_param( 'name' ) );
	$phone = cyh_to_latin_digits( sanitize_text_field( (string) $request->get_param( 'phone' ) ) );
	$org   = sanitize_text_field( (string) $request->get_param( 'company' ) );

	if ( mb_strlen( $name ) < 2 ) {
		return new WP_Error( 'cyh_bad_name', 'نام را کامل وارد کنید.', [ 'status' => 400 ] );
	}
	if ( '' !== $phone && ! cyh_customer_valid_phone( $phone ) ) {
		return new WP_Error( 'cyh_bad_phone', 'شماره موبایل معتبر نیست.', [ 'status' => 400 ] );
	}

	wp_update_user( [ 'ID' => $user_id, 'display_name' => $name ] );
	// خالی = حذف؛ نه ذخیره‌ی رشته‌ی خالی که بعداً «شماره‌ی ثبت‌شده» به نظر برسد.
	'' !== $phone ? update_user_meta( $user_id, 'cyh_phone', $phone ) : delete_user_meta( $user_id, 'cyh_phone' );
	'' !== $org ? update_user_meta( $user_id, 'cyh_company', $org ) : delete_user_meta( $user_id, 'cyh_company' );

	return rest_ensure_response( [ 'success' => true, 'profile' => cyh_customer_profile( get_userdata( $user_id ) ) ] );
}

/**
 * تغییر رمز با دانستن رمز فعلی.
 *
 * ⚠️ رمز فعلی الزامی است: توکن دزدیده‌شده (مثلاً از مرورگری که کاربر
 * خارج نشده) نباید برای تصاحب دائمی حساب کافی باشد. بعد از تغییر، همه‌ی
 * نشست‌ها باطل و برای همین دستگاه یک توکن تازه صادر می‌شود — کاربری که
 * رمزش را عوض کرده نباید از صفحه‌ای که در آن است بیرون پرت شود.
 */
function cyh_rest_account_change_password( $request ) {
	$user_id = cyh_customer_authenticate_request( $request );
	if ( is_wp_error( $user_id ) ) {
		return $user_id;
	}
	if ( cyh_is_rate_limited( cyh_client_ip() ) ) {
		return new WP_Error( 'cyh_rate_limited', 'تعداد تلاش‌ها زیاد است. کمی بعد دوباره تلاش کنید.', [ 'status' => 429 ] );
	}

	$user    = get_userdata( $user_id );
	$current = (string) $request->get_param( 'current_password' );
	$new     = (string) $request->get_param( 'new_password' );

	if ( is_wp_error( wp_authenticate( $user->user_email, $current ) ) ) {
		return new WP_Error( 'cyh_bad_current_password', 'رمز عبور فعلی اشتباه است.', [ 'status' => 400 ] );
	}
	$pw_problem = cyh_customer_password_problem( $new, $user->user_email );
	if ( null !== $pw_problem ) {
		return new WP_Error( 'cyh_weak_password', $pw_problem, [ 'status' => 400 ] );
	}

	wp_set_password( $new, $user_id );
	cyh_customer_revoke_all_tokens( $user_id );

	return rest_ensure_response( [ 'success' => true, 'token' => cyh_customer_issue_token( $user_id ) ] );
}

/* =========================================================================
   ۵) علاقه‌مندی‌ها
   =========================================================================
   فهرست اسلاگ محصول در متای کاربر. اسلاگ و نه شناسه، چون فرانت‌اند
   استاتیک محصول را با اسلاگ می‌شناسد (همان دلیل productSlug در
   class-questions.php). */
const CYH_WISHLIST_META = 'cyh_wishlist';
const CYH_WISHLIST_MAX  = 100;

/** محصول منتشرشده با این اسلاگ، یا null. */
function cyh_customer_find_product( $slug ) {
	$found = get_posts(
		[
			'post_type'      => 'product',
			'name'           => $slug,
			'post_status'    => 'publish',
			'posts_per_page' => 1,
		]
	);
	return $found ? $found[0] : null;
}

function cyh_customer_wishlist_slugs( $user_id ) {
	$raw = get_user_meta( $user_id, CYH_WISHLIST_META, true );
	return is_array( $raw ) ? array_values( array_filter( $raw, 'is_string' ) ) : [];
}

/**
 * ⚠️ محصولی که بعد از افزوده‌شدن حذف یا پیش‌نویس شده، از خروجی بیرون
 * می‌رود و از متا هم پاک می‌شود — وگرنه فهرست کاربر لینک ۴۰۴ نشان می‌داد.
 */
function cyh_rest_account_wishlist_get( $request ) {
	$user_id = cyh_customer_authenticate_request( $request );
	if ( is_wp_error( $user_id ) ) {
		return $user_id;
	}

	$items = [];
	$alive = [];
	foreach ( cyh_customer_wishlist_slugs( $user_id ) as $slug ) {
		$product = cyh_customer_find_product( $slug );
		if ( $product ) {
			$alive[] = $slug;
			$items[] = [ 'slug' => $slug, 'name' => $product->post_title ];
		}
	}
	update_user_meta( $user_id, CYH_WISHLIST_META, $alive );

	return rest_ensure_response( [ 'items' => $items ] );
}

function cyh_rest_account_wishlist_update( $request ) {
	$user_id = cyh_customer_authenticate_request( $request );
	if ( is_wp_error( $user_id ) ) {
		return $user_id;
	}

	$slug   = sanitize_title( (string) $request->get_param( 'slug' ) );
	$action = (string) $request->get_param( 'action' );
	$slugs  = cyh_customer_wishlist_slugs( $user_id );

	if ( 'add' === $action ) {
		if ( '' === $slug || ! cyh_customer_find_product( $slug ) ) {
			return new WP_Error( 'cyh_bad_product', 'این محصول پیدا نشد.', [ 'status' => 404 ] );
		}
		if ( ! in_array( $slug, $slugs, true ) ) {
			if ( count( $slugs ) >= CYH_WISHLIST_MAX ) {
				return new WP_Error( 'cyh_wishlist_full', 'فهرست علاقه‌مندی‌ها پر است.', [ 'status' => 400 ] );
			}
			$slugs[] = $slug;
		}
	} elseif ( 'remove' === $action ) {
		$slugs = array_values( array_diff( $slugs, [ $slug ] ) );
	} else {
		return new WP_Error( 'cyh_bad_action', 'عملیات نامعتبر.', [ 'status' => 400 ] );
	}

	update_user_meta( $user_id, CYH_WISHLIST_META, $slugs );
	return rest_ensure_response( [ 'success' => true, 'slugs' => $slugs ] );
}

/** آدرس فرانت‌اند Astro — برای ساختن لینک بازیابی رمز در ایمیل. */
function cyh_get_frontend_url() {
	$origins = function_exists( 'cyh_get_allowed_origins' ) ? cyh_get_allowed_origins() : [];
	return $origins[0] ?? 'https://craneyadak.com';
}
