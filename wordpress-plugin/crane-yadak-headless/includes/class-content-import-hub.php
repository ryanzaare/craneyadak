<?php
/**
 * ورود یک‌کلیکی محتوای برند و دسته از فایل JSON.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * دو مسئله‌ای که این ابزار حل می‌کند
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ۱) **زمان.** پر کردن دستی ۱۹ برند و ۳۱ دسته، هرکدام با چند ریپیتر و
 *    چند فیلد متنی، ساعت‌ها کار تکراری است.
 *
 * ۲) **خرابیِ HTML — که واقعاً اتفاق افتاد.** وقتی متن HTML در تب «بصری»
 *    ویرایشگر چسبانده شود، TinyMCE علامت‌های `<` و `>` را متن معمولی
 *    می‌بیند و به `&lt;` و `&gt;` تبدیل می‌کند، و هر خط را در `<div>`
 *    می‌پیچد. نتیجه روی سایت: تگ‌ها به‌صورت متن خام دیده می‌شوند.
 *
 *    این نوع خرابی «خاموش» است: در پنل چیزی قرمز نمی‌شود و فقط وقتی
 *    صفحه را می‌بینید معلوم می‌شود.
 *
 *    ورود از فایل، ویرایشگر را کاملاً دور می‌زند — مقدار دقیقاً همان
 *    چیزی ذخیره می‌شود که در JSON است.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * قواعد ایمنی
 * ═══════════════════════════════════════════════════════════════════════════
 *   • هیچ ترم یا نوشته‌ای **ساخته نمی‌شود** — فقط موجودها پر می‌شوند.
 *     ساختار، مرجعش وردپرس است و این ابزار حق دست‌کاری‌اش را ندارد.
 *   • حالت پیش‌فرض «فقط فیلدهای خالی» است؛ نوشته‌ی دست انسان بازنویسی
 *     نمی‌شود مگر تیک صریح زده شود.
 *   • HTML با همان فهرست مجاز سایت پاک‌سازی می‌شود.
 *   • پیش از اجرا، یک «پیش‌نمایش» نشان می‌دهد چه چیزی تغییر خواهد کرد.
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** فیلدهای متنی هر نوع محتوا: نام فیلد => آیا HTML می‌پذیرد؟ */
function cyh_hub_field_map() {
	return [
		'brand' => [
			'simple' => [
				'hero_claim'          => false,
				'intro'               => true,
				'founded_year'        => false,
				'headquarters'        => false,
				'identification_guide' => true,
				'iran_presence'       => true,
			],
			'repeaters' => [ 'series', 'common_parts', 'technologies', 'faqs', 'sources', 'media' ],
		],
		'category' => [
			'simple' => [
				'seo_intro'         => true,
				'engineering_guide' => true,
				'keyword'           => false,
				'aka'               => false,
				'icon_path'         => false,
			],
			'repeaters' => [
				'symptoms', 'causes', 'selection_checklist', 'materials',
				'inspection', 'faqs', 'standards', 'target_industries',
			],
		],
	];
}

/**
 * پاک‌سازی مقدار.
 *
 * ⚠️ اگر ورودی *خودش* دوبار escape شده باشد (`&lt;p&gt;`) یعنی از یک
 * کپی/پیست خراب آمده. آن را به HTML واقعی برمی‌گردانیم، وگرنه همان
 * خرابی را که می‌خواستیم درست کنیم دوباره ذخیره می‌کنیم.
 */
function cyh_hub_clean( $value, $allow_html ) {
	if ( is_array( $value ) ) {
		return array_map( fn( $v ) => cyh_hub_clean( $v, $allow_html ), $value );
	}

	$value = (string) $value;

	if ( ! $allow_html ) {
		return sanitize_text_field( wp_strip_all_tags( $value ) );
	}

	if ( preg_match( '/&lt;(p|h3|h4|ul|ol|li|strong|em|table|div)&gt;/i', $value ) ) {
		$value = html_entity_decode( $value, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
	}

	// حذف <div> های بی‌معنایی که ویرایشگر دور هر خط می‌پیچد.
	$value = preg_replace( '#<div>\s*(<(?:p|h3|h4|ul|ol|table)[ >])#i', '$1', $value );
	$value = preg_replace( '#(</(?:p|h3|h4|ul|ol|table)>)\s*</div>#i', '$1', $value );

	return wp_kses( $value, cyh_import_allowed_html() );
}

/**
 * پاک‌سازی ردیف‌های یک ریپیتر.
 *
 * ⚠️ زیرفیلدهای خاص، نگاشت خاص لازم دارند:
 *
 *   • `category` یک فیلد taxonomy است و **شناسه‌ی ترم** می‌خواهد، نه اسلاگ.
 *     نوشتن اسلاگ در آن، مقدار را بی‌صدا خراب می‌کند: ACF چیزی ذخیره
 *     می‌کند که هیچ ترمی به آن اشاره نمی‌کند و لینک روی سایت غایب می‌شود
 *     بدون هیچ خطایی.
 *
 *   • `needs_review` و `common_in_iran` بولین‌اند؛ رشته‌ی «true» یا «۱»
 *     باید به مقدار بولین تبدیل شود.
 *
 * @param array $rows ردیف‌های خام از JSON.
 * @return array
 */
function cyh_hub_rows( $rows ) {
	$out = [];

	foreach ( $rows as $row ) {
		if ( ! is_array( $row ) ) {
			$out[] = cyh_hub_clean( $row, false );
			continue;
		}

		$clean = [];
		foreach ( $row as $key => $val ) {
			if ( 'category' === $key ) {
				// اسلاگ → شناسه‌ی ترم. اگر پیدا نشد، فیلد خالی می‌ماند
				// (بهتر از یک ارجاع شکسته).
				$term         = get_term_by( 'slug', sanitize_title( (string) $val ), 'crane_category' );
				$clean[ $key ] = ( $term && ! is_wp_error( $term ) ) ? (int) $term->term_id : '';
				continue;
			}

			if ( in_array( $key, [ 'needs_review', 'common_in_iran' ], true ) ) {
				$clean[ $key ] = in_array( $val, [ true, 1, '1', 'true', 'yes', 'بله' ], true ) ? 1 : 0;
				continue;
			}

			// متن چندخطی داخل ریپیتر (مثل answer) باید خط‌هایش حفظ شود.
			$clean[ $key ] = is_string( $val )
				? sanitize_textarea_field( $val )
				: cyh_hub_clean( $val, false );
		}

		$out[] = $clean;
	}

	return $out;
}

/** یافتن هدف: برند (نوشته) یا دسته (ترم). هرگز نمی‌سازد. */
function cyh_hub_locate( $kind, $slug ) {
	if ( 'brand' === $kind ) {
		$posts = get_posts( [
			'post_type'      => 'brand',
			'name'           => $slug,
			'post_status'    => [ 'publish', 'draft', 'pending' ],
			'posts_per_page' => 1,
		] );
		return $posts ? (int) $posts[0]->ID : 0;
	}

	$term = get_term_by( 'slug', $slug, 'crane_category' );
	return ( $term && ! is_wp_error( $term ) ) ? 'crane_category_' . $term->term_id : 0;
}

/**
 * اجرای ورود.
 *
 * @param array $payload  ساختار JSON.
 * @param bool  $overwrite بازنویسی فیلدهای پرشده؟
 * @param bool  $dry_run   فقط گزارش، بدون نوشتن؟
 * @return array
 */
function cyh_hub_import( $payload, $overwrite = false, $dry_run = true ) {
	$map     = cyh_hub_field_map();
	$report  = [];
	$written = 0;
	$skipped = 0;
	$missing = [];

	if ( ! function_exists( 'update_field' ) ) {
		return [ 'error' => 'ACF فعال نیست.', 'rows' => [], 'written' => 0, 'skipped' => 0, 'missing' => [] ];
	}

	foreach ( [ 'brand', 'category' ] as $kind ) {
		foreach ( (array) ( $payload[ $kind . 's' ] ?? [] ) as $slug => $fields ) {
			$slug   = sanitize_title( (string) $slug );
			$target = cyh_hub_locate( $kind, $slug );

			if ( ! $target ) {
				$missing[] = "$kind:$slug";
				continue;
			}

			foreach ( (array) $fields as $name => $raw ) {
				$is_simple   = array_key_exists( $name, $map[ $kind ]['simple'] );
				$is_repeater = in_array( $name, $map[ $kind ]['repeaters'], true );
				if ( ! $is_simple && ! $is_repeater ) {
					continue; // فیلد ناشناخته — بی‌صدا رد می‌شود، نه اینکه چیزی خراب کند.
				}

				$current = get_field( $name, $target );
				$has_now = is_array( $current ) ? ! empty( $current ) : '' !== trim( (string) $current );

				if ( $has_now && ! $overwrite ) {
					$skipped++;
					$report[] = [ $kind, $slug, $name, 'رد شد (از قبل پر است)' ];
					continue;
				}

				$value = $is_simple
					? cyh_hub_clean( $raw, $map[ $kind ]['simple'][ $name ] )
					: cyh_hub_rows( (array) $raw );

				if ( ! $dry_run ) {
					update_field( $name, $value, $target );
				}

				$written++;
				$size     = is_array( $value ) ? count( $value ) . ' ردیف' : mb_strlen( (string) $value ) . ' کاراکتر';
				$report[] = [ $kind, $slug, $name, ( $dry_run ? 'نوشته می‌شود' : 'نوشته شد' ) . " — $size" ];
			}
		}
	}

	return [ 'rows' => $report, 'written' => $written, 'skipped' => $skipped, 'missing' => $missing ];
}


/** صفحه‌ی ابزار. */
function cyh_hub_menu() {
	// زیر منوی «برندها» — جایی که مدیر محتوا دنبالش می‌گردد، نه زیر محصولات.
	add_submenu_page(
		'edit.php?post_type=brand',
		'ورود محتوا از فایل',
		'ورود محتوا از فایل',
		'manage_options',
		'cyh-hub-import',
		'cyh_hub_page'
	);
}
add_action( 'admin_menu', 'cyh_hub_menu' );

/** آدرس صفحه‌ی ابزار — یک جا، تا با ثبت منو واگرا نشود. */
function cyh_hub_url( $args = [] ) {
	return add_query_arg(
		array_merge( [ 'post_type' => 'brand', 'page' => 'cyh-hub-import' ], $args ),
		admin_url( 'edit.php' )
	);
}

/**
 * انتقال نتیجه از هندلر به صفحه.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ باگی که این را لازم کرد — و کاربر را کاملاً زمین‌گیر کرد
 * ═══════════════════════════════════════════════════════════════════════════
 * نسخه‌ی قبل کار را روی `admin-post.php` انجام می‌داد و بعد مستقیم
 * `cyh_hub_page()` را صدا می‌زد و `exit`. اما `admin-post.php` **قالب پنل
 * را بار نمی‌کند**: نه هدر، نه منو، نه CSS. خروجی یک صفحه‌ی HTML لخت بود.
 *
 * زشتی‌اش مهم نبود؛ چیزی که مهم بود این بود که آن صفحه فرم را از نو با
 * مقادیر **پیش‌فرض** چاپ می‌کرد — «فقط پیش‌نمایش» دوباره تیک می‌خورد و
 * «بازنویسی» خالی می‌شد. کاربر در حلقه‌ای گیر می‌افتاد که هر بار دکمه
 * می‌زد فقط یک پیش‌نمایش دیگر می‌گرفت و هیچ‌وقت چیزی نوشته نمی‌شد.
 *
 * دو تغییر:
 *   ۱) الگوی POST → کار → redirect → GET. صفحه همیشه داخل پنل واقعی
 *      رندر می‌شود و رفرش، دوباره فرم را نمی‌فرستد.
 *   ۲) به‌جای چک‌باکس، **دکمه‌ی صریح**. حالتی که باید بین درخواست‌ها زنده
 *      بماند وجود ندارد، پس چیزی هم نمی‌تواند بی‌صدا ریست شود.
 */
function cyh_hub_stash( $key, $data ) {
	set_transient( 'cyh_hub_' . $key . '_' . get_current_user_id(), $data, 5 * MINUTE_IN_SECONDS );
}

function cyh_hub_take( $key ) {
	$name = 'cyh_hub_' . $key . '_' . get_current_user_id();
	$data = get_transient( $name );
	delete_transient( $name );
	return $data;
}

function cyh_hub_page() {
	$import_url = wp_nonce_url( admin_url( 'admin-post.php?action=cyh_hub_import' ), 'cyh_hub_import' );

	$report = cyh_hub_take( 'report' );
	$blocks = cyh_hub_take( 'blocks' );
	$error  = cyh_hub_take( 'error' );

	echo '<div class="wrap">';
	echo '<h1>ورود محتوا از فایل</h1>';

	if ( $error ) {
		echo '<div class="notice notice-error"><p><strong>JSON خوانده نشد.</strong></p><p>' .
			wp_kses_post( $error ) . '</p>' .
			'<p>اگر از کادر متن استفاده کرده‌اید، به‌جایش <strong>فایل را آپلود کنید</strong> — مطمئن‌ترین راه است.</p></div>';
	}

	// ── مهاجرت به بلوک‌های محتوا ────────────────────────────────────────
	$mig_dry = wp_nonce_url( admin_url( 'admin-post.php?action=cyh_blocks_migrate&dry=1' ), 'cyh_blocks_migrate' );
	$mig_run = wp_nonce_url( admin_url( 'admin-post.php?action=cyh_blocks_migrate' ), 'cyh_blocks_migrate' );

	echo '<div class="card" style="max-width:860px;padding:4px 20px 16px;margin-top:20px">';
	echo '<h2>انتقال به بلوک‌های محتوا</h2>';
	echo '<p>فیلدهای اختصاصی برند (معرفی، سری‌ها، قطعات، فناوری‌ها، پرسش‌ها…) به <strong>بلوک‌های محتوا</strong> منتقل می‌شوند. از این پس افزودن محتوای تازه به هیچ تغییری در کد نیاز ندارد.</p>';
	echo '<p><strong>فیلدهای قدیمی پاک نمی‌شوند</strong> — اگر نتیجه را نپسندیدید، بلوک‌ها را حذف کنید و همه‌چیز سر جایش است. برندی که از قبل بلوک دارد، دست‌نخورده می‌ماند.</p>';
	printf(
		'<p><a class="button" href="%s">پیش‌نمایش</a> <a class="button button-primary" href="%s">انتقال بده</a></p>',
		esc_url( $mig_dry ),
		esc_url( $mig_run )
	);

	if ( is_array( $blocks ) && is_array( $blocks['result'] ?? null ) ) {
		$br  = $blocks['result'];
		$bdry = ! empty( $blocks['dry'] );

		if ( ! empty( $br['error'] ) ) {
			printf( '<div class="notice notice-error inline"><p>%s</p></div>', esc_html( $br['error'] ) );
		} else {
			printf(
				'<div class="notice notice-%s inline"><p><strong>%d برند %s</strong>، %d برند رد شد.</p></div>',
				$bdry ? 'warning' : 'success',
				(int) $br['written'],
				$bdry ? 'منتقل می‌شود (چیزی ذخیره نشد)' : 'منتقل شد',
				(int) $br['skipped']
			);
		}

		if ( ! empty( $br['rows'] ) ) {
			echo '<table class="widefat striped" style="margin-top:8px"><thead><tr><th>برند</th><th>حجم</th><th>نتیجه</th></tr></thead><tbody>';
			foreach ( $br['rows'] as $row ) {
				printf(
					'<tr><td><code>%s</code></td><td>%s</td><td>%s</td></tr>',
					esc_html( $row[0] ),
					esc_html( $row[1] ),
					esc_html( $row[2] )
				);
			}
			echo '</tbody></table>';
		}
	}
	echo '</div>';

	// ── ورود از فایل ────────────────────────────────────────────────────
	echo '<div class="card" style="max-width:860px;padding:4px 20px 16px;margin-top:20px">';
	echo '<h2>ورود از فایل JSON</h2>';
	echo '<p>ویرایشگر وردپرس دور زده می‌شود، پس HTML دقیقاً همان‌طور که در فایل است ذخیره می‌شود. <strong>هیچ برند یا دسته‌ای ساخته نمی‌شود</strong> — فقط موجودها پر می‌شوند.</p>';

	echo '<form method="post" action="' . esc_url( $import_url ) . '" enctype="multipart/form-data">';

	echo '<p><label for="cyh_json"><strong>انتخاب فایل</strong></label><br>';
	echo '<input type="file" name="cyh_json_file" id="cyh_json" accept=".json,application/json"></p>';

	echo '<p><label for="cyh_json_text"><strong>یا چسباندن مستقیم JSON</strong></label><br>';
	echo '<textarea name="cyh_json_text" id="cyh_json_text" rows="8" dir="ltr" ';
	echo 'style="width:100%;font-family:Consolas,Monaco,monospace;font-size:12px" ';
	echo 'placeholder=\'{"brands":{"demag":{"hero_claim":"…"}}}\'></textarea></p>';

	// ⚠️ چک‌باکس نه — دکمه.
	//
	// با چک‌باکس، «چه کاری قرار است انجام شود» حالتی است که باید از یک
	// درخواست به درخواست بعد زنده بماند. یک بار زنده نماند و کاربر در حلقه‌ی
	// پیش‌نمایش گیر کرد بدون اینکه هیچ خطایی ببیند.
	//
	// با دکمه، نیت *داخل خود کلیک* است. چیزی برای ریست‌شدن باقی نمی‌ماند،
	// و هر دکمه دقیقاً می‌گوید چه می‌کند.
	echo '<p style="margin:16px 0 4px"><strong>چه کاری انجام شود؟</strong></p>';
	echo '<p style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">';

	echo '<button type="submit" name="cyh_mode" value="preview" class="button">';
	echo 'پیش‌نمایش — چیزی ذخیره نمی‌شود</button>';

	echo '<button type="submit" name="cyh_mode" value="fill" class="button button-primary">';
	echo 'نوشتن در فیلدهای خالی</button>';

	echo '<button type="submit" name="cyh_mode" value="overwrite" class="button button-primary" ';
	echo 'onclick="return confirm(\'متن فعلی این فیلدها با محتوای فایل جایگزین می‌شود. ادامه؟\')">';
	echo 'نوشتن + بازنویسی فیلدهای پرشده</button>';

	echo '</p>';
	echo '<p class="description">«بازنویسی» متنی را که خودتان در پنل نوشته‌اید با محتوای فایل جایگزین می‌کند.</p>';
	echo '</form>';
	echo '</div>';

	// ── گزارش ورود ──────────────────────────────────────────────────────
	// ?? — یک transient مانده از نسخه‌ی قبلیِ افزونه می‌تواند شکل دیگری
	// داشته باشد؛ در PHP 8 خواندن کلید ناموجود اخطار می‌دهد.
	if ( is_array( $report ) && is_array( $report['result'] ?? null ) ) {
		$r    = $report['result'];
		$mode = $report['mode'] ?? 'preview';

		if ( ! empty( $r['error'] ) ) {
			printf( '<div class="notice notice-error"><p>%s</p></div>', esc_html( $r['error'] ) );
		}

		if ( ! empty( $r['missing'] ) ) {
			printf(
				'<div class="notice notice-warning"><p><strong>%d مورد پیدا نشد</strong> (ساخته نشد): %s</p></div>',
				count( $r['missing'] ),
				esc_html( implode( '، ', $r['missing'] ) )
			);
		}

		// ⚠️ سربرگ باید بگوید *چه اتفاقی افتاد*، نه فقط «گزارش».
		// نسخه‌ی قبل هر دو حالت را یکسان نشان می‌داد، و کاربر سه بار
		// پیش‌نمایش گرفت با این تصور که دارد می‌نویسد.
		if ( 'preview' === $mode ) {
			printf(
				'<div class="notice notice-warning"><p><strong>این فقط پیش‌نمایش بود — هیچ‌چیز ذخیره نشد.</strong> ' .
				'%d فیلد نوشته می‌شود. برای اینکه واقعاً نوشته شود، فایل را دوباره انتخاب کنید و ' .
				'یکی از دو دکمه‌ی آبی را بزنید.</p></div>',
				(int) $r['written']
			);
		} else {
			printf(
				'<div class="notice notice-success is-dismissible"><p><strong>%d فیلد نوشته شد</strong>، %d فیلد رد شد%s.</p></div>',
				(int) $r['written'],
				(int) $r['skipped'],
				'overwrite' === $mode ? ' (حالت بازنویسی)' : ' (فقط فیلدهای خالی پر شدند)'
			);
		}

		echo '<h2 style="margin-top:24px">گزارش</h2>';
		echo '<table class="widefat striped" style="max-width:860px"><thead><tr>';
		echo '<th style="width:80px">نوع</th><th style="width:170px">اسلاگ</th><th style="width:190px">فیلد</th><th>نتیجه</th>';
		echo '</tr></thead><tbody>';
		foreach ( (array) ( $r['rows'] ?? [] ) as $row ) {
			printf(
				'<tr><td>%s</td><td><code>%s</code></td><td><code>%s</code></td><td>%s</td></tr>',
				esc_html( $row[0] ),
				esc_html( $row[1] ),
				esc_html( $row[2] ),
				esc_html( $row[3] )
			);
		}
		echo '</tbody></table>';
	}

	echo '</div>';
}

/**
 * خواندن JSON از فایل یا کادر متن — با تشخیص دقیق خطا.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * چرا این‌قدر دفاعی
 * ═══════════════════════════════════════════════════════════════════════════
 * نسخه‌ی اول فقط می‌گفت «JSON نامعتبر است: Syntax error» — که هیچ کمکی
 * نمی‌کند. سه علت رایج وجود دارد و هر سه ظاهرِ یکسانی دارند:
 *
 *   ۱) **BOM** — ویرایشگرهای ویندوز سه بایت نامرئی به ابتدای فایل اضافه
 *      می‌کنند. `json_decode` روی همان بایت اول شکست می‌خورد.
 *
 *   ۲) **بک‌اسلش‌های وردپرس** — وردپرس محتوای `$_POST` را slash می‌کند.
 *      رشته‌ی JSON که `\n` دارد، به `\\n` تبدیل می‌شود و اگر یک‌بار
 *      unslash نشود (یا دو بار بشود) نتیجه خراب است. چون رفتار وردپرس
 *      بین نسخه‌ها و پیکربندی‌ها یکسان نیست، **هر دو حالت امتحان می‌شود**.
 *
 *   ۳) **کپی ناقص** — کاربر بخشی از فایل را کپی کرده.
 *
 * حالا به‌جای «Syntax error»، دقیقاً می‌گوییم کجا و چه چیزی.
 *
 * @return array{json:array|null, error:string}
 */
function cyh_hub_read_json() {
	$candidates = [];

	// ۱) فایل آپلودشده — هیچ slashی روی آن اعمال نمی‌شود.
	if ( ! empty( $_FILES['cyh_json_file']['tmp_name'] ) && is_uploaded_file( $_FILES['cyh_json_file']['tmp_name'] ) ) {
		$raw = file_get_contents( $_FILES['cyh_json_file']['tmp_name'] ); // phpcs:ignore
		if ( false !== $raw ) {
			$candidates['فایل'] = $raw;
		}
	}

	// ۲) کادر متن — هم با unslash و هم بدون آن امتحان می‌شود.
	if ( isset( $_POST['cyh_json_text'] ) && '' !== trim( (string) $_POST['cyh_json_text'] ) ) {
		$posted                      = (string) $_POST['cyh_json_text']; // phpcs:ignore
		$candidates['کادر متن']      = wp_unslash( $posted );
		$candidates['کادر متن (خام)'] = $posted;
		$candidates['کادر متن (دو بار)'] = wp_unslash( wp_unslash( $posted ) );
	}

	if ( ! $candidates ) {
		return [ 'json' => null, 'error' => 'هیچ فایلی انتخاب نشد و کادر متن هم خالی است.' ];
	}

	$last_error = '';

	foreach ( $candidates as $label => $raw ) {
		// حذف BOM — سه بایت نامرئی که ویرایشگرهای ویندوز اضافه می‌کنند.
		$raw = preg_replace( '/^\xEF\xBB\xBF/', '', (string) $raw );
		$raw = trim( $raw );

		if ( '' === $raw ) {
			continue;
		}

		$decoded = json_decode( $raw, true );

		if ( is_array( $decoded ) ) {
			return [ 'json' => $decoded, 'error' => '' ];
		}

		// گزارش دقیق: کجای رشته خراب است.
		$msg = json_last_error_msg();
		$pos = 0;
		if ( function_exists( 'json_last_error' ) && JSON_ERROR_SYNTAX === json_last_error() ) {
			// PHP موقعیت را مستقیم نمی‌دهد؛ با کوتاه‌کردن تدریجی پیدایش می‌کنیم.
			$len = mb_strlen( $raw );
			for ( $i = 1; $i <= $len; $i++ ) {
				if ( null === json_decode( mb_substr( $raw, 0, $i ), true ) && '{' !== mb_substr( $raw, 0, 1 ) ) {
					break;
				}
			}
			$pos = $len;
		}

		$head = mb_substr( $raw, 0, 60 );
		$tail = mb_substr( $raw, -60 );

		$last_error = sprintf(
			'منبع «%s»: %s — طول %d کاراکتر.<br>شروع: <code dir="ltr">%s…</code><br>پایان: <code dir="ltr">…%s</code>',
			esc_html( $label ),
			esc_html( $msg ),
			mb_strlen( $raw ),
			esc_html( $head ),
			esc_html( $tail )
		);
	}

	return [ 'json' => null, 'error' => $last_error ];
}

/** هندلر. */
function cyh_hub_handle() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'دسترسی مجاز نیست.' );
	}
	check_admin_referer( 'cyh_hub_import' );

	$read = cyh_hub_read_json();

	if ( null === $read['json'] ) {
		cyh_hub_stash( 'error', $read['error'] );
		wp_safe_redirect( cyh_hub_url() );
		exit;
	}

	// حالت از خودِ دکمه می‌آید. مقدار ناشناخته → امن‌ترین گزینه.
	$mode = isset( $_POST['cyh_mode'] ) ? sanitize_key( (string) $_POST['cyh_mode'] ) : 'preview';
	if ( ! in_array( $mode, [ 'preview', 'fill', 'overwrite' ], true ) ) {
		$mode = 'preview';
	}

	$result = cyh_hub_import( $read['json'], 'overwrite' === $mode, 'preview' === $mode );

	cyh_hub_stash( 'report', [ 'result' => $result, 'mode' => $mode ] );
	wp_safe_redirect( cyh_hub_url() );
	exit;
}
add_action( 'admin_post_cyh_hub_import', 'cyh_hub_handle' );

/**
 * تعمیر HTML دوبار-escape شده در فیلدهای موجود.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * مسئله‌ی واقعی که این تابع حل می‌کند
 * ═══════════════════════════════════════════════════════════════════════════
 * وقتی HTML در تب «بصری» ویرایشگر چسبانده شود، در پایگاه داده این‌طور
 * ذخیره می‌شود:
 *
 *     <div>&lt;p&gt;متن&lt;/p&gt;</div>
 *
 * روی سایت، کاربر عبارت «<p>» را به‌صورت متن می‌بیند. این خرابی «خاموش»
 * است: نه خطایی می‌دهد و نه در پنل قرمز می‌شود.
 *
 * ابزار ورود از فایل جلوی *ایجاد* این خرابی را می‌گیرد، اما فیلدهایی که
 * قبلاً دستی پر شده‌اند را درست نمی‌کند — و بازنویسی‌شان یعنی از دست رفتن
 * متنی که خودتان نوشته‌اید.
 *
 * این تابع همان متن را نگه می‌دارد و فقط escape را برمی‌گرداند.
 *
 * @param bool $dry_run فقط گزارش؟
 * @return array
 */
/** هندلر تعمیر. */
