<?php
/**
 * خط لوله‌ی دائمی «نام محصول → پیش‌نویس سئو».
 *
 * ---------------------------------------------------------------------------
 * چرا این جایگزین سیدر شد
 *
 * سیدر یک اسکریپت یک‌بارمصرف با محصولات hardcode بود: برای افزودن قلم
 * جدید باید کد PHP ویرایش و افزونه دوباره نصب می‌شد. این یعنی مدیر محتوا
 * برای هر محصول به یک برنامه‌نویس نیاز داشت. فایل سیدر حذف شد.
 *
 * این سیستم دائمی است: نام محصولات در پنل وارد می‌شود، پیش‌نویس‌ها ساخته
 * می‌شوند، و صف در پس‌زمینه محتوا تولید می‌کند. برای همیشه قابل استفاده.
 *
 * ---------------------------------------------------------------------------
 * چرا صف (queue) و نه پردازش مستقیم
 *
 * هر فراخوانی مدل زبانی ۲۰ تا ۶۰ ثانیه طول می‌کشد. برای ۲۲ محصول یعنی تا
 * ۲۰ دقیقه — که بسیار فراتر از `max_execution_time` هر هاست اشتراکی است.
 * پردازش مستقیم یعنی تایم‌اوت، نیمه‌کاره ماندن، و رکوردهای خراب.
 *
 * پس: درج پیش‌نویس‌ها آنی است (سریع)، و تولید محتوا در صف WP-Cron یکی‌یکی
 * انجام می‌شود. مدیر می‌تواند پنجره را ببندد.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ ایمنی داده — همان قواعد سخت‌گیرانه
 *
 * ۱) خروجی همیشه `draft` است. قفل `CYH_AI_GENERATING` در class-ai-draft.php
 *    روی `wp_insert_post_data` هر تلاش انتشار را به پیش‌نویس برمی‌گرداند.
 * ۲) پرامپت صراحتاً ورود عدد، تلورانس، ابعاد و کد معادل OEM را ممنوع
 *    می‌کند و به‌جایش `[[نیازمند تایید فنی]]` می‌خواهد.
 * ۳) کد فنی (SKU) هرگز توسط مدل ساخته نمی‌شود — فیلد خالی می‌ماند تا
 *    کارشناس از روی کاتالوگ وارد کند.
 *
 * دلیل بند ۳ حیاتی است: مدل زبانی یک کد معادلِ روان و قانع‌کننده تولید
 * می‌کند که ممکن است وجود نداشته باشد. مهندسی که بر اساس آن قطعه سفارش
 * می‌دهد، قطعه‌ی اشتباه را روی جرثقیلِ در حال کار نصب می‌کند.
 * ---------------------------------------------------------------------------
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const CYH_AI_QUEUE_OPTION = 'cyh_ai_queue';
const CYH_AI_CRON_HOOK    = 'cyh_ai_process_queue';
const CYH_AI_STATUS_META  = '_cyh_ai_status';

/* =========================================================================
   تشخیص خودکار برند و دسته از روی نام محصول
   =========================================================================
   نام‌هایی مثل «بالابر زنجیری برقی دماگ مدل DK» هم برند و هم دسته را در
   خود دارند. استخراج آن‌ها یعنی مدیر محتوا لازم نیست برای ۲۲ محصول
   دستی تاکسونومی انتخاب کند.

   ⚠️ این حدس است، نه قطعیت — به همین دلیل نتیجه در یادداشت پیش‌نویس
   ثبت می‌شود تا کارشناس تاییدش کند، و هرگز روی محصول منتشرشده اعمال
   نمی‌شود.
   ========================================================================= */
function cyh_ai_guess_brand( $title ) {
	$map = [
		'دماگ'    => 'demag',
		'demag'   => 'demag',
		'اشتال'   => 'stahl',
		'stahl'   => 'stahl',
		'پودم'    => 'podem',
		'podem'   => 'podem',
		'ساگا'    => 'saga',
		'saga'    => 'saga',
		'تله‌کرین' => 'telecrane',
		'telecrane' => 'telecrane',
		'sew'     => 'sew',
		'اس ای دبلیو' => 'sew',
		'شنایدر'  => 'schneider',
		'schneider' => 'schneider',
		'تویو'    => 'toyo',
		'toyo'    => 'toyo',
		'سامسونگ' => 'samsung',
		'samsung' => 'samsung',
		'کنترل پرو' => 'controlpro',
		'controlpro' => 'controlpro',
	];

	$haystack = mb_strtolower( $title );
	foreach ( $map as $needle => $slug ) {
		if ( false !== mb_strpos( $haystack, mb_strtolower( $needle ) ) ) {
			return $slug;
		}
	}
	return '';
}

function cyh_ai_guess_category( $title ) {
	// ترتیب مهم است: عبارت بلندتر و دقیق‌تر اول بررسی می‌شود.
	$map = [
		'بالابر زنجیری'   => 'electric-chain-hoist',
		'زنجیری برقی'     => 'electric-chain-hoist',
		// ترتیب کلمات در فارسی آزاد است: «برقی زنجیری» هم رایج است و
		// بدون این ردیف، «بالابر برقی زنجیری تویو» تشخیص داده نمی‌شد.
		'برقی زنجیری'     => 'electric-chain-hoist',
		'بالابر سیم‌بکسلی' => 'wire-rope-hoist',
		'سیم بکسلی'       => 'wire-rope-hoist',
		'ریموت کنترل'     => 'remote-control',
		'کمربند'          => 'rope-guide',
		'روپ گاید'        => 'rope-guide',
		'کوپلینگ'         => 'crane-coupling',
		'اینورتر'         => 'inverter',
		'جاروبک'          => 'current-collector',
		'لنت ترمز'        => 'brake-wheel-disc',
		'دیسک ترمز'       => 'brake-wheel-disc',
		'مگنت ترمز'       => 'brake-magnet',
		'رکتی فایر'       => 'rectifier',
		'رکتیفایر'        => 'rectifier',
		'ویل بلاک'        => 'crane-wheel',
		'چرخ ترولی'       => 'crane-wheel',
		'چرخ'             => 'crane-wheel',
		'قرقره'           => 'wire-rope',
		'قلاب'            => 'crane-hook',
		'کنترل پرو'       => 'control-switch',
		'کلید فرمان'      => 'control-switch',
		'کنتاکتور'        => 'contactor',
		'لیمیت سوئیچ'     => 'microswitch',
		'میکروسوئیچ'      => 'microswitch',
		'بیرینگ'          => 'bearing',
		'شین'             => 'busbar-power-line',
		'درام'            => 'crane-drum',
		'گیربکس'          => 'gearbox-motor',
	];

	$haystack = mb_strtolower( $title );
	foreach ( $map as $needle => $slug ) {
		if ( false !== mb_strpos( $haystack, mb_strtolower( $needle ) ) ) {
			return $slug;
		}
	}
	return '';
}

/* =========================================================================
   ایجاد پیش‌نویس‌ها + صف‌بندی
   ========================================================================= */

/**
 * از یک فهرست نام، پیش‌نویس می‌سازد و برای تولید محتوا صف می‌کند.
 *
 * @param string[] $titles نام محصولات، هر کدام در یک خط.
 * @return array{created:int,skipped:int,ids:int[]}
 */
function cyh_ai_create_drafts( array $titles ) {
	$created = 0;
	$skipped = 0;
	$ids     = [];

	foreach ( $titles as $raw ) {
		$title = sanitize_text_field( trim( $raw ) );
		if ( mb_strlen( $title ) < 3 ) {
			continue;
		}

		// تکراری‌نویسی ممنوع: اگر محصولی با همین عنوان هست، رد شو.
		$existing = get_posts( [
			'post_type'      => 'product',
			'post_status'    => [ 'publish', 'draft', 'pending', 'private' ],
			'title'          => $title,
			'posts_per_page' => 1,
			'fields'         => 'ids',
		] );
		if ( ! empty( $existing ) ) {
			$skipped++;
			continue;
		}

		$brand    = cyh_ai_guess_brand( $title );
		$category = cyh_ai_guess_category( $title );

		$post_id = wp_insert_post( [
			'post_type'   => 'product',
			'post_status' => 'draft',   // همیشه پیش‌نویس
			'post_title'  => $title,
		] );

		if ( is_wp_error( $post_id ) || ! $post_id ) {
			continue;
		}

		// دسته‌بندی حدس‌زده‌شده — فقط اگر ترم واقعاً وجود داشته باشد.
		if ( $category ) {
			$term = get_term_by( 'slug', $category, 'crane_category' );
			if ( $term && ! is_wp_error( $term ) ) {
				wp_set_object_terms( $post_id, [ (int) $term->term_id ], 'crane_category' );
			}
		}

		update_post_meta( $post_id, CYH_AI_STATUS_META, 'queued' );
		update_post_meta( $post_id, '_cyh_ai_guess', wp_json_encode( [
			'brand'    => $brand,
			'category' => $category,
		] ) );

		$ids[] = $post_id;
		$created++;
	}

	if ( $ids ) {
		$queue = get_option( CYH_AI_QUEUE_OPTION, [] );
		$queue = array_values( array_unique( array_merge( is_array( $queue ) ? $queue : [], $ids ) ) );
		update_option( CYH_AI_QUEUE_OPTION, $queue, false );
		cyh_ai_schedule_queue();
	}

	return [ 'created' => $created, 'skipped' => $skipped, 'ids' => $ids ];
}

/** زمان‌بندی پردازش صف. */
function cyh_ai_schedule_queue() {
	if ( ! wp_next_scheduled( CYH_AI_CRON_HOOK ) ) {
		// یک دقیقه بعد — نه فوری، تا پاسخ درخواست جاری بلوکه نشود.
		wp_schedule_single_event( time() + 60, CYH_AI_CRON_HOOK );
	}
}

/**
 * پردازش صف — هر بار فقط **یک** محصول.
 *
 * چرا یکی: هر فراخوانی مدل ممکن است تا ۶۰ ثانیه طول بکشد. پردازش چند
 * مورد در یک اجرای کرون، دقیقاً همان تایم‌اوتی را می‌سازد که این معماری
 * برای اجتناب از آن ساخته شده. یک مورد در هر اجرا، کند اما قطعی است.
 */
function cyh_ai_process_queue() {
	$queue = get_option( CYH_AI_QUEUE_OPTION, [] );
	if ( ! is_array( $queue ) || empty( $queue ) ) {
		return;
	}

	$post_id = (int) array_shift( $queue );
	update_option( CYH_AI_QUEUE_OPTION, $queue, false );

	if ( $post_id && get_post( $post_id ) ) {
		update_post_meta( $post_id, CYH_AI_STATUS_META, 'running' );

		$result = cyh_ai_generate_for_post( $post_id );

		if ( is_wp_error( $result ) ) {
			update_post_meta( $post_id, CYH_AI_STATUS_META, 'failed' );
			update_post_meta( $post_id, '_cyh_ai_error', $result->get_error_message() );
		} else {
			update_post_meta( $post_id, CYH_AI_STATUS_META, 'done' );
			delete_post_meta( $post_id, '_cyh_ai_error' );
		}
	}

	// اگر چیزی مانده، دوباره زمان‌بندی کن.
	if ( ! empty( get_option( CYH_AI_QUEUE_OPTION, [] ) ) ) {
		wp_schedule_single_event( time() + 30, CYH_AI_CRON_HOOK );
	}
}
add_action( CYH_AI_CRON_HOOK, 'cyh_ai_process_queue' );

/* =========================================================================
   رابط کاربری پنل
   ========================================================================= */
function cyh_ai_bulk_menu() {
	add_submenu_page(
		'edit.php?post_type=product',
		'تولید انبوه محتوا',
		'تولید انبوه محتوا',
		'edit_posts',
		'cyh-ai-bulk',
		'cyh_ai_bulk_page'
	);
}
add_action( 'admin_menu', 'cyh_ai_bulk_menu' );

function cyh_ai_bulk_page() {
	$has_key = '' !== trim( (string) get_option( CYH_AI_KEY_OPTION, '' ) );
	$queue   = get_option( CYH_AI_QUEUE_OPTION, [] );
	$pending = is_array( $queue ) ? count( $queue ) : 0;

	$recent = get_posts( [
		'post_type'      => 'product',
		'post_status'    => [ 'draft', 'pending' ],
		'posts_per_page' => 30,
		'meta_key'       => CYH_AI_STATUS_META,
		'orderby'        => 'date',
		'order'          => 'DESC',
	] );

	echo '<div class="wrap">';
	echo '<h1>تولید انبوه محتوای سئو</h1>';

	echo '<div style="background:#fff8e5;border-right:4px solid #dba617;padding:12px 16px;margin:16px 0;max-width:820px">';
	echo '<p style="margin:0 0 8px"><strong>این سیستم هرگز چیزی منتشر نمی‌کند.</strong> همه‌ی خروجی‌ها پیش‌نویس‌اند.</p>';
	echo '<p style="margin:0">مدل زبانی <strong>هیچ عدد، تلورانس، ابعاد یا کد معادل OEM تولید نمی‌کند</strong>. هرجا داده لازم باشد، عبارت <code>[[نیازمند تایید فنی]]</code> می‌گذارد تا کارشناس از روی کاتالوگ سازنده پرش کند. کد فنی (SKU) هم عمداً خالی می‌ماند.</p>';
	echo '</div>';

	if ( ! $has_key ) {
		echo '<div class="notice notice-error"><p>کلید API ثبت نشده است. ابتدا آن را در تنظیمات افزونه وارد کنید.</p></div>';
	}

	if ( $pending > 0 ) {
		printf(
			'<div class="notice notice-info"><p><strong>%d محصول در صف پردازش است.</strong> هر ۳۰ ثانیه یک مورد پردازش می‌شود. می‌توانید این صفحه را ببندید.</p></div>',
			$pending
		);
	}

	$nonce = wp_nonce_field( 'cyh_ai_bulk', '_wpnonce', true, false );
	echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="max-width:820px">';
	echo '<input type="hidden" name="action" value="cyh_ai_bulk_submit">';
	echo $nonce;
	echo '<p><label for="cyh_titles"><strong>نام محصولات — هر کدام در یک خط</strong></label></p>';
	echo '<textarea id="cyh_titles" name="titles" rows="12" style="width:100%;font-family:monospace;line-height:2" placeholder="بالابر زنجیری برقی دماگ مدل DK&#10;ریموت کنترل ساگا | SAGA-L6B&#10;..."></textarea>';
	echo '<p class="description">برند و دسته‌بندی به‌صورت خودکار از روی نام حدس زده می‌شوند. این حدس در پیش‌نویس ثبت می‌شود و باید توسط کارشناس تایید شود.</p>';
	submit_button( 'ساخت پیش‌نویس و افزودن به صف', 'primary', 'submit', true, $has_key ? [] : [ 'disabled' => 'disabled' ] );
	echo '</form>';

	if ( $recent ) {
		echo '<h2 style="margin-top:32px">وضعیت پیش‌نویس‌ها</h2>';
		echo '<table class="wp-list-table widefat fixed striped" style="max-width:820px"><thead><tr>';
		echo '<th>محصول</th><th style="width:120px">وضعیت</th><th style="width:180px">دسته حدس‌زده‌شده</th>';
		echo '</tr></thead><tbody>';

		$labels = [
			'queued'  => [ 'در صف', '#646970' ],
			'running' => [ 'در حال تولید', '#2271b1' ],
			'done'    => [ 'آماده بازبینی', '#00a32a' ],
			'failed'  => [ 'ناموفق', '#d63638' ],
		];

		foreach ( $recent as $post ) {
			$status = get_post_meta( $post->ID, CYH_AI_STATUS_META, true );
			$guess  = json_decode( (string) get_post_meta( $post->ID, '_cyh_ai_guess', true ), true );
			list( $label, $color ) = $labels[ $status ] ?? [ $status, '#646970' ];

			printf(
				'<tr><td><a href="%s"><strong>%s</strong></a></td><td><span style="color:%s;font-weight:700">%s</span>%s</td><td>%s</td></tr>',
				esc_url( get_edit_post_link( $post->ID ) ),
				esc_html( $post->post_title ),
				esc_attr( $color ),
				esc_html( $label ),
				'failed' === $status
					? '<br><small>' . esc_html( (string) get_post_meta( $post->ID, '_cyh_ai_error', true ) ) . '</small>'
					: '',
				esc_html( $guess['category'] ?? '—' )
			);
		}
		echo '</tbody></table>';
	}

	echo '</div>';
}

/** هندلر ارسال فرم. */
function cyh_ai_bulk_submit() {
	if ( ! current_user_can( 'edit_posts' ) ) {
		wp_die( 'دسترسی مجاز نیست.' );
	}
	check_admin_referer( 'cyh_ai_bulk' );

	$raw    = isset( $_POST['titles'] ) ? wp_unslash( $_POST['titles'] ) : '';
	$titles = preg_split( '/\r\n|\r|\n/', (string) $raw );
	$result = cyh_ai_create_drafts( is_array( $titles ) ? $titles : [] );

	wp_safe_redirect( add_query_arg(
		[
			'post_type'   => 'product',
			'page'        => 'cyh-ai-bulk',
			'cyh_created' => $result['created'],
			'cyh_skipped' => $result['skipped'],
		],
		admin_url( 'edit.php' )
	) );
	exit;
}
add_action( 'admin_post_cyh_ai_bulk_submit', 'cyh_ai_bulk_submit' );

/** اعلان نتیجه. */
function cyh_ai_bulk_notice() {
	if ( ! isset( $_GET['cyh_created'] ) ) {
		return;
	}
	printf(
		'<div class="notice notice-success is-dismissible"><p><strong>%d پیش‌نویس ساخته و به صف اضافه شد.</strong>%s</p></div>',
		(int) $_GET['cyh_created'],
		isset( $_GET['cyh_skipped'] ) && (int) $_GET['cyh_skipped'] > 0
			? sprintf( ' %d مورد به‌دلیل تکراری بودن رد شد.', (int) $_GET['cyh_skipped'] )
			: ''
	);
}
add_action( 'admin_notices', 'cyh_ai_bulk_notice' );

/** پاک‌سازی کرون هنگام غیرفعال‌سازی. */
function cyh_ai_clear_queue_cron() {
	wp_clear_scheduled_hook( CYH_AI_CRON_HOOK );
}
