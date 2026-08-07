<?php
/**
 * صفحه‌ی تنظیمات پنل ادمین: آدرس ایمیل دریافت لید + دامنه‌های مجاز CORS.
 *
 * چرا یک صفحه‌ی تنظیمات جدا از ACF Options Page؟ چون این دو مقدار
 * (ایمیل اعلان + دامنه‌های CORS) کاملاً به «پیکربندی زیرساخت» مربوط‌اند نه
 * «محتوای سایت»؛ مخلوط کردن آن‌ها با فیلدهای محتوایی ACF (که در
 * acf-json/group_site_options.json تعریف شده) هم برای تیم محتوا گیج‌کننده
 * است و هم مسئولیت‌ها را نامشخص می‌کند.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function cyh_register_settings_page() {
	add_options_page(
		'تنظیمات کرین یدک Headless',
		'کرین یدک Headless',
		'manage_options',
		'crane-yadak-headless',
		'cyh_render_settings_page'
	);
}
add_action( 'admin_menu', 'cyh_register_settings_page' );

function cyh_register_settings() {
	register_setting( 'cyh_settings_group', 'cyh_notification_email', [ 'sanitize_callback' => 'sanitize_email' ] );
	register_setting( 'cyh_settings_group', 'cyh_allowed_origins', [ 'sanitize_callback' => 'sanitize_textarea_field' ] );
	register_setting( 'cyh_settings_group', 'cyh_trust_proxy_headers', [ 'sanitize_callback' => 'rest_sanitize_boolean', 'default' => false ] );
	register_setting( 'cyh_settings_group', 'cyh_deploy_hook_enabled', [ 'sanitize_callback' => 'rest_sanitize_boolean', 'default' => false ] );
	register_setting( 'cyh_settings_group', 'cyh_deploy_hook_url', [ 'sanitize_callback' => 'esc_url_raw' ] );
}
add_action( 'admin_init', 'cyh_register_settings' );

/**
 * دکمه‌ی «همین حالا دیپلوی کن» — برای مواقعی که مشتری غیرفنی می‌خواهد
 * مطمئن شود سایت زنده به‌روز است، بدون نیاز به منتظر ماندن برای ویرایش
 * بعدی یک پست (که وبهوک را خودکار فعال می‌کند).
 */
function cyh_handle_manual_deploy_trigger() {
	if ( ! isset( $_POST['cyh_manual_deploy_nonce'] ) || ! wp_verify_nonce( $_POST['cyh_manual_deploy_nonce'], 'cyh_manual_deploy' ) ) {
		return;
	}

	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	if ( isset( $_POST['cyh_trigger_deploy_now'] ) ) {
		cyh_execute_deploy_webhook(); // تعریف در includes/class-deploy-webhook.php
		add_action(
			'admin_notices',
			function () {
				echo '<div class="notice notice-success"><p>درخواست دیپلوی ارسال شد. معمولاً ۱ تا ۲ دقیقه طول می‌کشد تا سایت زنده به‌روز شود.</p></div>';
			}
		);
	}
}
add_action( 'admin_init', 'cyh_handle_manual_deploy_trigger' );

function cyh_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
	<div class="wrap">
		<h1>تنظیمات کرین یدک — بک‌اند Headless</h1>
		<form method="post" action="options.php">
			<?php settings_fields( 'cyh_settings_group' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="cyh_notification_email">ایمیل دریافت درخواست‌های استعلام</label></th>
					<td>
						<input type="email" id="cyh_notification_email" name="cyh_notification_email"
							value="<?php echo esc_attr( get_option( 'cyh_notification_email', get_option( 'admin_email' ) ) ); ?>"
							class="regular-text" />
						<p class="description">در صورت خالی بودن، از ایمیل مدیر سایت استفاده می‌شود. توجه: حتی اگر ارسال ایمیل با خطا مواجه شود، درخواست در بخش «درخواست‌های استعلام» ذخیره می‌ماند.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="cyh_allowed_origins">دامنه‌های مجاز (CORS)</label></th>
					<td>
						<textarea id="cyh_allowed_origins" name="cyh_allowed_origins" rows="5" class="large-text code"
							placeholder="https://craneyadak.com"><?php echo esc_textarea( get_option( 'cyh_allowed_origins', '' ) ); ?></textarea>
						<p class="description">هر دامنه در یک خط، بدون اسلش انتهایی. اگر خالی بماند، از مقادیر پیش‌فرض (craneyadak.com + لوکال‌هاست توسعه) استفاده می‌شود.</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="cyh_trust_proxy_headers">پشت CDN/پراکسی معتمد هستم (مثل کلودفلر)</label></th>
					<td>
						<label>
							<input type="checkbox" id="cyh_trust_proxy_headers" name="cyh_trust_proxy_headers" value="1"
								<?php checked( get_option( 'cyh_trust_proxy_headers', false ) ); ?> />
							بله، این وردپرس پشت یک CDN/پراکسی معتمد قرار دارد
						</label>
						<p class="description">
							⚠️ فقط در صورتی فعال کنید که مطمئنید سایت واقعاً پشت یک سرویس مثل کلودفلر است.
							این تنظیم مشخص می‌کند سیستم محدودیت نرخ درخواست (Rate Limiting) فرم تماس، آدرس IP
							واقعی کاربر را از کجا بخواند. اگر این گزینه را اشتباهاً فعال کنید در حالی که سایت
							پشت هیچ CDN‌ای نیست، هرکسی می‌تواند با جعل هدر IP، محدودیت ضداسپم را کاملاً دور بزند.
							پیش‌فرض امن (غیرفعال) برای اکثر هاست‌های اشتراکی cPanel صحیح است.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="cyh_deploy_hook_enabled">انتشار خودکار سایت (Auto-Deploy)</label></th>
					<td>
						<label>
							<input type="checkbox" id="cyh_deploy_hook_enabled" name="cyh_deploy_hook_enabled" value="1"
								<?php checked( get_option( 'cyh_deploy_hook_enabled', false ) ); ?> />
							فعال باشد: بعد از هر انتشار/ویرایش محصول، برند، صنعت، سند فنی یا مقاله، سایت زنده به‌صورت خودکار به‌روزرسانی شود
						</label>
						<p class="description">
							این گزینه دقیقاً همان چیزی است که به شما اجازه می‌دهد بدون دانش کدنویسی، محتوا اضافه/ویرایش کنید و
							سایت زنده خودش را در عرض ۱ تا ۲ دقیقه به‌روز کند. برای فعال‌سازی، ابتدا آدرس Deploy Hook زیر را
							از پنل میزبان فرانت‌اند (Cloudflare Pages یا Netlify) وارد کنید.
						</p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="cyh_deploy_hook_url">آدرس Deploy Hook</label></th>
					<td>
						<input type="url" id="cyh_deploy_hook_url" name="cyh_deploy_hook_url"
							value="<?php echo esc_attr( get_option( 'cyh_deploy_hook_url', '' ) ); ?>"
							class="regular-text code" placeholder="https://api.cloudflare.com/... یا https://api.netlify.com/build_hooks/..." />
						<p class="description">
							این آدرس را از تنظیمات فرانت‌اند (Cloudflare Pages ← Settings ← Builds ← Deploy Hooks، یا
							Netlify ← Site Settings ← Build & Deploy ← Build Hooks) کپی کنید. این یک آدرس محرمانه است —
							هرکسی که آن را داشته باشد می‌تواند دیپلوی سایت شما را فعال کند، پس آن را در جای عمومی
							(مثل چت یا ایمیل باز) به اشتراک نگذارید.
						</p>
						<?php
						$last_triggered = get_option( 'cyh_deploy_last_triggered', '' );
						$last_error     = get_option( 'cyh_deploy_last_error', '' );
						?>
						<?php if ( $last_triggered ) : ?>
							<p class="description">
								<strong>آخرین تلاش برای دیپلوی:</strong> <?php echo esc_html( $last_triggered ); ?>
								<?php if ( $last_error ) : ?>
									— <span style="color:#d63638;">خطا: <?php echo esc_html( $last_error ); ?></span>
								<?php else : ?>
									— <span style="color:#00a32a;">با موفقیت ارسال شد ✓</span>
								<?php endif; ?>
							</p>
						<?php endif; ?>
					</td>
				</tr>
			</table>
			<?php submit_button( 'ذخیره تنظیمات' ); ?>
		</form>

		<?php if ( get_option( 'cyh_deploy_hook_url', '' ) ) : ?>
			<hr />
			<h2>دیپلوی دستی</h2>
			<p>اگر می‌خواهید همین الان (بدون ویرایش هیچ محتوایی) سایت را دوباره منتشر کنید:</p>
			<form method="post">
				<?php wp_nonce_field( 'cyh_manual_deploy', 'cyh_manual_deploy_nonce' ); ?>
				<button type="submit" name="cyh_trigger_deploy_now" value="1" class="button button-secondary">
					همین حالا دیپلوی کن
				</button>
			</form>
		<?php endif; ?>
	</div>
	<?php
}
