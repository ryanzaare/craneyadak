<?php
/**
 * مهاجرت فیلدهای اختصاصی برند → پالت بلوک محتوا.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * چرا این مهاجرت لازم شد
 * ═══════════════════════════════════════════════════════════════════════════
 * مدل قبلی برای هر موجودیت فیلد اختصاصی می‌ساخت: دماگ سری دارد، پس فیلد
 * «سری‌ها» ساخته شد. برند بعدی سری ندارد و چیز دیگری دارد، پس فیلد دیگری
 * لازم می‌شد — یعنی **هر محتوای تازه، یک تغییر در بک‌اند**.
 *
 * پالت بلوک این را وارونه می‌کند. ولی داده‌ی موجود نباید دوباره تایپ شود؛
 * این ابزار آن را مکانیکی منتقل می‌کند:
 *
 *     intro                → بلوک متن
 *     series[]             → بلوک جدول   ← «سری» دیگر فیلد ویژه نیست
 *     media[]              → بلوک رسانه
 *     identification_guide → بلوک متن
 *     iran_presence        → بلوک متن
 *     common_parts[]       → بلوک قطعات مرتبط
 *     technologies[]       → بلوک جدول
 *     faqs[]               → بلوک پرسش و پاسخ
 *     custom_sections[]    → بلوک متن
 *
 * ⚠️ فیلدهای قدیمی **پاک نمی‌شوند**. اگر نتیجه بد بود، بلوک‌ها را حذف
 * کنید و همه‌چیز سر جایش است. حذف داده‌ی انسان، کاری است که باید آگاهانه
 * و جداگانه انجام شود، نه به‌عنوان اثر جانبی یک مهاجرت.
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** یک بلوک خالی با همه‌ی کلیدها — ACF کلید غایب را بی‌صدا نادیده می‌گیرد. */
function cyh_blocks_empty() {
	return [
		'block_type' => 'text', 'heading' => '', 'needs_review' => 0,
		'body' => '', 'intro' => '',
		'col1' => '', 'col2' => '', 'col3' => '', 'col4' => '', 'col5' => '',
		'rows' => [], 'faqs' => [], 'parts' => [], 'media' => [],
	];
}

function cyh_blocks_text( $heading, $body ) {
	if ( '' === trim( (string) $body ) ) {
		return null;
	}
	return array_merge( cyh_blocks_empty(), [
		'block_type' => 'text',
		'heading'    => $heading,
		'body'       => $body,
	] );
}

/**
 * ساخت بلوک جدول از ردیف‌های یک ریپیتر.
 *
 * @param string   $heading عنوان بلوک.
 * @param string   $intro   توضیح زیر عنوان.
 * @param string[] $cols    عنوان ستون‌ها (حداکثر ۵).
 * @param array[]  $rows    هر ردیف: آرایه‌ای از مقادیر سلول.
 */
function cyh_blocks_table( $heading, $intro, $cols, $rows ) {
	$rows = array_values( array_filter( $rows, function ( $r ) {
		foreach ( (array) $r as $cell ) {
			if ( '' !== trim( (string) $cell ) ) {
				return true;
			}
		}
		return false;
	} ) );

	if ( empty( $rows ) ) {
		return null;
	}

	$block = array_merge( cyh_blocks_empty(), [
		'block_type' => 'table',
		'heading'    => $heading,
		'intro'      => $intro,
	] );

	foreach ( array_slice( array_values( $cols ), 0, 5 ) as $i => $label ) {
		$block[ 'col' . ( $i + 1 ) ] = $label;
	}

	foreach ( $rows as $r ) {
		$row = [];
		foreach ( array_slice( array_values( (array) $r ), 0, 5 ) as $i => $cell ) {
			$row[ 'c' . ( $i + 1 ) ] = (string) $cell;
		}
		$block['rows'][] = $row;
	}

	return $block;
}

/** ردیف‌های ریپیتر ACF را با کلیدهای مورد انتظار برمی‌گرداند. */
function cyh_blocks_rows( $value ) {
	return is_array( $value ) ? array_values( array_filter( $value, 'is_array' ) ) : [];
}

/**
 * تبدیل پروفایل یک برند به فهرست بلوک‌ها.
 *
 * @param int $post_id شناسه‌ی نوشته‌ی برند.
 * @return array فهرست بلوک‌ها، به همان ترتیبی که صفحه نمایش می‌دهد.
 */
function cyh_blocks_from_brand( $post_id ) {
	$get    = fn( $name ) => function_exists( 'get_field' ) ? get_field( $name, $post_id ) : null;
	$blocks = [];

	$add = function ( $block ) use ( &$blocks ) {
		if ( null !== $block ) {
			$blocks[] = $block;
		}
	};

	$add( cyh_blocks_text( 'معرفی', (string) $get( 'intro' ) ) );

	// ── سری‌ها → جدول ────────────────────────────────────────────────
	$series = cyh_blocks_rows( $get( 'series' ) );
	if ( $series ) {
		$labels = [
			'current'    => 'در تولید',
			'supported'  => 'قطعه موجود',
			'equivalent' => 'معادل‌یابی',
		];
		$rows = [];
		foreach ( $series as $s ) {
			$status = (string) ( $s['supply_status'] ?? '' );
			$rows[] = [
				(string) ( $s['series_name'] ?? '' ),
				(string) ( $s['equipment_type'] ?? '' ),
				(string) ( $s['capacity_note'] ?? '' ),
				$labels[ $status ] ?? '',
				(string) ( $s['notes'] ?? '' ),
			];
		}
		$add( cyh_blocks_table(
			'سری‌های محصول و وضعیت تأمین قطعه',
			'',
			[ 'سری', 'نوع تجهیز', 'ظرفیت', 'وضعیت تأمین', 'توضیح' ],
			$rows
		) );
	}

	// ── رسانه ────────────────────────────────────────────────────────
	$media = cyh_blocks_rows( $get( 'media' ) );
	if ( $media ) {
		$block = array_merge( cyh_blocks_empty(), [ 'block_type' => 'media', 'heading' => 'تصاویر و ویدیو' ] );
		foreach ( $media as $m ) {
			$block['media'][] = [
				'kind'      => (string) ( $m['kind'] ?? 'image' ),
				// ⚠️ ACF برای فیلد تصویر **شناسه** می‌خواهد. اگر آرایه‌ی کامل
				// ذخیره شود، مقدار بی‌صدا خراب می‌شود و تصویر ناپدید.
				'asset'     => is_array( $m['asset'] ?? null ) ? (int) ( $m['asset']['ID'] ?? 0 ) : (int) ( $m['asset'] ?? 0 ),
				'video_url' => (string) ( $m['video_url'] ?? '' ),
				'caption'   => (string) ( $m['caption'] ?? '' ),
				'alt_text'  => (string) ( $m['alt_text'] ?? '' ),
			];
		}
		$add( $block );
	}

	$add( cyh_blocks_text( 'راهنمای خواندن پلاک و کد فنی', (string) $get( 'identification_guide' ) ) );
	$add( cyh_blocks_text( 'در بازار ایران', (string) $get( 'iran_presence' ) ) );

	// ── قطعات پرتقاضا ────────────────────────────────────────────────
	$parts = cyh_blocks_rows( $get( 'common_parts' ) );
	if ( $parts ) {
		$block = array_merge( cyh_blocks_empty(), [ 'block_type' => 'parts', 'heading' => 'قطعات پرتقاضا' ] );
		foreach ( $parts as $p ) {
			$cat = $p['category'] ?? null;
			if ( is_object( $cat ) ) {
				$cat = (int) $cat->term_id;
			} elseif ( is_array( $cat ) ) {
				$cat = (int) ( $cat['term_id'] ?? 0 );
			} else {
				$cat = (int) $cat;
			}
			$block['parts'][] = [
				'part_name'      => (string) ( $p['part_name'] ?? '' ),
				'category'       => $cat ?: '',
				'failure_reason' => (string) ( $p['failure_reason'] ?? '' ),
			];
		}
		$add( $block );
	}

	// ── فناوری‌ها → جدول ─────────────────────────────────────────────
	$tech = cyh_blocks_rows( $get( 'technologies' ) );
	if ( $tech ) {
		$rows = [];
		foreach ( $tech as $t ) {
			$rows[] = [
				(string) ( $t['name'] ?? '' ),
				(string) ( $t['summary'] ?? '' ),
				(string) ( $t['why_it_matters'] ?? '' ),
			];
		}
		$add( cyh_blocks_table( 'فناوری‌های شاخص', '', [ 'فناوری', 'چیست', 'برای خریدار قطعه' ], $rows ) );
	}

	// ── پرسش‌های متداول ──────────────────────────────────────────────
	$faqs = cyh_blocks_rows( $get( 'faqs' ) );
	if ( $faqs ) {
		$block = array_merge( cyh_blocks_empty(), [ 'block_type' => 'faq', 'heading' => 'پرسش‌های متداول' ] );
		foreach ( $faqs as $f ) {
			if ( '' === trim( (string) ( $f['question'] ?? '' ) ) ) {
				continue;
			}
			$block['faqs'][] = [
				'question' => (string) $f['question'],
				'answer'   => (string) ( $f['answer'] ?? '' ),
			];
		}
		if ( $block['faqs'] ) {
			$add( $block );
		}
	}

	// ── بخش‌های دلخواه ───────────────────────────────────────────────
	foreach ( cyh_blocks_rows( $get( 'custom_sections' ) ) as $c ) {
		$add( cyh_blocks_text( (string) ( $c['heading'] ?? '' ), (string) ( $c['body'] ?? '' ) ) );
	}

	return $blocks;
}

/**
 * اجرای مهاجرت روی همه‌ی برندها.
 *
 * @param bool $dry_run فقط گزارش؟
 * @return array{rows:array,written:int,skipped:int}
 */
function cyh_blocks_migrate( $dry_run = true ) {
	$report  = [];
	$written = 0;
	$skipped = 0;

	if ( ! function_exists( 'get_field' ) ) {
		return [ 'rows' => [], 'written' => 0, 'skipped' => 0, 'error' => 'ACF فعال نیست.' ];
	}

	$posts = get_posts( [
		'post_type'      => 'brand',
		'posts_per_page' => -1,
		'post_status'    => [ 'publish', 'draft', 'pending' ],
	] );

	foreach ( $posts as $post ) {
		$existing = get_field( 'content_blocks', $post->ID );

		// ⚠️ هرگز روی بلوک‌های موجود نمی‌نویسیم. اگر کسی دستی بلوک ساخته،
		// مهاجرت نباید کارش را پاک کند.
		if ( is_array( $existing ) && ! empty( $existing ) ) {
			$skipped++;
			$report[] = [ $post->post_name, count( $existing ) . ' بلوک', 'رد شد — از قبل بلوک دارد' ];
			continue;
		}

		$blocks = cyh_blocks_from_brand( $post->ID );

		if ( empty( $blocks ) ) {
			$report[] = [ $post->post_name, '—', 'چیزی برای منتقل کردن نبود' ];
			continue;
		}

		if ( ! $dry_run ) {
			update_field( 'content_blocks', $blocks, $post->ID );
		}

		$written++;
		$kinds = [];
		foreach ( $blocks as $b ) {
			$kinds[ $b['block_type'] ] = ( $kinds[ $b['block_type'] ] ?? 0 ) + 1;
		}
		$summary = [];
		foreach ( $kinds as $k => $n ) {
			$summary[] = "$k×$n";
		}
		$report[] = [
			$post->post_name,
			count( $blocks ) . ' بلوک',
			( $dry_run ? 'ساخته می‌شود' : 'ساخته شد' ) . ' — ' . implode( '، ', $summary ),
		];
	}

	return [ 'rows' => $report, 'written' => $written, 'skipped' => $skipped ];
}

/** هندلر — الگوی POST → کار → redirect → GET، مثل بقیه‌ی ابزارهای این پنل. */
function cyh_blocks_handle() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'دسترسی مجاز نیست.' );
	}
	check_admin_referer( 'cyh_blocks_migrate' );

	$dry    = ! empty( $_GET['dry'] );
	$result = cyh_blocks_migrate( $dry );

	cyh_hub_stash( 'blocks', [ 'result' => $result, 'dry' => $dry ] );
	wp_safe_redirect( cyh_hub_url() );
	exit;
}
add_action( 'admin_post_cyh_blocks_migrate', 'cyh_blocks_handle' );
