<?php
/**
 * اعتبارسنجی خروجی مدل — «هر قاعده‌ای که بررسی نشود، اجرا نمی‌شود».
 *
 * ---------------------------------------------------------------------------
 * چرا این فایل ضروری است
 *
 * پرامپت سیستمی پر از قاعده است، اما پرامپت یک *درخواست* است نه یک تضمین.
 * مدل ممکن است بخشی را جا بیندازد، عددی بسازد، یا کلاس‌های CSS را نادیده
 * بگیرد — و خروجی همچنان کاملاً روان و قابل‌قبول به نظر برسد. برای ۲۲
 * پیش‌نویس، تشخیص چشمی این موارد عملاً غیرممکن است.
 *
 * این ماژول هر پیش‌نویس را برابر همان قواعد می‌سنجد و نتیجه را روی خودِ
 * محصول ثبت می‌کند. کارشناس به‌جای خواندن ۲۲ متن کامل، اول فهرست ایرادها
 * را می‌بیند.
 *
 * ⚠️ نکته‌ی مهم: این اعتبارسنج محتوا را *رد نمی‌کند* و چیزی را حذف
 * نمی‌کند. کارش گزارش‌دادن است، نه سانسور. تصمیم نهایی با انسان است —
 * دقیقاً مثل بقیه‌ی این خط لوله.
 * ---------------------------------------------------------------------------
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const CYH_AI_ISSUES_META = '_cyh_ai_issues';

/** شدت ایراد. `error` یعنی حتماً باید اصلاح شود. */
const CYH_ISSUE_ERROR = 'error';
const CYH_ISSUE_WARN  = 'warn';

/**
 * بررسی کامل یک خروجی.
 *
 * @return array<int,array{level:string,message:string}>
 */
function cyh_ai_validate_output( $excerpt, $content, $product_title ) {
	$issues = [];
	$text   = wp_strip_all_tags( $content );

	/* ---------------------------------------------------------------
	   ۱) عددِ بدون پشتوانه — مهم‌ترین بررسی
	   ---------------------------------------------------------------
	   دنبال الگوی «عدد + واحد مهندسی» می‌گردیم. اگر مدل نوشته باشد
	   «قطر ۱۶ میلی‌متر» بدون آن‌که چنین داده‌ای به او داده باشیم، این
	   یک عدد ساختگی است — دقیقاً همان چیزی که ممنوع بود.

	   این بررسی عمداً حساس است و ممکن است چند مورد بی‌خطر را هم علامت
	   بزند (مثلاً «۴ شینه» که یک واقعیت عمومی است). آن هزینه پذیرفتنی
	   است: یک هشدار اضافه چند ثانیه وقت کارشناس می‌گیرد، اما یک عدد
	   ساختگیِ ازقلم‌افتاده می‌تواند به سفارش قطعه‌ی اشتباه منجر شود.
	--------------------------------------------------------------- */
	$unit_pattern = '(?:میلی[\s‌]?متر|سانتی[\s‌]?متر|متر|میلی|mm|cm|kg|کیلوگرم|تن|ton|'
		. 'ولت|volt|v|آمپر|amp|a|وات|kw|w|نیوتن|n·m|nm|دور|rpm|بار|bar|درجه|°)';

	if ( preg_match_all( '/([۰-۹0-9]+(?:[.,][۰-۹0-9]+)?)\s*' . $unit_pattern . '\b/ui', $text, $m, PREG_SET_ORDER ) ) {
		$samples = [];
		foreach ( $m as $hit ) {
			$samples[] = trim( $hit[0] );
			if ( count( $samples ) >= 6 ) {
				break;
			}
		}
		$issues[] = [
			'level'   => CYH_ISSUE_ERROR,
			'message' => sprintf(
				'%d عدد با واحد مهندسی در متن پیدا شد. اگر این اعداد از کاتالوگ سازنده تایید نشده‌اند، باید با [نیازمند بررسی فنی] جایگزین شوند. نمونه: %s',
				count( $m ),
				implode( '، ', array_unique( $samples ) )
			),
		];
	}

	/* ---------------------------------------------------------------
	   ۲) الگوی کد قطعه — کد ساختگی خطرناک‌ترین خروجی ممکن است
	--------------------------------------------------------------- */
	if ( preg_match_all( '/\b[A-Z]{2,}[-\s]?\d{2,}[A-Z0-9-]*\b/u', $text, $codes ) ) {
		// کدهایی که در خودِ عنوان محصول هستند مجازند — کارفرما آن‌ها را داده.
		$title_codes = [];
		preg_match_all( '/\b[A-Z]{2,}[-\s]?\d{2,}[A-Z0-9-]*\b/u', $product_title, $title_codes );
		$known   = array_map( 'strtoupper', $title_codes[0] ?? [] );
		$unknown = array_values( array_diff( array_unique( array_map( 'strtoupper', $codes[0] ) ), $known ) );

		if ( ! empty( $unknown ) ) {
			$issues[] = [
				'level'   => CYH_ISSUE_ERROR,
				'message' => sprintf(
					'کد(های) قطعه‌ای در متن آمده که در عنوان محصول نبوده‌اند: %s — این‌ها احتمالاً ساختگی‌اند و باید حذف یا با [نیازمند بررسی فنی] جایگزین شوند.',
					implode( '، ', array_slice( $unknown, 0, 6 ) )
				),
			];
		}
	}

	/* ---------------------------------------------------------------
	   ۳) بخش‌های الزامی
	--------------------------------------------------------------- */
	$required = [
		'نمای کلی'      => 'بخش «نمای کلی»',
		'بررسی تخصصی'   => 'بخش «بررسی تخصصی»',
		'نشانه'         => 'زیربخش نشانه‌های فرسودگی',
		'انتخاب'        => 'زیربخش معیارهای انتخاب',
		'نصب'           => 'زیربخش نصب و راه‌اندازی',
		'پرسش'          => 'بخش پرسش‌های متداول',
	];
	foreach ( $required as $needle => $label ) {
		if ( false === mb_strpos( $content, $needle ) ) {
			$issues[] = [ 'level' => CYH_ISSUE_ERROR, 'message' => "{$label} نوشته نشده است." ];
		}
	}

	/* ---------------------------------------------------------------
	   ۴) طول متن — «بررسی تخصصی» باید واقعاً عمیق باشد
	--------------------------------------------------------------- */
	$words = count( preg_split( '/\s+/u', trim( $text ), -1, PREG_SPLIT_NO_EMPTY ) );
	if ( $words < 700 ) {
		$issues[] = [
			'level'   => CYH_ISSUE_ERROR,
			'message' => "متن فقط {$words} کلمه است. حداقل مورد انتظار ۱۲۰۰ کلمه بود؛ زیر ۷۰۰ کلمه برای رقابت در نتایج گوگل کافی نیست.",
		];
	} elseif ( $words < 1200 ) {
		$issues[] = [
			'level'   => CYH_ISSUE_WARN,
			'message' => "متن {$words} کلمه است — کمتر از هدف ۱۲۰۰ کلمه.",
		];
	}

	/* ---------------------------------------------------------------
	   ۵) ساختارهای غنی — اگر استفاده نشده، متن یک دیوار نوشته است
	--------------------------------------------------------------- */
	$has_rich = false !== mb_strpos( $content, 'cy-callout' )
		|| false !== mb_strpos( $content, 'cy-proscons' )
		|| false !== mb_strpos( $content, 'cy-compare' )
		|| false !== mb_strpos( $content, 'cy-bar' );
	if ( ! $has_rich ) {
		$issues[] = [
			'level'   => CYH_ISSUE_WARN,
			'message' => 'هیچ بلوک غنی (هشدار، مزایا/معایب، جدول مقایسه) استفاده نشده — متن فقط پاراگراف پشت پاراگراف است.',
		];
	}

	/* ---------------------------------------------------------------
	   ۶) لحن هوش مصنوعی
	--------------------------------------------------------------- */
	$banned = [
		'در دنیای امروز', 'شایان ذکر است', 'لازم به ذکر است', 'در نتیجه می‌توان گفت',
		'بی‌نظیر', 'فوق‌العاده', 'بهترین گزینه', 'انقلابی', 'بدون شک', 'قطعاً',
	];
	$found = [];
	foreach ( $banned as $phrase ) {
		if ( false !== mb_strpos( $text, $phrase ) ) {
			$found[] = $phrase;
		}
	}
	if ( $found ) {
		$issues[] = [
			'level'   => CYH_ISSUE_WARN,
			'message' => 'عبارت‌های نشان‌دهنده‌ی نوشتار ماشینی: ' . implode( '، ', $found ),
		];
	}

	/* ---------------------------------------------------------------
	   ۷) توضیحات متا
	--------------------------------------------------------------- */
	$excerpt_len = mb_strlen( trim( $excerpt ) );
	if ( 0 === $excerpt_len ) {
		$issues[] = [ 'level' => CYH_ISSUE_ERROR, 'message' => 'توضیح کوتاه (meta description) تولید نشده است.' ];
	} elseif ( $excerpt_len < 80 || $excerpt_len > 200 ) {
		$issues[] = [
			'level'   => CYH_ISSUE_WARN,
			'message' => "طول توضیح کوتاه {$excerpt_len} کاراکتر است؛ بازه‌ی مناسب ۱۲۰ تا ۱۶۰ کاراکتر.",
		];
	}

	/* ---------------------------------------------------------------
	   ۸) تگ ممنوع
	--------------------------------------------------------------- */
	if ( preg_match( '/<h1\b/i', $content ) ) {
		$issues[] = [ 'level' => CYH_ISSUE_ERROR, 'message' => 'تگ <h1> در متن هست — عنوان صفحه از خودِ محصول می‌آید.' ];
	}
	if ( preg_match( '/<a\s/i', $content ) ) {
		$issues[] = [
			'level'   => CYH_ISSUE_WARN,
			'message' => 'تگ <a> در متن هست. لینک‌دهی داخلی به‌صورت خودکار انجام می‌شود؛ لینک دستی ممکن است به آدرس اشتباه برود.',
		];
	}

	return $issues;
}

/** ثبت نتیجه روی محصول. */
function cyh_ai_store_issues( $post_id, array $issues ) {
	if ( empty( $issues ) ) {
		delete_post_meta( $post_id, CYH_AI_ISSUES_META );
		return;
	}
	update_post_meta( $post_id, CYH_AI_ISSUES_META, wp_json_encode( $issues, JSON_UNESCAPED_UNICODE ) );
}

/** خواندن نتیجه. */
function cyh_ai_get_issues( $post_id ) {
	$raw = get_post_meta( $post_id, CYH_AI_ISSUES_META, true );
	if ( ! $raw ) {
		return [];
	}
	$decoded = json_decode( (string) $raw, true );
	return is_array( $decoded ) ? $decoded : [];
}

/** شمارش ایرادهای بحرانی. */
function cyh_ai_error_count( $post_id ) {
	$n = 0;
	foreach ( cyh_ai_get_issues( $post_id ) as $issue ) {
		if ( CYH_ISSUE_ERROR === ( $issue['level'] ?? '' ) ) {
			$n++;
		}
	}
	return $n;
}

/* =========================================================================
   نمایش در صفحه‌ی ویرایش محصول
   ========================================================================= */
function cyh_ai_issues_meta_box() {
	add_meta_box(
		'cyh_ai_issues',
		'بازبینی خروجی هوش مصنوعی',
		'cyh_ai_issues_render',
		'product',
		'normal',
		'high'
	);
}
add_action( 'add_meta_boxes', 'cyh_ai_issues_meta_box' );

function cyh_ai_issues_render( $post ) {
	$issues = cyh_ai_get_issues( $post->ID );

	if ( empty( $issues ) ) {
		$status = get_post_meta( $post->ID, CYH_AI_STATUS_META, true );
		echo 'done' === $status
			? '<p style="color:#00a32a;font-weight:700;margin:0">✅ خروجی بررسی شد و ایرادی پیدا نشد. همچنان بازبینی انسانی لازم است.</p>'
			: '<p style="color:#646970;margin:0">هنوز محتوایی برای این محصول تولید نشده است.</p>';
		return;
	}

	$errors = array_filter( $issues, fn( $i ) => CYH_ISSUE_ERROR === ( $i['level'] ?? '' ) );

	printf(
		'<p style="margin:0 0 12px"><strong style="color:%s">%d ایراد بحرانی</strong> و %d هشدار پیدا شد. پیش از انتشار، موارد بحرانی باید اصلاح شوند.</p>',
		count( $errors ) > 0 ? '#d63638' : '#00a32a',
		count( $errors ),
		count( $issues ) - count( $errors )
	);

	echo '<ul style="margin:0">';
	foreach ( $issues as $issue ) {
		$is_error = CYH_ISSUE_ERROR === ( $issue['level'] ?? '' );
		printf(
			'<li style="margin-bottom:8px;padding-right:8px;border-right:3px solid %s"><strong>%s</strong> %s</li>',
			$is_error ? '#d63638' : '#dba617',
			$is_error ? 'بحرانی:' : 'هشدار:',
			esc_html( $issue['message'] ?? '' )
		);
	}
	echo '</ul>';

	echo '<p style="margin:12px 0 0;color:#646970;font-size:12px">'
		. 'این بررسی خودکار است و جای بازبینی کارشناس فنی را نمی‌گیرد. '
		. 'به‌ویژه هر <code>[نیازمند بررسی فنی]</code> باید با داده‌ی واقعی از کاتالوگ سازنده پر شود.'
		. '</p>';
}
