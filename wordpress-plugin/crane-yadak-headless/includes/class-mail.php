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
 * تا HOST/USER/PASS هر سه تعریف نشده‌اند، هیچ‌چیز تغییر نمی‌کند (رفتار قبلی). وضعیت و ارسال آزمایشی:
 * تنظیمات ← ایمیل (SMTP).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const CYH_MAIL_PAGE       = 'cyh-mail';
const CYH_MAIL_LAST_ERROR = 'cyh_mail_last_error';

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

/** علت آخرین شکست ارسال، برای صفحه‌ی وضعیت (بدون رمز: فقط پیام PHPMailer). */
function cyh_mail_failed( $error = null ) {
	$msg = is_object( $error ) && method_exists( $error, 'get_error_message' ) ? (string) $error->get_error_message() : 'نامشخص';
	set_transient( CYH_MAIL_LAST_ERROR, $msg, DAY_IN_SECONDS );
	error_log( 'کرین یدک: ارسال ایمیل شکست خورد — ' . $msg );
}
add_action( 'wp_mail_failed', 'cyh_mail_failed' );

function cyh_register_mail_page() {
	add_options_page( 'ایمیل (SMTP)', 'ایمیل (SMTP)', 'manage_options', CYH_MAIL_PAGE, 'cyh_render_mail_page' );
}
add_action( 'admin_menu', 'cyh_register_mail_page' );

function cyh_render_mail_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$cfg  = cyh_smtp_config();
	$last = get_transient( CYH_MAIL_LAST_ERROR );
	?>
	<div class="wrap">
		<h1>ایمیل (SMTP)</h1>
		<?php if ( null === $cfg ) : ?>
			<div class="notice notice-warning inline"><p>
				<strong>SMTP تنظیم نشده است.</strong> ایمیل‌ها با <code>mail()</code> پیش‌فرض می‌روند و احتمالاً به اسپم می‌افتند.
				ثابت‌های <code>CYH_SMTP_HOST</code>، <code>CYH_SMTP_USER</code> و <code>CYH_SMTP_PASS</code> را در <code>wp-config.php</code> بگذارید
				(راهنما: بالای فایل <code>includes/class-mail.php</code>). رمز عمداً در پایگاه‌داده ذخیره نمی‌شود.
			</p></div>
		<?php else : ?>
			<div class="notice notice-success inline"><p>
				SMTP فعال است: <code dir="ltr"><?php echo esc_html( $cfg['user'] . ' @ ' . $cfg['host'] . ':' . $cfg['port'] . ' (' . $cfg['secure'] . ')' ); ?></code>
			</p></div>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="cyh_mail_test" />
				<?php wp_nonce_field( 'cyh_mail_test' ); ?>
				<p>یک ایمیل آزمایشی به نشانی ایمیل حساب شما فرستاده می‌شود. پس از ارسال، پوشه‌ی «اسپم» را هم نگاه کنید.</p>
				<?php submit_button( 'ارسال ایمیل آزمایشی', 'secondary', 'submit', false ); ?>
			</form>
		<?php endif; ?>
		<?php if ( isset( $_GET['sent'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification ?>
			<?php if ( '1' === $_GET['sent'] ) : // phpcs:ignore WordPress.Security.NonceVerification ?>
				<div class="notice notice-success inline"><p>ارسال شد (به‌معنی تحویل در صندوق نیست؛ صندوق و اسپم را ببینید).</p></div>
			<?php else : ?>
				<div class="notice notice-error inline"><p>ارسال نشد<?php echo $last ? ': ' . esc_html( (string) $last ) : ''; ?></p></div>
			<?php endif; ?>
		<?php endif; ?>
		<h2>پس از اتصال SMTP</h2>
		<p>برای نرسیدن به اسپم، در cPanel ← «Email Deliverability» رکوردهای <strong>SPF</strong> و <strong>DKIM</strong> دامنه باید «Valid» باشند.</p>
	</div>
	<?php
}

function cyh_mail_test_handler() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'دسترسی ندارید.', 403 );
	}
	check_admin_referer( 'cyh_mail_test' );
	delete_transient( CYH_MAIL_LAST_ERROR );
	$user = wp_get_current_user();
	$ok   = wp_mail( (string) $user->user_email, 'آزمایش ایمیل — کرین یدک', 'این یک ایمیل آزمایشی از وردپرس کرین یدک است. اگر این را در صندوق می‌بینید، SMTP درست کار می‌کند.' );
	wp_safe_redirect( add_query_arg( [ 'page' => CYH_MAIL_PAGE, 'sent' => $ok ? '1' : '0' ], admin_url( 'options-general.php' ) ) );
	exit;
}
add_action( 'admin_post_cyh_mail_test', 'cyh_mail_test_handler' );
