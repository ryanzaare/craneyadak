<?php
/**
 * ارسال ایمیل از راه SMTP (info@craneyadak.com)
 *
 * چرا لازم شد: وردپرس پیش‌فرض با `mail()` خود PHP می‌فرستد؛ پیام بدون احراز هویت از سرور اشتراکی
 * خارج می‌شود، SPF/DKIM را نمی‌گیرد و بیشتر وقت‌ها به «اسپم» می‌رود — ایمیل بازیابی رمز، تأیید سفارش و
 * اعلان پرداخت (کل ارزش این پیام‌ها همین است که دیده شوند).
 *
 * ⚠️ رمز SMTP در پایگاه‌داده نمی‌نشیند. فقط ثابت‌های `wp-config.php` خوانده می‌شود:
 *
 *   define( 'CYH_SMTP_HOST',   'mail.craneyadak.com' );   // میزبان SMTP از cPanel ← Email Accounts ← Connect Devices
 *   define( 'CYH_SMTP_PORT',   465 );                     // 465 = ssl ، 587 = tls
 *   define( 'CYH_SMTP_SECURE', 'ssl' );                   // 'ssl' | 'tls'
 *   define( 'CYH_SMTP_USER',   'info@craneyadak.com' );
 *   define( 'CYH_SMTP_PASS',   '…' );
 *   define( 'CYH_MAIL_FROM_NAME', 'کرین یدک' );           // اختیاری
 *
 * تا HOST/USER/PASS هر سه تعریف نشده‌اند، هیچ‌چیز تغییر نمی‌کند (رفتار قبلی).
 * برای نرسیدن به اسپم: cPanel ← Email Deliverability ← SPF و DKIM باید Valid باشند.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * تنظیمات SMTP یا null اگر کامل نیست.
 * ⚠️ «کامل» یعنی هر سه (HOST، USER، PASS) غیرخالی. نیمه‌تنظیم (مثلاً بدون رمز) باید مثل «تنظیم‌نشده» رفتار کند،
 * نه اینکه هر ایمیل را با خطای احراز هویت از دست بدهد.
 */
function cyh_smtp_config() {
	$host = defined( 'CYH_SMTP_HOST' ) ? trim( (string) CYH_SMTP_HOST ) : '';
	$user = defined( 'CYH_SMTP_USER' ) ? trim( (string) CYH_SMTP_USER ) : '';
	$pass = defined( 'CYH_SMTP_PASS' ) ? (string) CYH_SMTP_PASS : '';
	if ( '' === $host || '' === $user || '' === $pass ) {
		return null;
	}
	$port   = defined( 'CYH_SMTP_PORT' ) ? (int) CYH_SMTP_PORT : 465;
	$secure = defined( 'CYH_SMTP_SECURE' ) ? strtolower( trim( (string) CYH_SMTP_SECURE ) ) : ( 587 === $port ? 'tls' : 'ssl' );
	if ( ! in_array( $secure, [ 'ssl', 'tls' ], true ) ) {
		$secure = 'ssl';
	}
	return [
		'host'      => $host,
		'port'      => $port > 0 ? $port : 465,
		'secure'    => $secure,
		'user'      => $user,
		'pass'      => $pass,
		'from'      => defined( 'CYH_MAIL_FROM' ) && is_email( (string) CYH_MAIL_FROM ) ? (string) CYH_MAIL_FROM : $user,
		'from_name' => defined( 'CYH_MAIL_FROM_NAME' ) && '' !== trim( (string) CYH_MAIL_FROM_NAME ) ? trim( (string) CYH_MAIL_FROM_NAME ) : 'کرین یدک',
	];
}

/** هر پارامتر پیش‌فرض دارد: وردپرس گاهی بدون آرگومان صدا می‌زند و PHP 8 وگرنه fatal می‌دهد. */
function cyh_smtp_apply( $phpmailer = null ) {
	$cfg = cyh_smtp_config();
	if ( null === $cfg || ! is_object( $phpmailer ) ) {
		return;
	}
	$phpmailer->isSMTP();
	$phpmailer->Host       = $cfg['host'];
	$phpmailer->Port       = $cfg['port'];
	$phpmailer->SMTPAuth   = true;
	$phpmailer->Username   = $cfg['user'];
	$phpmailer->Password   = $cfg['pass'];
	$phpmailer->SMTPSecure = $cfg['secure'];
	$phpmailer->CharSet    = 'UTF-8';
	// ⚠️ فرستنده‌ی همان صندوقی که احراز هویت می‌شود؛ دامنه‌ی متفاوت = رد شدن در SPF/DMARC.
	$phpmailer->Sender = $cfg['from'];
}
add_action( 'phpmailer_init', 'cyh_smtp_apply' );

function cyh_smtp_from( $from = '' ) {
	$cfg = cyh_smtp_config();
	return null === $cfg ? $from : $cfg['from'];
}
add_filter( 'wp_mail_from', 'cyh_smtp_from' );

function cyh_smtp_from_name( $name = '' ) {
	$cfg = cyh_smtp_config();
	return null === $cfg ? $name : $cfg['from_name'];
}
add_filter( 'wp_mail_from_name', 'cyh_smtp_from_name' );

/** شکست ارسال فقط در لاگ سرور (debug.log) ثبت می‌شود؛ رمز در پیام PHPMailer نیست. */
function cyh_mail_failed( $error = null ) {
	$msg = is_object( $error ) && method_exists( $error, 'get_error_message' ) ? (string) $error->get_error_message() : 'نامشخص';
	error_log( 'کرین یدک: ارسال ایمیل شکست خورد — ' . $msg );
}
add_action( 'wp_mail_failed', 'cyh_mail_failed' );
