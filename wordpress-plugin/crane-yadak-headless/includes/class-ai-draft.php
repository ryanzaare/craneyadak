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
const CYH_AI_KEY_OPTION   = 'cyh_ai_api_key';
const CYH_AI_MODEL_OPTION = 'cyh_ai_model';

/**
 * مدل پیش‌فرض.
 *
 * ⚠️ نکته‌ای که باید بدانید: مدل درخواستی اولیه `gemini-1.5-pro` بود، اما
 * تمام مدل‌های Gemini 1.5 بازنشسته شده‌اند و درخواست به آن‌ها خطای ۴۰۴
 * برمی‌گرداند. یعنی آن اندپوینت از همان اولین فراخوانی شکست می‌خورد.
 * به همین دلیل مدل به‌صورت یک گزینه‌ی قابل ویرایش درآمده تا با
 * بازنشستگی‌های بعدی گوگل، نیازی به تغییر کد نباشد.
 */
const CYH_AI_DEFAULT_MODEL = 'gemini-3.6-flash';

/** ریشه‌ی API — نسخه‌ی v1beta همان چیزی است که مستندات گوگل می‌گوید. */
const CYH_AI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

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
/**
 * فراخوانی Google Gemini.
 *
 * سه تصمیم که ارزش توضیح دارند:
 *
 * ۱) `system_instruction` جدا از `contents`.
 *    جمنای دستورالعمل سیستمی را با وزن بیشتری اعمال می‌کند و مدل کمتر از
 *    آن منحرف می‌شود. ریختن همه‌چیز در یک پیام کاربر، همان قواعد را به
 *    یک «پیشنهاد» تنزل می‌دهد.
 *
 * ۲) ابزار `google_search` فعال است — و این حیاتی است.
 *    خواسته شده بود مدل «در سایت‌های داخلی و بین‌المللی تحقیق عمیق کند».
 *    یک فراخوانی ساده‌ی generateContent هیچ دسترسی‌ای به وب ندارد؛ چنین
 *    دستوری بدون ابزار جستجو، عملاً *دعوت به ساختن منبع* است — دقیقاً
 *    خطرناک‌ترین حالت ممکن برای محتوای فنی. با فعال‌کردن grounding، مدل
 *    واقعاً جستجو می‌کند و پاسخ به نتایج واقعی مقید می‌شود.
 *
 * ۳) دمای پایین (۰.۴).
 *    برای متن فنی، خلاقیت زبانی ارزش دارد اما «خلاقیت عددی» فاجعه است.
 *    دمای پایین احتمال ساختن عدد و کد را کم می‌کند.
 */
function cyh_ai_call_provider( $prompt ) {
	$api_key = trim( (string) get_option( CYH_AI_KEY_OPTION, '' ) );
	if ( '' === $api_key ) {
		return new WP_Error( 'cyh_ai_no_key', 'کلید Google Gemini API وارد نشده است. آن را در تنظیمات افزونه ثبت کنید.' );
	}

	$model = trim( (string) get_option( CYH_AI_MODEL_OPTION, '' ) );
	if ( '' === $model ) {
		$model = CYH_AI_DEFAULT_MODEL;
	}

	$endpoint = CYH_AI_API_BASE . rawurlencode( $model ) . ':generateContent';

	$body = [
		'system_instruction' => [
			'parts' => [ [ 'text' => cyh_ai_system_prompt() ] ],
		],
		'contents' => [
			[
				'role'  => 'user',
				'parts' => [ [ 'text' => $prompt ] ],
			],
		],
		// اتصال به جستجوی گوگل — بدون این، «تحقیق» یعنی توهم.
		'tools' => [ [ 'google_search' => new stdClass() ] ],
		'generationConfig' => [
			'temperature'     => 0.4,
			'maxOutputTokens' => 8192,
		],
		// ایمنی: محتوای فنی درباره‌ی خطر مکانیکی نباید سهواً فیلتر شود،
		// اما آستانه‌ها روی مقدار پیش‌فرض گوگل رها می‌شوند تا رفتار
		// قابل‌پیش‌بینی بماند.
	];

	$response = wp_remote_post(
		$endpoint,
		[
			'headers' => [
				'Content-Type'   => 'application/json',
				'x-goog-api-key' => $api_key,
			],
			'body'    => wp_json_encode( $body ),
			'timeout' => 180, // grounding + متن بلند: تا سه دقیقه طبیعی است
		]
	);

	if ( is_wp_error( $response ) ) {
		return $response;
	}

	$code = wp_remote_retrieve_response_code( $response );
	$json = json_decode( wp_remote_retrieve_body( $response ), true );

	if ( 200 !== $code ) {
		$message = isset( $json['error']['message'] ) ? $json['error']['message'] : "خطای HTTP {$code}";

		// راهنمایی مشخص برای رایج‌ترین خطا.
		if ( 404 === $code ) {
			$message .= ' — به احتمال زیاد نام مدل («' . $model . '») منسوخ شده است.'
				. ' مدل‌های Gemini 1.5 بازنشسته شده‌اند. نام مدل را در تنظیمات افزونه به‌روز کنید.';
		} elseif ( 403 === $code ) {
			$message .= ' — کلید API معتبر نیست یا Generative Language API روی پروژه فعال نشده است.';
		} elseif ( 429 === $code ) {
			$message .= ' — سقف نرخ درخواست پر شده است. صف خودکار ادامه می‌دهد؛ کمی صبر کنید.';
		}

		return new WP_Error( 'cyh_ai_http', $message );
	}

	// استخراج متن — ممکن است در چند part تقسیم شده باشد.
	$parts = $json['candidates'][0]['content']['parts'] ?? [];
	$text  = '';
	foreach ( (array) $parts as $part ) {
		if ( isset( $part['text'] ) ) {
			$text .= $part['text'];
		}
	}
	$text = trim( $text );

	if ( '' === $text ) {
		$reason = $json['candidates'][0]['finishReason'] ?? 'نامشخص';
		return new WP_Error(
			'cyh_ai_empty',
			"پاسخ خالی از جمنای دریافت شد (دلیل پایان: {$reason})."
		);
	}

	// اگر مدل بلوک کد زده باشد، پوسته‌اش را برمی‌داریم.
	$text = preg_replace( '/^```(?:html)?\s*|\s*```$/u', '', $text );

	return $text;
}

/**
 * جداکردن «توضیح کوتاه» از «متن کامل».
 *
 * چرا جداکننده‌ی متنی و نه JSON: خروجی شامل HTML طولانی با کوتیشن و
 * کاراکتر خاص است. وادارکردن مدل به تولید JSON معتبر برای چنین متنی،
 * نرخ خطای بالایی دارد (یک کوتیشن فرار = کل پاسخ غیرقابل‌پارس).
 * دو جداکننده‌ی ساده عملاً خطاناپذیرند.
 *
 * اگر مدل جداکننده را رعایت نکرده باشد، به حالت امن برمی‌گردیم: کل متن
 * محتوا می‌شود و توضیح کوتاه خالی می‌ماند — که اعتبارسنج آن را به‌عنوان
 * ایراد بحرانی گزارش می‌کند. سکوت نمی‌کنیم.
 *
 * @return array{excerpt:string,content:string}
 */
function cyh_ai_split_output( $raw ) {
	$raw = trim( (string) $raw );

	if ( preg_match( '/===EXCERPT===(.*?)===CONTENT===(.*)$/su', $raw, $m ) ) {
		return [
			'excerpt' => trim( wp_strip_all_tags( $m[1] ) ),
			'content' => trim( $m[2] ),
		];
	}

	// جداکننده رعایت نشده — همه‌چیز محتوا در نظر گرفته می‌شود.
	return [ 'excerpt' => '', 'content' => $raw ];
}

/** اجرای تولید برای یک محصول. */
function cyh_ai_generate_for_post( $post_id ) {
	$post = get_post( $post_id );
	if ( ! $post || 'product' !== $post->post_type ) {
		return new WP_Error( 'cyh_ai_bad_post', 'این شناسه یک محصول معتبر نیست.' );
	}

	$raw = cyh_ai_call_provider( cyh_ai_user_prompt( $post_id ) );
	if ( is_wp_error( $raw ) ) {
		return $raw;
	}

	$split   = cyh_ai_split_output( $raw );
	$excerpt = $split['excerpt'];
	$content = $split['content'];

	// ------------------------------------------------------------------
	// پاک‌سازی — با اجازه‌ی صریح به `class`.
	//
	// ⚠️ باگی که اینجا رفع شد: فهرست مجاز قبلی نه `div` داشت، نه `span`،
	// و نه صفت `class`. یعنی پرامپت از مدل می‌خواست بلوک‌های
	// `cy-callout` و `cy-proscons` بسازد و بعد همین فیلتر، *تمام* آن
	// کلاس‌ها و ظرف‌هایشان را حذف می‌کرد. کل قابلیت «محتوای غنی» بی‌صدا
	// از بین می‌رفت و کسی هم متوجه نمی‌شد، چون متن سالم به نظر می‌رسید.
	//
	// `style` فقط روی span و فقط برای متغیر --cy-bar مجاز است (نوار
	// داده). هر style دیگری پایین‌تر حذف می‌شود.
	// ------------------------------------------------------------------
	$allowed = [
		'p'      => [ 'class' => [] ],
		'h2'     => [ 'class' => [], 'id' => [] ],
		'h3'     => [ 'class' => [], 'id' => [] ],
		'h4'     => [ 'class' => [] ],
		'ul'     => [ 'class' => [] ],
		'ol'     => [ 'class' => [] ],
		'li'     => [ 'class' => [] ],
		'strong' => [ 'class' => [] ],
		'em'     => [ 'class' => [] ],
		'br'     => [],
		'div'    => [ 'class' => [] ],
		'span'   => [ 'class' => [], 'style' => [] ],
		'table'  => [ 'class' => [] ],
		'thead'  => [ 'class' => [] ],
		'tbody'  => [ 'class' => [] ],
		'tr'     => [ 'class' => [] ],
		'th'     => [ 'class' => [], 'scope' => [] ],
		'td'     => [ 'class' => [], 'data-label' => [] ],
		'a'      => [ 'href' => [], 'class' => [], 'title' => [] ],
	];
	$content = wp_kses( $content, $allowed );

	// هر style به‌جز متغیر --cy-bar حذف می‌شود. اجازه‌ی style عمومی به
	// خروجی یک مدل، یک بردار تزریق CSS است.
	$content = preg_replace_callback(
		'/\sstyle=(["\'])(.*?)\1/u',
		function ( $m ) {
			return preg_match( '/^\s*--cy-bar:\s*\d{1,3}%\s*;?\s*$/u', $m[2] ) ? $m[0] : '';
		},
		$content
	);

	// ⚠️ قفل ایمنی روشن می‌شود پیش از هر نوشتنی.
	if ( ! defined( 'CYH_AI_GENERATING' ) ) {
		define( 'CYH_AI_GENERATING', true );
	}

	// اعتبارسنجی پیش از ذخیره — نتیجه روی محصول ثبت می‌شود.
	cyh_ai_store_issues( $post_id, cyh_ai_validate_output( $excerpt, $content, $post->post_title ) );

	if ( 'publish' === $post->post_status ) {
		// محصول منتشرشده: محتوای زنده *دست نمی‌خورد*. خروجی فقط به‌عنوان
		// یک بازبینی ذخیره می‌شود تا مدیر آن را در «تاریخچه‌ی نسخه‌ها»
		// ببیند، مقایسه کند و در صورت تایید بازگرداند.
		_wp_put_post_revision(
			[
				'ID'           => $post_id,
				'post_content' => $content,
				'post_title'   => $post->post_title,
				// توضیح کوتاه تولیدشده هم وارد بازبینی می‌شود تا مدیر
				// بتواند آن را با نسخه‌ی فعلی مقایسه کند.
				'post_excerpt' => $excerpt ?: $post->post_excerpt,
			]
		);
		$mode = 'revision';
	} else {
		// محصول هنوز منتشر نشده: مستقیم در پیش‌نویس نوشته می‌شود.
		wp_update_post(
			[
				'ID'           => $post_id,
				'post_content' => $content,
				// ⚠️ این خط یک حفره‌ی سئو را می‌بندد: توضیحات متای صفحه‌ی
				// محصول از `excerpt` می‌آید. بدون آن، هر ۲۲ محصول با
				// meta description خالی منتشر می‌شدند.
				'post_excerpt' => $excerpt,
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
		echo '<p style="color:#b32d2e">کلید Google Gemini API ثبت نشده است. ابتدا آن را در تنظیمات افزونه وارد کنید.</p>';
	}

	echo '<p style="color:#666;margin-bottom:0;font-size:11px">خروجی مدل باید پیش از انتشار توسط کارشناس فنی بازبینی شود. هر جای علامت‌خورده با <code>[نیازمند بررسی فنی]</code> باید با داده‌ی واقعی جایگزین شود.</p>';
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

/**
 * ثبت تنظیمات کلید API.
 *
 * ⚠️ نام گروه باید *دقیقاً* با `settings_fields()` در فرم یکی باشد.
 * نسخه‌ی اول این تابع در گروه «cyh_settings» ثبت می‌کرد در حالی که فرم
 * «cyh_settings_group» می‌فرستد. نتیجه: وردپرس این دو گزینه را متعلق به
 * آن فرم نمی‌دانست و بی‌صدا دور می‌ریخت — یعنی کلید API هرگز ذخیره
 * نمی‌شد و کاربر هیچ پیام خطایی هم نمی‌دید.
 */
function cyh_ai_register_settings() {
	register_setting( 'cyh_settings_group', CYH_AI_KEY_OPTION, [ 'sanitize_callback' => 'sanitize_text_field' ] );
	register_setting( 'cyh_settings_group', CYH_AI_MODEL_OPTION, [ 'sanitize_callback' => 'sanitize_text_field' ] );
}
add_action( 'admin_init', 'cyh_ai_register_settings' );
