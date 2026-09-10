<?php
/**
 * مهاجرت فیلدهای اختصاصی → پالت بلوک محتوا.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ چرا این فایل postmeta خام می‌خواند و نه `get_field()`
 * ═══════════════════════════════════════════════════════════════════════════
 * نسخه‌ی اول از `get_field()` استفاده می‌کرد. اما گروه‌های `brandProfile` و
 * `categoryContent` در همین تغییر **حذف شده‌اند** — و `get_field()` برای
 * فیلدی که ACF دیگر نمی‌شناسد `null` برمی‌گرداند.
 *
 * یعنی مهاجرت، بی‌سروصدا صفر ردیف پیدا می‌کرد و گزارش می‌داد «چیزی برای
 * منتقل کردن نبود» — در حالی که تمام محتوای دماگ سر جایش در دیتابیس بود.
 * بدترین نوع شکست: موفق به نظر می‌رسد.
 *
 * خواندن مستقیم از postmeta این وابستگی را قطع می‌کند. ساختار ACF ساده و
 * پایدار است:
 *
 *     فیلد ساده     →  meta_key = 'intro'
 *     ریپیتر        →  meta_key = 'series'            (مقدار = تعداد ردیف)
 *     زیرفیلد ریپیتر →  meta_key = 'series_0_series_name'
 *
 * پس داده حتی پس از حذف تعریف فیلد هم خوانا می‌ماند.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * تاریخ انقضا
 * ═══════════════════════════════════════════════════════════════════════════
 * این ابزار **یک‌بارمصرف** است. پس از اینکه هر ۱۹ برند و ۳۱ دسته منتقل
 * شدند، کل این فایل حذف می‌شود. ابزار مهاجرتی که از مهاجرت عمر بیشتری
 * کند، خودش همان فنجان یک‌بارمصرفی است که قرار بود حذفش کنیم.
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** خواندن meta — نوشته یا ترم. */
function cyh_bm_meta( $kind, $id, $key ) {
	return 'term' === $kind ? get_term_meta( $id, $key, true ) : get_post_meta( $id, $key, true );
}

/**
 * ردیف‌های یک ریپیتر ACF را از postmeta خام بازسازی می‌کند.
 *
 * @param string   $kind 'post' یا 'term'.
 * @param int      $id   شناسه.
 * @param string   $name نام ریپیتر.
 * @param string[] $subs نام زیرفیلدها.
 * @return array<int,array<string,mixed>>
 */
function cyh_bm_repeater( $kind, $id, $name, $subs ) {
	$count = (int) cyh_bm_meta( $kind, $id, $name );
	$rows  = [];

	for ( $i = 0; $i < $count; $i++ ) {
		$row = [];
		foreach ( $subs as $sub ) {
			$row[ $sub ] = cyh_bm_meta( $kind, $id, "{$name}_{$i}_{$sub}" );
		}
		$rows[] = $row;
	}

	return $rows;
}

function cyh_bm_empty() {
	return [
		'block_type' => 'text', 'heading' => '', 'needs_review' => 0,
		'body' => '', 'intro' => '',
		'col1' => '', 'col2' => '', 'col3' => '', 'col4' => '', 'col5' => '',
		'rows' => [], 'faqs' => [], 'parts' => [], 'media' => [],
		'specs' => [], 'tone' => 'note', 'callout_body' => '',
	];
}

function cyh_bm_text( $heading, $body ) {
	$body = (string) $body;
	if ( '' === trim( $body ) ) {
		return null;
	}
	return array_merge( cyh_bm_empty(), [ 'block_type' => 'text', 'heading' => $heading, 'body' => $body ] );
}

function cyh_bm_table( $heading, $cols, $rows ) {
	$rows = array_values( array_filter( $rows, function ( $r ) {
		foreach ( (array) $r as $c ) {
			if ( '' !== trim( (string) $c ) ) {
				return true;
			}
		}
		return false;
	} ) );

	if ( empty( $rows ) ) {
		return null;
	}

	$b = array_merge( cyh_bm_empty(), [ 'block_type' => 'table', 'heading' => $heading ] );
	foreach ( array_slice( array_values( $cols ), 0, 5 ) as $i => $label ) {
		$b[ 'col' . ( $i + 1 ) ] = $label;
	}
	foreach ( $rows as $r ) {
		$row = [];
		foreach ( array_slice( array_values( (array) $r ), 0, 5 ) as $i => $cell ) {
			$row[ 'c' . ( $i + 1 ) ] = (string) $cell;
		}
		$b['rows'][] = $row;
	}
	return $b;
}

function cyh_bm_faq( $heading, $pairs ) {
	$out = [];
	foreach ( $pairs as $p ) {
		if ( '' !== trim( (string) $p[0] ) ) {
			$out[] = [ 'question' => (string) $p[0], 'answer' => (string) $p[1] ];
		}
	}
	if ( empty( $out ) ) {
		return null;
	}
	return array_merge( cyh_bm_empty(), [ 'block_type' => 'faq', 'heading' => $heading, 'faqs' => $out ] );
}

/** برند → بلوک‌ها. */
function cyh_bm_brand( $id ) {
	$m      = fn( $k ) => cyh_bm_meta( 'post', $id, $k );
	$blocks = [];
	$add    = function ( $b ) use ( &$blocks ) {
		if ( null !== $b ) {
			$blocks[] = $b;
		}
	};

	$add( cyh_bm_text( 'معرفی', $m( 'intro' ) ) );

	$labels = [ 'current' => 'در تولید', 'supported' => 'قطعه موجود', 'equivalent' => 'معادل‌یابی' ];
	$rows   = [];
	foreach ( cyh_bm_repeater( 'post', $id, 'series',
		[ 'series_name', 'equipment_type', 'capacity_note', 'supply_status', 'notes' ] ) as $s ) {
		$rows[] = [
			$s['series_name'],
			$s['equipment_type'],
			$s['capacity_note'],
			$labels[ (string) $s['supply_status'] ] ?? '',
			$s['notes'],
		];
	}
	$add( cyh_bm_table( 'سری‌های محصول و وضعیت تأمین قطعه',
		[ 'سری', 'نوع تجهیز', 'ظرفیت', 'وضعیت تأمین', 'توضیح' ], $rows ) );

	// ── رسانه ────────────────────────────────────────────────────────
	$media = cyh_bm_repeater( 'post', $id, 'media', [ 'kind', 'asset', 'video_url', 'caption', 'alt_text' ] );
	if ( $media ) {
		$b = array_merge( cyh_bm_empty(), [ 'block_type' => 'media', 'heading' => 'تصاویر و ویدیو' ] );
		foreach ( $media as $x ) {
			$b['media'][] = [
				'kind'      => (string) ( $x['kind'] ?: 'image' ),
				// ⚠️ ACF شناسه می‌خواهد، نه آرایه. postmeta خام هم شناسه دارد.
				'asset'     => (int) $x['asset'],
				'video_url' => (string) $x['video_url'],
				'caption'   => (string) $x['caption'],
				'alt_text'  => (string) $x['alt_text'],
			];
		}
		$add( $b );
	}

	$add( cyh_bm_text( 'راهنمای خواندن پلاک و کد فنی', $m( 'identification_guide' ) ) );
	$add( cyh_bm_text( 'در بازار ایران', $m( 'iran_presence' ) ) );

	// ── قطعات پرتقاضا ────────────────────────────────────────────────
	$parts = cyh_bm_repeater( 'post', $id, 'common_parts', [ 'part_name', 'category', 'failure_reason' ] );
	if ( $parts ) {
		$b = array_merge( cyh_bm_empty(), [ 'block_type' => 'parts', 'heading' => 'قطعات پرتقاضا' ] );
		foreach ( $parts as $p ) {
			$cat = $p['category'];
			if ( is_array( $cat ) ) {
				$cat = reset( $cat );
			}
			$b['parts'][] = [
				'part_name'      => (string) $p['part_name'],
				'category'       => $cat ? (int) $cat : '',
				'failure_reason' => (string) $p['failure_reason'],
			];
		}
		$add( $b );
	}

	$rows = [];
	foreach ( cyh_bm_repeater( 'post', $id, 'technologies', [ 'name', 'summary', 'why_it_matters' ] ) as $t ) {
		$rows[] = [ $t['name'], $t['summary'], $t['why_it_matters'] ];
	}
	$add( cyh_bm_table( 'فناوری‌های شاخص', [ 'فناوری', 'چیست', 'برای خریدار قطعه' ], $rows ) );

	$pairs = [];
	foreach ( cyh_bm_repeater( 'post', $id, 'faqs', [ 'question', 'answer' ] ) as $f ) {
		$pairs[] = [ $f['question'], $f['answer'] ];
	}
	$add( cyh_bm_faq( 'پرسش‌های متداول', $pairs ) );

	foreach ( cyh_bm_repeater( 'post', $id, 'custom_sections', [ 'heading', 'body' ] ) as $c ) {
		$add( cyh_bm_text( (string) $c['heading'], $c['body'] ) );
	}

	return $blocks;
}

/** دسته → بلوک‌ها. */
function cyh_bm_category( $term_id ) {
	$m      = fn( $k ) => cyh_bm_meta( 'term', $term_id, $k );
	$blocks = [];
	$add    = function ( $b ) use ( &$blocks ) {
		if ( null !== $b ) {
			$blocks[] = $b;
		}
	};

	$add( cyh_bm_text( 'این قطعه چیست و چه می‌کند؟', $m( 'seo_intro' ) ) );
	$add( cyh_bm_text( 'راهنمای فنی', $m( 'engineering_guide' ) ) );

	foreach ( [
		[ 'symptoms', 'نشانه‌های خرابی', [ 'title', 'detail' ], [ 'نشانه', 'توضیح' ] ],
		[ 'causes', 'علت‌های خرابی', [ 'title', 'detail' ], [ 'علت', 'توضیح' ] ],
		[ 'selection_checklist', 'راهنمای سفارش', [ 'title', 'detail' ], [ 'مورد', 'توضیح' ] ],
		[ 'materials', 'انتخاب جنس', [ 'title', 'detail' ], [ 'جنس', 'توضیح' ] ],
		[ 'inspection', 'بازرسی', [ 'title', 'detail' ], [ 'مورد', 'توضیح' ] ],
		[ 'standards', 'استانداردها', [ 'title', 'detail' ], [ 'استاندارد', 'توضیح' ] ],
	] as list( $name, $heading, $subs, $cols ) ) {
		$rows = [];
		foreach ( cyh_bm_repeater( 'term', $term_id, $name, $subs ) as $r ) {
			$rows[] = [ $r[ $subs[0] ], $r[ $subs[1] ] ];
		}
		$add( cyh_bm_table( $heading, $cols, $rows ) );
	}

	$pairs = [];
	foreach ( cyh_bm_repeater( 'term', $term_id, 'faqs', [ 'question', 'answer' ] ) as $f ) {
		$pairs[] = [ $f['question'], $f['answer'] ];
	}
	$add( cyh_bm_faq( 'پرسش‌های متداول', $pairs ) );

	return $blocks;
}

/**
 * اجرای مهاجرت.
 *
 * @param bool $dry_run فقط گزارش؟
 */
function cyh_bm_run( $dry_run = true ) {
	$report  = [];
	$written = 0;
	$skipped = 0;

	if ( ! function_exists( 'update_field' ) ) {
		return [ 'rows' => [], 'written' => 0, 'skipped' => 0, 'error' => 'ACF فعال نیست.' ];
	}

	$targets = [];

	foreach ( get_posts( [ 'post_type' => 'brand', 'posts_per_page' => -1, 'post_status' => 'any' ] ) as $p ) {
		$targets[] = [ 'برند', $p->post_name, $p->ID, cyh_bm_brand( $p->ID ) ];
	}

	$terms = get_terms( [ 'taxonomy' => 'crane_category', 'hide_empty' => false ] );
	if ( ! is_wp_error( $terms ) ) {
		foreach ( $terms as $t ) {
			$targets[] = [ 'دسته', $t->slug, 'crane_category_' . $t->term_id, cyh_bm_category( $t->term_id ) ];
		}
	}

	/*
	 * ⚠️ شمارش از **مسیر اجرا** برداشته می‌شود، نه از روی متن نتیجه.
	 *
	 * نسخه‌ی اول خلاصه را با strpos روی جمله‌ی فارسیِ ستون «نتیجه» می‌ساخت.
	 * نتیجه یک خلاصه‌ی خودمتناقض بود: «۱ مورد منتقل می‌شود — ۱ برند، ۱ دسته»
	 * چون ردیفِ «رد شد» هم در سطل «منتقل می‌شود» می‌افتاد.
	 *
	 * شمارنده‌ای که به عبارت‌بندی یک پیام وابسته باشد، اولین بار که آن پیام
	 * ویرایش شود بی‌صدا دروغ می‌گوید. اینجا هر شاخه شمارنده‌ی خودش را
	 * زیاد می‌کند و هیچ رشته‌ای تحلیل نمی‌شود.
	 */
	$counts = [
		'برند' => [ 'written' => 0, 'skipped' => 0, 'empty' => 0 ],
		'دسته' => [ 'written' => 0, 'skipped' => 0, 'empty' => 0 ],
	];
	$skipped_slugs = [];

	foreach ( $targets as list( $kind, $slug, $acf_id, $blocks ) ) {
		$existing = get_field( 'content_blocks', $acf_id );

		// ⚠️ هرگز روی بلوک موجود نمی‌نویسیم — کار دست انسان مقدم است.
		if ( is_array( $existing ) && ! empty( $existing ) ) {
			$skipped++;
			$counts[ $kind ]['skipped']++;
			$skipped_slugs[] = $slug;

			/* «۷ بلوک» به تنهایی به یک سؤالِ بازجواب نمی‌دهد: این بلوک‌ها
			   از کجا آمده‌اند؟ دستِ آدم نوشته یا یک اجرای قبلیِ همین
			   مهاجرت؟ نوعِ بلوک‌های موجود را کنار هم می‌گذاریم تا با
			   چیزی که مهاجرت *می‌ساخت* قابل مقایسه باشد. */
			$have = [];
			foreach ( $existing as $b ) {
				$t = is_array( $b ) ? ( $b['block_type'] ?? '?' ) : '?';
				$have[ $t ] = ( $have[ $t ] ?? 0 ) + 1;
			}
			$have_txt = [];
			foreach ( $have as $t => $n ) {
				$have_txt[] = "{$t}×{$n}";
			}

			$would = [];
			foreach ( (array) $blocks as $b ) {
				$t = $b['block_type'] ?? '?';
				$would[ $t ] = ( $would[ $t ] ?? 0 ) + 1;
			}
			$same = $have === $would && ! empty( $would );

			$report[] = [
				$kind,
				$slug,
				count( $existing ) . ' بلوک',
				'رد شد — از قبل بلوک دارد: ' . implode( '، ', $have_txt )
					. ( $same ? ' (دقیقاً همان چیزی که این مهاجرت می‌ساخت)' : '' ),
			];
			continue;
		}

		if ( empty( $blocks ) ) {
			$counts[ $kind ]['empty']++;
			$report[] = [ $kind, $slug, '—', 'چیزی برای انتقال نبود' ];
			continue;
		}

		if ( ! $dry_run ) {
			update_field( 'content_blocks', $blocks, $acf_id );
		}

		$written++;
		$counts[ $kind ]['written']++;
		$kinds = [];
		foreach ( $blocks as $b ) {
			$kinds[ $b['block_type'] ] = ( $kinds[ $b['block_type'] ] ?? 0 ) + 1;
		}
		$sum = [];
		foreach ( $kinds as $k => $n ) {
			// ⚠️ آکولاد لازم است. «×» کاراکتر چندبایتی است و شناسه‌ی PHP قانوناً
			// بایت‌های 0x80 تا 0xFF را می‌پذیرد، پس "$k×$n" را به‌صورت متغیرِ
			// «$k×» می‌خواند. همین اشتباه یک بار با "$tax→$type" هم رخ داد.
			$sum[] = "{$k}×{$n}";
		}
		$report[] = [
			$kind,
			$slug,
			count( $blocks ) . ' بلوک',
			( $dry_run ? 'ساخته می‌شود' : 'ساخته شد' ) . ' — ' . implode( '، ', $sum ),
		];
	}

	return [
		'rows'          => $report,
		'written'       => $written,
		'skipped'       => $skipped,
		'counts'        => $counts,
		'skipped_slugs' => $skipped_slugs,
	];
}

/**
 * آیا این درخواست واقعاً می‌خواهد بنویسد؟
 *
 * ⚠️ تابع جداست چون تنها راهِ آزمودنش همین است: cyh_bm_handle() ریدایرکت
 * می‌کند و exit، پس در هارنس قابل صدا زدن نیست. تصمیمی که برگشت‌ناپذیرترین
 * عملیات افزونه را کنترل می‌کند نباید جایی زندگی کند که تست نمی‌رسد.
 *
 * قاعده: فقط «go=1» یعنی بنویس. هر چیز دیگری — رشته‌ی خالی، «0»، «true»،
 * «yes»، یا اصلاً نبودن پارامتر — یعنی پیش‌نمایش.
 *
 * @param array $get معمولاً $_GET.
 * @return bool
 */
function cyh_bm_wants_write( array $get ) {
	return isset( $get['go'] ) && '1' === (string) $get['go'];
}

function cyh_bm_handle() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'دسترسی مجاز نیست.' );
	}
	check_admin_referer( 'cyh_blocks_migrate' );

	/*
	 * ⚠️ پیش‌فرض وارونه بود و این خطرناک‌ترین سطر کل افزونه بود.
	 *
	 * قبلاً:  $dry = ! empty( $_GET['dry'] );
	 * یعنی حالت **ایمن** آن چیزی بود که به یک پارامتر نیاز داشت، و حالت
	 * نوشتن، پیش‌فرضِ نبودِ پارامتر. هر اتفاقی که آن query arg را بیندازد —
	 * لینک کوتاه‌شده، ری‌رایت، یک تب بازیابی‌شده، prefetch مرورگر — به
	 * نوشتنِ برگشت‌ناپذیر روی محتوای واقعی ختم می‌شد.
	 *
	 * حالا وارونه است: نوشتن فقط با go=1 صریح. هر ورودی دیگری، از جمله
	 * هیچ ورودی، یعنی پیش‌نمایش. ابزار ورود JSON در همین فایل از اول
	 * درست بود ('preview' پیش‌فرض)؛ این یکی جا مانده بود.
	 */
	$dry = ! cyh_bm_wants_write( $_GET );
	cyh_hub_stash( 'blocks', [ 'result' => cyh_bm_run( $dry ), 'dry' => $dry ] );
	wp_safe_redirect( cyh_hub_url() );
	exit;
}
add_action( 'admin_post_cyh_blocks_migrate', 'cyh_bm_handle' );
