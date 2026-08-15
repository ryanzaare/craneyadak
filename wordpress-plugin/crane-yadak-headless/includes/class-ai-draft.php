<?php
/**
 * خط لوله‌ی «هوش مصنوعی → پیش‌نویس».
 *
 * ---------------------------------------------------------------------------
 * تضمین بنیادی: این کد هرگز چیزی منتشر نمی‌کند.
 *
 * این ادعا با «یادمان باشد» تضمین نشده، بلکه ساختاری است:
 *   • خروجی همیشه در یک *بازبینی* (post revision) جدا ذخیره می‌شود، نه در
 *     خودِ پست منتشرشده. یعنی حتی محتوای فعلی صفحه هم بازنویسی نمی‌شود.
 *   • برای محصول منتشرنشده، وضعیت روی 'draft' قفل است.
 *   • تابع `cyh_ai_guard_never_publish()` روی فیلتر `wp_insert_post_data`
 *     می‌نشیند و هر تلاشی برای انتشار در جریان این عملیات را به 'draft'
 *     برمی‌گرداند — حتی اگر کد بالادستی اشتباه کند.
 *
 * چرا این‌قدر سخت‌گیرانه: محتوای فنی قطعه‌ی جرثقیل شامل عدد، تلورانس و
 * کد معادل است. یک مدل زبانی این‌ها را روان و قانع‌کننده تولید می‌کند بدون
 * آن‌که درست باشند. انتشار خودکار چنین متنی یعنی انتشار مشخصات فنی
 * اختراعی روی قطعه‌ای که بار چندتنی را نگه می‌دارد. بازبینی انسانی اینجا
 * یک مرحله‌ی اضافه نیست؛ تنها چیزی است که این کار را قابل‌دفاع می‌کند.
 * ---------------------------------------------------------------------------
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** نام گزینه‌هایی که کلید و ارائه‌دهنده در آن ذخیره می‌شوند. */
const CYH_AI_PROVIDER_OPTION = 'cyh_ai_provider';
const CYH_AI_KEY_OPTION      = 'cyh_ai_api_key';
const CYH_AI_MODEL_OPTION    = 'cyh_ai_model';

/** متای ثبت آخرین تولید — برای نمایش در پنل. */
const CYH_AI_LAST_RUN_META = '_cyh_ai_last_run';

/**
 * قفل ایمنی سراسری.
 *
 * وقتی `true` باشد، هیچ پستی در جریان این درخواست نمی‌تواند منتشر شود.
 * روی فیلتر داده‌ی درج پست می‌نشیند، یعنی *آخرین* نقطه‌ی ممکن پیش از
 * نوشتن در دیتابیس. حتی اگر کدی بالاتر اشتباهاً 'publish' بفرستد،
 * اینجا به 'draft' برمی‌گردد.
 */
function cyh_ai_guard_never_publish( $data, $postarr ) {
	if ( ! defined( 'CYH_AI_GENERATING' ) || ! CYH_AI_GENERATING ) {
		return $data;
	}

	$blocked = [ 'publish', 'future', 'private' ];
	if ( in_array( $data['post_status'], $blocked, true ) ) {
		$data['post_status'] = 'draft';
	}

	return $data;
}
add_filter( 'wp_insert_post_data', 'cyh_ai_guard_never_publish', 999, 2 );

/**
 * ساخت پرامپت از داده‌ی واقعی محصول.
 *
 * نکته‌ی مهم: پرامپت صراحتاً از مدل می‌خواهد هیچ عدد، تلورانس یا کد
 * معادلی *اختراع* نکند و هرجا داده ندارد، جای خالی علامت‌دار بگذارد.
 * این تنها راه استفاده‌ی مسئولانه از مدل زبانی برای محتوای فنی است.
 */
function cyh_ai_build_prompt( $post_id ) {
	$title = get_the_title( $post_id );
	$sku   = function_exists( 'get_field' ) ? (string) get_field( 'sku', $post_id ) : '';

	$categories = wp_get_post_terms( $post_id, 'crane_category', [ 'fields' => 'names' ] );
	$category   = ( ! is_wp_error( $categories ) && ! empty( $categories ) ) ? $categories[0] : '';

	$specs_text = '';
	if ( function_exists( 'get_field' ) ) {
		$specs = get_field( 'technical_specs', $post_id );
		if ( is_array( $specs ) ) {
			foreach ( $specs as $row ) {
				$label = isset( $row['spec_label'] ) ? $row['spec_label'] : '';
				$value = isset( $row['spec_value'] ) ? $row['spec_value'] : '';
				if ( $label && $value ) {
					$specs_text .= "- {$label}: {$value}\n";
				}
			}
		}
	}

	return "شما یک نویسنده‌ی فنی ارشد در حوزه‌ی جرثقیل سقفی هستید و برای یک فروشگاه B2B ایرانی می‌نویسید.\n\n"
		. "محصول: {$title}\n"
		. ( $sku ? "کد فنی: {$sku}\n" : '' )
		. ( $category ? "دسته: {$category}\n" : '' )
		. ( $specs_text ? "مشخصات ثبت‌شده:\n{$specs_text}" : '' )
		. "\nیک توضیح فنی کامل به زبان فارسی بنویس با این ساختار HTML:\n"
		. "- یک پاراگراف کوتاه و صریح (حداکثر ۳ جمله) در ابتدا\n"
		. "- <h2>نقش این قطعه در مکانیزم</h2>\n"
		. "- <h2>نشانه‌های فرسودگی و زمان تعویض</h2>\n"
		. "- <h2>معیارهای انتخاب صحیح</h2>\n"
		. "- <h2>نکات نصب و راه‌اندازی</h2>\n"
		. "- <h2>پرسش‌های متداول</h2> با چند پرسش و پاسخ\n\n"
		. "قوانین سخت‌گیرانه:\n"
		. "۱) هیچ عدد، تلورانس، ابعاد یا کد معادل OEM را از خودت نساز. اگر داده نداری، "
		. "دقیقاً بنویس: [[نیازمند تایید فنی]]\n"
		. "۲) هیچ ادعای تجاری اثبات‌نشده (سابقه، درصد رضایت، رتبه) ننویس.\n"
		. "۳) فقط HTML خالص برگردان، بدون ```html و بدون توضیح اضافه.\n";
}

/**
 * فراخوانی ارائه‌دهنده. بویلرپلیت برای Anthropic و OpenAI.
 *
 * هر دو مسیر پیاده شده‌اند اما تا وارد نشدن کلید API غیرفعال‌اند.
 * هیچ کلیدی در کد نوشته نشده و نباید نوشته شود — از گزینه‌ی وردپرس
 * خوانده می‌شود.
 */
function cyh_ai_call_provider( $prompt ) {
	$provider = get_option( CYH_AI_PROVIDER_OPTION, 'anthropic' );
	$api_key  = trim( (string) get_option( CYH_AI_KEY_OPTION, '' ) );

	if ( '' === $api_key ) {
		return new WP_Error( 'cyh_ai_no_key', 'کلید API وارد نشده است. آن را در تنظیمات افزونه ثبت کنید.' );
	}

	if ( 'openai' === $provider ) {
		$model    = get_option( CYH_AI_MODEL_OPTION, 'gpt-4o' );
		$endpoint = 'https://api.openai.com/v1/chat/completions';
		$headers  = [
			'Content-Type'  => 'application/json',
			'Authorization' => 'Bearer ' . $api_key,
		];
		$body = [
			'model'    => $model,
			'messages' => [ [ 'role' => 'user', 'content' => $prompt ] ],
			'max_tokens' => 4000,
		];
	} else {
		$model    = get_option( CYH_AI_MODEL_OPTION, 'claude-sonnet-5' );
		$endpoint = 'https://api.anthropic.com/v1/messages';
		$headers  = [
			'Content-Type'      => 'application/json',
			'x-api-key'         => $api_key,
			'anthropic-version' => '2023-06-01',
		];
		$body = [
			'model'      => $model,
			'max_tokens' => 4000,
			'messages'   => [ [ 'role' => 'user', 'content' => $prompt ] ],
		];
	}

	$response = wp_remote_post(
		$endpoint,
		[
			'headers' => $headers,
			'body'    => wp_json_encode( $body ),
			'timeout' => 120,
		]
	);

	if ( is_wp_error( $response ) ) {
		return $response;
	}

	$code = wp_remote_retrieve_response_code( $response );
	$json = json_decode( wp_remote_retrieve_body( $response ), true );

	if ( 200 !== $code ) {
		$message = isset( $json['error']['message'] ) ? $json['error']['message'] : "خطای HTTP {$code}";
		return new WP_Error( 'cyh_ai_http', $message );
	}

	// استخراج متن — شکل پاسخ دو ارائه‌دهنده متفاوت است.
	if ( 'openai' === $provider ) {
		$text = isset( $json['choices'][0]['message']['content'] ) ? $json['choices'][0]['message']['content'] : '';
	} else {
		$text = isset( $json['content'][0]['text'] ) ? $json['content'][0]['text'] : '';
	}

	$text = trim( (string) $text );
	if ( '' === $text ) {
		return new WP_Error( 'cyh_ai_empty', 'پاسخ خالی از سرویس دریافت شد.' );
	}

	return $text;
}

/** اجرای تولید برای یک محصول. */
function cyh_ai_generate_for_post( $post_id ) {
	$post = get_post( $post_id );
	if ( ! $post || 'product' !== $post->post_type ) {
		return new WP_Error( 'cyh_ai_bad_post', 'این شناسه یک محصول معتبر نیست.' );
	}

	$content = cyh_ai_call_provider( cyh_ai_build_prompt( $post_id ) );
	if ( is_wp_error( $content ) ) {
		return $content;
	}

	// پاک‌سازی: فقط تگ‌های مجاز محتوایی باقی می‌مانند.
	$allowed = [
		'p'  => [], 'h2' => [], 'h3' => [], 'ul' => [], 'ol' => [], 'li' => [],
		'strong' => [], 'em' => [], 'br' => [], 'table' => [], 'thead' => [],
		'tbody' => [], 'tr' => [], 'th' => [], 'td' => [],
	];
	$content = wp_kses( $content, $allowed );

	// ⚠️ قفل ایمنی روشن می‌شود پیش از هر نوشتنی.
	if ( ! defined( 'CYH_AI_GENERATING' ) ) {
		define( 'CYH_AI_GENERATING', true );
	}

	if ( 'publish' === $post->post_status ) {
		// محصول منتشرشده: محتوای زنده *دست نمی‌خورد*. خروجی فقط به‌عنوان
		// یک بازبینی ذخیره می‌شود تا مدیر آن را در «تاریخچه‌ی نسخه‌ها»
		// ببیند، مقایسه کند و در صورت تایید بازگرداند.
		_wp_put_post_revision(
			[
				'ID'           => $post_id,
				'post_content' => $content,
				'post_title'   => $post->post_title,
				'post_excerpt' => $post->post_excerpt,
			]
		);
		$mode = 'revision';
	} else {
		// محصول هنوز منتشر نشده: مستقیم در پیش‌نویس نوشته می‌شود.
		wp_update_post(
			[
				'ID'           => $post_id,
				'post_content' => $content,
				'post_status'  => 'draft',
			]
		);
		$mode = 'draft';
	}

	update_post_meta( $post_id, CYH_AI_LAST_RUN_META, current_time( 'mysql' ) );

	return $mode;
}

/** هندلر دکمه. */
function cyh_handle_ai_generate() {
	if ( ! current_user_can( 'edit_posts' ) ) {
		wp_die( 'دسترسی مجاز نیست.' );
	}

	$post_id = isset( $_GET['post'] ) ? (int) $_GET['post'] : 0;
	check_admin_referer( 'cyh_ai_generate_' . $post_id );

	$result = cyh_ai_generate_for_post( $post_id );

	$args = [ 'post' => $post_id, 'action' => 'edit' ];
	if ( is_wp_error( $result ) ) {
		$args['cyh_ai_error'] = rawurlencode( $result->get_error_message() );
	} else {
		$args['cyh_ai_done'] = $result;
	}

	wp_safe_redirect( add_query_arg( $args, admin_url( 'post.php' ) ) );
	exit;
}
add_action( 'admin_post_cyh_ai_generate', 'cyh_handle_ai_generate' );

/** متاباکس روی صفحه‌ی ویرایش محصول. */
function cyh_ai_meta_box() {
	add_meta_box(
		'cyh_ai_draft',
		'تولید محتوای فنی با هوش مصنوعی',
		'cyh_ai_meta_box_render',
		'product',
		'side',
		'default'
	);
}
add_action( 'add_meta_boxes', 'cyh_ai_meta_box' );

function cyh_ai_meta_box_render( $post ) {
	$has_key  = '' !== trim( (string) get_option( CYH_AI_KEY_OPTION, '' ) );
	$last_run = get_post_meta( $post->ID, CYH_AI_LAST_RUN_META, true );
	$url      = wp_nonce_url(
		admin_url( 'admin-post.php?action=cyh_ai_generate&post=' . $post->ID ),
		'cyh_ai_generate_' . $post->ID
	);

	echo '<p style="margin-top:0">محتوای فنی سئو برای این قطعه تولید می‌شود و <strong>فقط به‌صورت پیش‌نویس/بازبینی</strong> ذخیره می‌گردد.</p>';

	if ( 'publish' === $post->post_status ) {
		echo '<p style="background:#fff8e5;border-right:3px solid #dba617;padding:8px">این محصول منتشر شده است. خروجی در <strong>تاریخچه‌ی نسخه‌ها</strong> ذخیره می‌شود و محتوای زنده تغییر نمی‌کند.</p>';
	}

	if ( $last_run ) {
		printf( '<p style="color:#666">آخرین تولید: %s</p>', esc_html( $last_run ) );
	}

	if ( $has_key ) {
		printf( '<a href="%s" class="button button-primary" style="width:100%%;text-align:center">تولید پیش‌نویس فنی</a>', esc_url( $url ) );
	} else {
		echo '<p style="color:#b32d2e">کلید API ثبت نشده است. ابتدا آن را در تنظیمات افزونه وارد کنید.</p>';
	}

	echo '<p style="color:#666;margin-bottom:0;font-size:11px">خروجی مدل باید پیش از انتشار توسط کارشناس فنی بازبینی شود. هر جای علامت‌خورده با <code>[[نیازمند تایید فنی]]</code> باید با داده‌ی واقعی جایگزین شود.</p>';
}

/** نمایش نتیجه پس از بازگشت. */
function cyh_ai_admin_notice() {
	if ( isset( $_GET['cyh_ai_error'] ) ) {
		printf(
			'<div class="notice notice-error is-dismissible"><p><strong>تولید محتوا انجام نشد:</strong> %s</p></div>',
			esc_html( rawurldecode( wp_unslash( $_GET['cyh_ai_error'] ) ) )
		);
		return;
	}

	if ( isset( $_GET['cyh_ai_done'] ) ) {
		$mode = sanitize_text_field( wp_unslash( $_GET['cyh_ai_done'] ) );
		$msg  = 'revision' === $mode
			? 'محتوا به‌عنوان یک <strong>بازبینی</strong> ذخیره شد. از بخش «تاریخچه‌ی نسخه‌ها» آن را بررسی و در صورت تایید بازگردانی کنید.'
			: 'محتوا در <strong>پیش‌نویس</strong> این محصول ذخیره شد. پیش از انتشار حتماً بازبینی کنید.';
		printf( '<div class="notice notice-success is-dismissible"><p>%s</p></div>', wp_kses_post( $msg ) );
	}
}
add_action( 'admin_notices', 'cyh_ai_admin_notice' );

/** ثبت تنظیمات کلید API. */
function cyh_ai_register_settings() {
	register_setting( 'cyh_settings', CYH_AI_PROVIDER_OPTION, [ 'sanitize_callback' => 'sanitize_text_field' ] );
	register_setting( 'cyh_settings', CYH_AI_KEY_OPTION, [ 'sanitize_callback' => 'sanitize_text_field' ] );
	register_setting( 'cyh_settings', CYH_AI_MODEL_OPTION, [ 'sanitize_callback' => 'sanitize_text_field' ] );
}
add_action( 'admin_init', 'cyh_ai_register_settings' );
