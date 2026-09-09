<?php
/**
 * ورود محتوا از فایل JSON — روش دائمی افزودن محصول.
 *
 * ---------------------------------------------------------------------------
 * چرا این روش، و چرا سیدر و API هوش مصنوعی حذف شدند
 *
 * سه روش امتحان شد و دو تای اول کنار گذاشته شدند:
 *
 *   ۱) سیدر با محتوای hardcode — برای هر محصول جدید باید فایل PHP ویرایش و
 *      کل افزونه دوباره نصب می‌شد. محتوا داخل کد یعنی مدیر محتوا برای یک
 *      غلط تایپی هم به برنامه‌نویس نیاز دارد. علاوه بر آن، متن فارسی با
 *      کوتیشن و آپاستروف داخل رشته‌ی PHP یعنی یک کاراکتر اشتباه کل سایت را
 *      سفید می‌کند — نه فقط سیدر را.
 *
 *   ۲) فراخوانی API هوش مصنوعی از داخل وردپرس — نیازمند کلید، صورتحساب،
 *      و وابسته به نام مدلی که ارائه‌دهنده هر چند ماه بازنشسته می‌کند.
 *      برای این پروژه هزینه و شکنندگی‌اش از فایده‌اش بیشتر بود.
 *
 *   ۳) ورود از فایل JSON — همین روش. محتوا *بیرون* از کد می‌ماند، افزونه
 *      دیگر هرگز برای افزودن محصول تغییر نمی‌کند، هیچ کلید و صورتحسابی
 *      لازم نیست، و مسئله‌ی escape شدن کاراکترها اصلاً وجود ندارد چون
 *      JSON خودش استاندارد فرار کاراکتر دارد.
 *
 * ---------------------------------------------------------------------------
 * قواعد ایمنی — بدون تغییر نسبت به قبل
 *
 * • هر محصول واردشده `draft` است. هیچ‌چیز خودکار منتشر نمی‌شود.
 * • همان اعتبارسنج (class-ai-validator.php) روی محتوای واردشده اجرا
 *   می‌شود: عدد بدون پشتوانه، کد قطعه‌ی ناشناخته، بخش‌های غایب و…
 * • فایل هرگز اجرا نمی‌شود؛ فقط با json_decode خوانده می‌شود.
 * • HTML با wp_kses و همان فهرست مجاز پاک‌سازی می‌شود.
 * ---------------------------------------------------------------------------
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const CYH_IMPORT_SOURCE_META = '_cyh_import_source';

/** فهرست تگ‌های مجاز — همان قواعد محتوای غنی سایت. */
function cyh_import_allowed_html() {
	return [
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

		/*
		 * تصویر داخل متن.
		 *
		 * ⚠️ `width` و `height` عمداً در فهرست هستند و باید *استفاده* شوند.
		 * بدون آن‌ها مرورگر ارتفاع تصویر را تا لحظه‌ی دانلود نمی‌داند، متن
		 * زیرش را رندر می‌کند و بعد ناگهان پایین می‌پرد — این یکی از سه
		 * سنجه‌ی Core Web Vitals (یعنی CLS) را مستقیم خراب می‌کند.
		 *
		 * وقتی تصویر از «کتابخانه‌ی رسانه»ی وردپرس درج شود، این دو خودکار
		 * اضافه می‌شوند. وقتی آدرس تصویر دستی چسبانده شود، نمی‌شوند — و
		 * فرانت‌اند در زمان build همین را هشدار می‌دهد.
		 */
		'img'        => [
			'src'      => [], 'alt'    => [], 'class'  => [],
			'width'    => [], 'height' => [], 'srcset' => [], 'sizes' => [],
			'loading'  => [], 'decoding' => [],
		],
		'figure'     => [ 'class' => [] ],
		'figcaption' => [ 'class' => [] ],
	];
}

/**
 * ورود یک محصول.
 *
 * @param array $item یک رکورد از فایل JSON.
 * @param bool  $update_existing اگر محصولی با همین اسلاگ هست، به‌روزرسانی شود؟
 * @return array{status:string,message:string,post_id:int}
 */
function cyh_import_one( array $item, $update_existing = true ) {
	$title = sanitize_text_field( (string) ( $item['title'] ?? '' ) );
	if ( mb_strlen( $title ) < 3 ) {
		return [ 'status' => 'error', 'message' => 'عنوان محصول خالی یا خیلی کوتاه است.', 'post_id' => 0 ];
	}

	// اسلاگ لاتین — اگر داده نشده، از عنوان ساخته می‌شود، اما عنوان فارسی
	// اسلاگ فارسی می‌دهد. پس فیلد `slug` در فایل JSON عملاً الزامی است.
	$slug = sanitize_title( (string) ( $item['slug'] ?? '' ) );
	if ( '' === $slug ) {
		return [ 'status' => 'error', 'message' => "«{$title}»: فیلد slug خالی است. بدون آن آدرس صفحه فارسی می‌شود.", 'post_id' => 0 ];
	}

	$content = (string) ( $item['content'] ?? '' );
	$excerpt = sanitize_textarea_field( (string) ( $item['excerpt'] ?? '' ) );

	// پاک‌سازی HTML با همان فهرست مجاز.
	$content = wp_kses( $content, cyh_import_allowed_html() );

	// style فقط برای متغیر نوار داده.
	$content = preg_replace_callback(
		'/\s+style=(["\'])(.*?)\1/u',
		function ( $m ) {
			return preg_match( '/^\s*--cy-bar:\s*\d{1,3}%\s*;?\s*$/u', $m[2] ) ? $m[0] : '';
		},
		$content
	);

	// آیا از قبل هست؟
	$existing = get_page_by_path( $slug, OBJECT, 'product' );

	$postarr = [
		'post_type'    => 'product',
		'post_status'  => 'draft', // ⚠️ همیشه پیش‌نویس
		'post_title'   => $title,
		'post_name'    => $slug,
		'post_content' => $content,
		'post_excerpt' => $excerpt,
	];

	if ( $existing ) {
		if ( ! $update_existing ) {
			return [ 'status' => 'skipped', 'message' => "«{$title}» از قبل وجود دارد.", 'post_id' => (int) $existing->ID ];
		}
		// محصول منتشرشده هرگز به پیش‌نویس برنمی‌گردد — این یک صفحه‌ی زنده
		// را از دسترس خارج می‌کرد.
		if ( 'publish' === $existing->post_status ) {
			unset( $postarr['post_status'] );
		}
		$postarr['ID'] = (int) $existing->ID;
		$post_id       = wp_update_post( $postarr, true );
		$verb          = 'به‌روزرسانی شد';
	} else {
		$post_id = wp_insert_post( $postarr, true );
		$verb    = 'ساخته شد';
	}

	if ( is_wp_error( $post_id ) || ! $post_id ) {
		$err = is_wp_error( $post_id ) ? $post_id->get_error_message() : 'خطای نامشخص';
		return [ 'status' => 'error', 'message' => "«{$title}»: {$err}", 'post_id' => 0 ];
	}

	/* ---------------- دسته‌بندی ---------------- */
	$category = sanitize_title( (string) ( $item['category'] ?? '' ) );
	if ( $category ) {
		$term = get_term_by( 'slug', $category, 'crane_category' );
		if ( $term && ! is_wp_error( $term ) ) {
			wp_set_object_terms( $post_id, [ (int) $term->term_id ], 'crane_category' );
		} else {
			// دسته‌ی ناموجود بی‌صدا رد نمی‌شود — محصول بدون دسته در هیچ
			// صفحه‌ای دیده نمی‌شود و این باید گزارش شود.
			update_post_meta( $post_id, '_cyh_import_warning', "دسته‌ی «{$category}» در وردپرس وجود ندارد." );
		}
	}

	/* ---------------- فیلدهای ACF ---------------- */
	if ( function_exists( 'update_field' ) ) {
		// کد فنی: معمولاً خالی است و کارشناس از روی کاتالوگ پر می‌کند.
		if ( isset( $item['sku'] ) ) {
			update_field( 'sku', sanitize_text_field( (string) $item['sku'] ), $post_id );
		}

		if ( isset( $item['buy_mode'] ) ) {
			$mode = 'cart' === $item['buy_mode'] ? 'cart' : 'rfq';
			update_field( 'buy_mode', $mode, $post_id );
		}

		if ( isset( $item['stock_status'] ) ) {
			$allowed = [ 'in_stock', 'on_order', 'unknown' ];
			$stock   = in_array( $item['stock_status'], $allowed, true ) ? $item['stock_status'] : 'unknown';
			update_field( 'stock_status', $stock, $post_id );
		}

		if ( isset( $item['price'] ) && is_numeric( $item['price'] ) ) {
			update_field( 'price', (float) $item['price'], $post_id );
		}

		// ---------------------------------------------------------------
		// برند — با اسلاگ *یا* نام انگلیسی پیدا می‌شود.
		//
		// ⚠️ چرا فقط اسلاگ کافی نیست: اسلاگ واقعی برندها روی این نصب
		// `brand-59` تا `brand-75` است، نه `demag` و `saga`. جست‌وجوی
		// get_page_by_path('saga') هیچ‌وقت چیزی پیدا نمی‌کرد و برند به
		// محصول وصل نمی‌شد — بی‌صدا. و چون انتشار محصول بدون برند مجاز
		// نیست، هر محصول واردشده در همان لحظه‌ی انتشار گیر می‌کرد.
		// ---------------------------------------------------------------
		$brand_key = trim( (string) ( $item['brand'] ?? '' ) );
		if ( '' !== $brand_key ) {
			$brand_post = get_page_by_path( sanitize_title( $brand_key ), OBJECT, 'brand' );

			// اگر با اسلاگ پیدا نشد، با فیلد name_en بگرد.
			if ( ! $brand_post ) {
				$found = get_posts( [
					'post_type'      => 'brand',
					'post_status'    => [ 'publish', 'draft', 'pending', 'private' ],
					'posts_per_page' => 1,
					'meta_query'     => [
						[
							'key'     => 'name_en',
							'value'   => $brand_key,
							'compare' => '=',
						],
					],
				] );
				if ( ! empty( $found ) ) {
					$brand_post = $found[0];
				}
			}

			if ( $brand_post ) {
				update_field( 'brand', [ (int) $brand_post->ID ], $post_id );
			} else {
				// بی‌صدا رد نمی‌شود: محصول بدون برند قابل انتشار نیست.
				update_post_meta(
					$post_id,
					'_cyh_import_warning',
					"برند «{$brand_key}» در وردپرس پیدا نشد. محصول تا اتصال برند قابل انتشار نیست."
				);
			}
		}

		// مشخصات فنی
		if ( ! empty( $item['specs'] ) && is_array( $item['specs'] ) ) {
			$rows = [];
			foreach ( $item['specs'] as $row ) {
				$label = sanitize_text_field( (string) ( $row['label'] ?? '' ) );
				$value = sanitize_text_field( (string) ( $row['value'] ?? '' ) );
				if ( $label && $value ) {
					$rows[] = [ 'spec_label' => $label, 'spec_value' => $value ];
				}
			}
			if ( $rows ) {
				update_field( 'technical_specs', $rows, $post_id );
			}
		}

		// کدهای معادل OEM — فقط اگر واقعاً از کاتالوگ آمده باشند.
		if ( ! empty( $item['oem'] ) && is_array( $item['oem'] ) ) {
			$rows = [];
			foreach ( $item['oem'] as $row ) {
				$b = sanitize_text_field( (string) ( $row['brand'] ?? '' ) );
				$n = sanitize_text_field( (string) ( $row['part_number'] ?? '' ) );
				if ( $b && $n ) {
					$rows[] = [ 'oem_brand' => $b, 'oem_part_number' => $n ];
				}
			}
			if ( $rows ) {
				update_field( 'oem_cross_reference', $rows, $post_id );
			}
		}

		// مدل‌های سازگار
		if ( ! empty( $item['models'] ) && is_array( $item['models'] ) ) {
			$rows = [];
			foreach ( $item['models'] as $row ) {
				$b = sanitize_text_field( (string) ( $row['crane_brand'] ?? '' ) );
				$m = sanitize_text_field( (string) ( $row['model_name'] ?? '' ) );
				if ( $b && $m ) {
					$rows[] = [ 'crane_brand' => $b, 'model_name' => $m ];
				}
			}
			if ( $rows ) {
				update_field( 'compatible_models', $rows, $post_id );
			}
		}
	}

	update_post_meta( $post_id, CYH_IMPORT_SOURCE_META, current_time( 'mysql' ) );

	// منابع رسمی — کاتالوگ سازنده یا صفحه‌ی مرجع. ثبت آن‌ها دو کار می‌کند:
	// (۱) کارشناس می‌داند اعداد از کجا آمده‌اند و می‌تواند راستی‌آزمایی کند،
	// (۲) اعتبارسنج اعداد را «تاییدنشده» فرض نمی‌کند.
	$sources = [];
	if ( ! empty( $item['sources'] ) && is_array( $item['sources'] ) ) {
		foreach ( $item['sources'] as $url ) {
			$clean = esc_url_raw( (string) $url );
			if ( $clean ) {
				$sources[] = $clean;
			}
		}
	}
	if ( $sources ) {
		update_post_meta( $post_id, '_cyh_sources', wp_json_encode( $sources, JSON_UNESCAPED_SLASHES ) );
	}

	// همان اعتبارسنج قبلی — حالا روی محتوای واردشده.
	if ( function_exists( 'cyh_ai_validate_output' ) ) {
		cyh_ai_store_issues( $post_id, cyh_ai_validate_output( $excerpt, $content, $title, ! empty( $sources ) ) );
	}

	$errors = function_exists( 'cyh_ai_error_count' ) ? cyh_ai_error_count( $post_id ) : 0;

	return [
		'status'  => $errors > 0 ? 'warning' : 'ok',
		'message' => "«{$title}» {$verb}." . ( $errors > 0 ? " ({$errors} ایراد بحرانی — بازبینی کنید)" : '' ),
		'post_id' => (int) $post_id,
	];
}

/** ورود یک فایل کامل. */
function cyh_import_json( $json_string, $update_existing = true ) {
	$data = json_decode( $json_string, true );

	if ( null === $data ) {
		return new WP_Error( 'cyh_bad_json', 'فایل JSON معتبر نیست: ' . json_last_error_msg() );
	}

	// هم آرایه‌ی مستقیم پذیرفته می‌شود، هم شیء با کلید products.
	$items = isset( $data['products'] ) && is_array( $data['products'] ) ? $data['products'] : $data;

	if ( ! is_array( $items ) || empty( $items ) ) {
		return new WP_Error( 'cyh_empty_json', 'فایل خالی است یا ساختار مورد انتظار را ندارد.' );
	}

	$results = [];
	foreach ( $items as $item ) {
		if ( is_array( $item ) ) {
			$results[] = cyh_import_one( $item, $update_existing );
		}
	}

	return $results;
}

/* =========================================================================
   رابط کاربری
   ========================================================================= */
function cyh_import_menu() {
	add_submenu_page(
		'edit.php?post_type=product',
		'ورود محصولات از فایل',
		'ورود محصولات از فایل',
		'edit_posts',
		'cyh-import',
		'cyh_import_page'
	);
}
add_action( 'admin_menu', 'cyh_import_menu' );

function cyh_import_page() {
	echo '<div class="wrap">';
	echo '<h1>ورود محصولات از فایل JSON</h1>';

	echo '<div style="background:#fff8e5;border-right:4px solid #dba617;padding:12px 16px;margin:16px 0;max-width:820px">';
	echo '<p style="margin:0 0 8px"><strong>همه‌ی محصولات واردشده پیش‌نویس هستند.</strong> هیچ‌چیز خودکار منتشر نمی‌شود.</p>';
	echo '<p style="margin:0">پس از ورود، روی هر محصول یک بازبینی خودکار اجرا می‌شود و ایرادها در جعبه‌ی «بازبینی خروجی» صفحه‌ی ویرایش نمایش داده می‌شوند. هر <code>[نیازمند بررسی فنی]</code> باید با داده‌ی واقعی از کاتالوگ سازنده پر شود.</p>';
	echo '</div>';

	$nonce = wp_nonce_field( 'cyh_import', '_wpnonce', true, false );
	echo '<form method="post" enctype="multipart/form-data" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="max-width:820px">';
	echo '<input type="hidden" name="action" value="cyh_import_submit">';
	echo $nonce;

	echo '<table class="form-table" role="presentation">';
	echo '<tr><th scope="row"><label for="cyh_json_file">فایل JSON</label></th><td>';
	echo '<input type="file" id="cyh_json_file" name="cyh_json_file" accept=".json,application/json" required>';
	echo '<p class="description">فایلی که برایتان آماده شده را انتخاب کنید.</p>';
	echo '</td></tr>';

	echo '<tr><th scope="row">محصول تکراری</th><td>';
	echo '<label><input type="checkbox" name="update_existing" value="1" checked> اگر محصولی با همین اسلاگ وجود دارد، به‌روزرسانی شود</label>';
	echo '<p class="description">با برداشتن تیک، محصولات موجود دست‌نخورده می‌مانند و رد می‌شوند. محصول <strong>منتشرشده</strong> در هر حالت به پیش‌نویس برنمی‌گردد.</p>';
	echo '</td></tr>';
	echo '</table>';

	submit_button( 'ورود محصولات' );
	echo '</form>';

	/* ---------- نمایش نتیجه ---------- */
	$report = get_transient( 'cyh_import_report' );
	if ( is_array( $report ) && $report ) {
		delete_transient( 'cyh_import_report' );

		echo '<h2 style="margin-top:32px">نتیجه‌ی ورود</h2>';
		echo '<table class="wp-list-table widefat fixed striped" style="max-width:820px"><thead><tr>';
		echo '<th style="width:90px">وضعیت</th><th>پیام</th><th style="width:110px">اقدام</th>';
		echo '</tr></thead><tbody>';

		$colors = [ 'ok' => '#00a32a', 'warning' => '#dba617', 'skipped' => '#646970', 'error' => '#d63638' ];
		$labels = [ 'ok' => 'موفق', 'warning' => 'با هشدار', 'skipped' => 'رد شد', 'error' => 'ناموفق' ];

		foreach ( $report as $row ) {
			$st = $row['status'] ?? 'error';
			printf(
				'<tr><td><span style="color:%s;font-weight:700">%s</span></td><td>%s</td><td>%s</td></tr>',
				esc_attr( $colors[ $st ] ?? '#646970' ),
				esc_html( $labels[ $st ] ?? $st ),
				esc_html( $row['message'] ?? '' ),
				! empty( $row['post_id'] )
					? '<a href="' . esc_url( get_edit_post_link( $row['post_id'] ) ) . '">ویرایش</a>'
					: '—'
			);
		}
		echo '</tbody></table>';
	}

	/* ---------- راهنمای ساختار فایل ---------- */
	echo '<h2 style="margin-top:32px">ساختار فایل</h2>';
	echo '<p style="max-width:820px">هر محصول یک شیء در آرایه است. فقط <code>title</code>، <code>slug</code>، <code>excerpt</code> و <code>content</code> الزامی‌اند؛ بقیه اختیاری.</p>';
	echo '<pre style="background:#f6f7f7;border:1px solid #dcdcde;padding:12px;overflow:auto;max-width:820px;direction:ltr;text-align:left">';
	echo esc_html(
		"[\n" .
		"  {\n" .
		"    \"title\": \"کمربند جرثقیل اشتال مدل SH5025-20\",\n" .
		"    \"slug\": \"stahl-sh5025-20\",\n" .
		"    \"excerpt\": \"توضیح کوتاه ۱۲۰ تا ۱۶۰ کاراکتری برای meta description\",\n" .
		"    \"content\": \"<h2>نمای کلی</h2><p>...</p>\",\n" .
		"    \"category\": \"rope-guide\",\n" .
		"    \"brand\": \"stahl\",\n" .
		"    \"sku\": \"\",\n" .
		"    \"buy_mode\": \"rfq\",\n" .
		"    \"stock_status\": \"unknown\",\n" .
		"    \"specs\": [ { \"label\": \"جنس بدنه\", \"value\": \"[نیازمند بررسی فنی]\" } ],\n" .
		"    \"oem\":   [ { \"brand\": \"Stahl\", \"part_number\": \"...\" } ],\n" .
		"    \"models\": [ { \"crane_brand\": \"Stahl\", \"model_name\": \"...\" } ]\n" .
		"  }\n" .
		"]"
	);
	echo '</pre>';

	echo '</div>';
}

/** هندلر آپلود. */
function cyh_import_submit() {
	if ( ! current_user_can( 'edit_posts' ) ) {
		wp_die( 'دسترسی مجاز نیست.' );
	}
	check_admin_referer( 'cyh_import' );

	$redirect = add_query_arg( [ 'post_type' => 'product', 'page' => 'cyh-import' ], admin_url( 'edit.php' ) );

	if ( empty( $_FILES['cyh_json_file']['tmp_name'] ) ) {
		set_transient( 'cyh_import_report', [ [ 'status' => 'error', 'message' => 'فایلی انتخاب نشده بود.' ] ], 60 );
		wp_safe_redirect( $redirect );
		exit;
	}

	// ⚠️ فایل هرگز اجرا نمی‌شود — فقط خوانده و با json_decode پارس می‌شود.
	$raw = file_get_contents( $_FILES['cyh_json_file']['tmp_name'] );

	$results = cyh_import_json( (string) $raw, ! empty( $_POST['update_existing'] ) );

	if ( is_wp_error( $results ) ) {
		$results = [ [ 'status' => 'error', 'message' => $results->get_error_message() ] ];
	}

	set_transient( 'cyh_import_report', $results, 5 * MINUTE_IN_SECONDS );
	wp_safe_redirect( $redirect );
	exit;
}
add_action( 'admin_post_cyh_import_submit', 'cyh_import_submit' );
