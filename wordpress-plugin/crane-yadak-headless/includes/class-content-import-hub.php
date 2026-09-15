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
/**
 * فیلدهای *هویتی* هر نوع محتوا: نام فیلد => آیا HTML می‌پذیرد؟
 *
 * ⚠️ این نگاشت تا امروز فیلدهای مدل **قدیمی** را داشت — `seo_intro`،
 * `engineering_guide`، `symptoms`، `series`، `common_parts` و بقیه. آن
 * فیلدها متعلق به گروه‌های `categoryContent` و `brandProfile` بودند که در
 * بازنویسی ۳.۰.۰ حذف شدند.
 *
 * یعنی این ابزار در سکوت روی فیلدهایی می‌نوشت که هیچ گروه ACF دیگر
 * نمی‌شناسد: مقدار در postmeta می‌نشست و هیچ‌جا خوانده نمی‌شد. نه خطایی،
 * نه هشداری — فقط محتوایی که ناپدید می‌شد.
 *
 * نقض قاعده‌ی ۲ بود: مدل محتوا عوض شد و ابزارِ نوشتنِ محتوا با آن عوض نشد.
 *
 * حالا فقط فیلدهای هویتی اینجا می‌مانند. **نثر از مسیر `blocks` می‌آید.**
 */
function cyh_hub_field_map() {
	return [
		'brand' => [
			'simple' => [
				'name_en'      => false,
				'logo_text'    => false,
				'brand_color'  => false,
				'seo_anchor'   => false,
				'seo_desc'     => false,
				'brand_class'  => false,
				'country'      => false,
				'founded_year' => false,
				'headquarters' => false,
				'official_url' => false,
			],
			'repeaters' => [],
		],
		'category' => [
			'simple'    => [
				'keyword'   => false,
				'aka'       => false,
				'icon_path' => false,
			],
			'repeaters' => [],
		],
	];
}

/** انواع بلوک مجاز — باید با choices در ACF یکی بماند. */
function cyh_hub_block_types() {
	return [ 'text', 'table', 'faq', 'parts', 'media', 'specs', 'callout' ];
}

/**
 * قالب نویسنده → ردیف‌های ریپیتر ACF.
 *
 * ⚠️ عمداً شکل JSON با شکل ACF یکی **نیست**. شکل ACF برای ماشین خوب است
 * (`col1..col5`، `c1..c5`) ولی برای انسانی که محتوا می‌نویسد فاجعه است.
 * قالب نویسنده ساده است:
 *
 *   { "type": "table", "heading": "…",
 *     "columns": ["سری", "نوع"], "rows": [["DH", "سیم‌بکسلی"]] }
 *
 * و تبدیل، اینجا یک بار انجام می‌شود. اگر نویسنده مجبور باشد به شکل ACF
 * بنویسد، اولین اشتباهش بی‌صدا یک ستون را خالی می‌گذارد.
 *
 * @param array $blocks بلوک‌ها به قالب نویسنده.
 * @return array{0:array,1:array} [ ردیف‌های ACF، فهرست خطاها ]
 */
function cyh_hub_blocks_to_acf( $blocks ) {
	$rows   = [];
	$errors = [];
	$types  = cyh_hub_block_types();

	foreach ( (array) $blocks as $i => $b ) {
		$n = $i + 1;
		if ( ! is_array( $b ) ) {
			$errors[] = "بلوک #$n یک شیء نیست.";
			continue;
		}

		$type = sanitize_key( (string) ( $b['type'] ?? '' ) );
		if ( ! in_array( $type, $types, true ) ) {
			$errors[] = "بلوک #$n نوع نامعتبر دارد: «" . esc_html( (string) ( $b['type'] ?? '' ) ) . '».';
			continue;
		}

		$row = [
			'block_type'   => $type,
			'heading'      => cyh_hub_clean( $b['heading'] ?? '', false ),
			'needs_review' => in_array( $b['needs_review'] ?? false, [ true, 1, '1', 'true' ], true ) ? 1 : 0,
			'body'         => '',
			'intro'        => cyh_hub_clean( $b['intro'] ?? '', false ),
			'col1' => '', 'col2' => '', 'col3' => '', 'col4' => '', 'col5' => '',
			'rows' => [], 'faqs' => [], 'parts' => [], 'media' => [], 'specs' => [],
			'tone' => 'note', 'callout_body' => '',
		];

		if ( 'text' === $type ) {
			$row['body'] = cyh_hub_clean( $b['body'] ?? '', true );
			if ( '' === trim( (string) $row['body'] ) ) {
				$errors[] = "بلوک #$n از نوع text است ولی `body` ندارد — روی سایت دیده نمی‌شود.";
			}
		}

		if ( 'table' === $type ) {
			$cols = array_slice( array_values( (array) ( $b['columns'] ?? [] ) ), 0, 5 );
			foreach ( $cols as $c => $label ) {
				$row[ 'col' . ( $c + 1 ) ] = cyh_hub_clean( $label, false );
			}
			foreach ( (array) ( $b['rows'] ?? [] ) as $r ) {
				$cells = array_slice( array_values( (array) $r ), 0, 5 );
				$out   = [];
				foreach ( $cells as $c => $cell ) {
					$out[ 'c' . ( $c + 1 ) ] = cyh_hub_clean( $cell, false );
				}
				if ( $out ) {
					$row['rows'][] = $out;
				}
			}
			if ( ! $cols || ! $row['rows'] ) {
				$errors[] = "بلوک #$n از نوع table است ولی ستون یا ردیف ندارد — روی سایت دیده نمی‌شود.";
			}
		}

		if ( 'faq' === $type ) {
			foreach ( (array) ( $b['faqs'] ?? [] ) as $f ) {
				$q = cyh_hub_clean( $f['q'] ?? ( $f['question'] ?? '' ), false );
				$a = cyh_hub_clean( $f['a'] ?? ( $f['answer'] ?? '' ), false );
				if ( '' !== $q ) {
					$row['faqs'][] = [ 'question' => $q, 'answer' => $a ];
				}
			}
			if ( ! $row['faqs'] ) {
				$errors[] = "بلوک #$n از نوع faq است ولی هیچ پرسشی ندارد.";
			}
		}

		if ( 'specs' === $type ) {
			foreach ( (array) ( $b['specs'] ?? [] ) as $x ) {
				$label = cyh_hub_clean( $x['label'] ?? '', false );
				$value = cyh_hub_clean( $x['value'] ?? '', false );
				if ( '' !== $label && '' !== $value ) {
					$row['specs'][] = [
						'label' => $label,
						'value' => $value,
						'unit'  => cyh_hub_clean( $x['unit'] ?? '', false ),
					];
				}
			}
			if ( ! $row['specs'] ) {
				$errors[] = "بلوک #$n از نوع specs است ولی هیچ مشخصه‌ی کاملی ندارد (هر مشخصه label و value لازم دارد).";
			}
		}

		if ( 'callout' === $type ) {
			$tone         = sanitize_key( (string) ( $b['tone'] ?? 'note' ) );
			$row['tone']  = in_array( $tone, [ 'danger', 'note', 'tip' ], true ) ? $tone : 'note';
			$row['callout_body'] = cyh_hub_clean( $b['body'] ?? '', false );
			if ( '' === trim( (string) $row['callout_body'] ) ) {
				$errors[] = "بلوک #$n از نوع callout است ولی `body` ندارد.";
			}
		}

		if ( 'parts' === $type ) {
			foreach ( (array) ( $b['parts'] ?? [] ) as $pt ) {
				$name = cyh_hub_clean( $pt['name'] ?? ( $pt['part_name'] ?? '' ), false );
				if ( '' === $name ) {
					continue;
				}
				// ⚠️ فیلد taxonomy شناسه‌ی ترم می‌خواهد نه اسلاگ. اسلاگِ خام،
				//    یک ارجاع شکسته‌ی بی‌صدا می‌سازد.
				$slug = sanitize_title( (string) ( $pt['category'] ?? '' ) );
				$term = $slug ? get_term_by( 'slug', $slug, 'crane_category' ) : null;
				if ( $slug && ( ! $term || is_wp_error( $term ) ) ) {
					$errors[] = "بلوک #$n: دسته‌ی «" . esc_html( $slug ) . '» پیدا نشد — لینک قطعه خالی می‌ماند.';
				}
				$row['parts'][] = [
					'part_name'      => $name,
					'category'       => ( $term && ! is_wp_error( $term ) ) ? (int) $term->term_id : '',
					'failure_reason' => cyh_hub_clean( $pt['reason'] ?? ( $pt['failure_reason'] ?? '' ), false ),
				];
			}
			if ( ! $row['parts'] ) {
				$errors[] = "بلوک #$n از نوع parts است ولی هیچ قطعه‌ای ندارد.";
			}
		}

		if ( 'media' === $type ) {
			$errors[] = "بلوک #$n از نوع media است. رسانه باید از پنل انتخاب شود، نه از JSON — این بلوک رد شد.";
			continue;
		}

		$rows[] = $row;
	}

	return [ $rows, $errors ];
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

	/* ⚠️ جمعِ انگلیسی با چسباندن «s» ساخته نمی‌شود.
	   کد قبلی `$kind . 's'` بود: برای brand می‌شد «brands» و درست بود، ولی
	   برای category می‌شد **«categorys»** — کلیدی که در هیچ فایلی وجود
	   ندارد. نتیجه: حلقه هرگز اجرا نمی‌شد، گزارش خالی برمی‌گشت، صفر فیلد
	   نوشته می‌شد و **هیچ خطایی هم داده نمی‌شد**.
	   یعنی ورود دسته از این ابزار هیچ‌وقت کار نکرده بود و کسی نفهمید. */
	$ROOT_KEYS = [ 'brand' => 'brands', 'category' => 'categories' ];

	// کلیدی در فایل که نمی‌شناسیم، باید گفته شود نه بلعیده.
	foreach ( array_keys( (array) $payload ) as $key ) {
		if ( '_' === substr( (string) $key, 0, 1 ) ) {
			continue; // «_راهنما» و مانندش عمداً نادیده گرفته می‌شوند.
		}
		if ( ! in_array( $key, $ROOT_KEYS, true ) ) {
			$report[] = [
				'—',
				'—',
				(string) $key,
				'⚠ کلید ناشناخته در فایل — نادیده گرفته شد. کلیدهای معتبر: '
					. implode( '، ', $ROOT_KEYS ),
			];
		}
	}

	foreach ( $ROOT_KEYS as $kind => $root ) {
		foreach ( (array) ( $payload[ $root ] ?? [] ) as $slug => $fields ) {
			$slug   = sanitize_title( (string) $slug );
			$target = cyh_hub_locate( $kind, $slug );

			if ( ! $target ) {
				$missing[] = "$kind:$slug";
				continue;
			}

			foreach ( (array) $fields as $name => $raw ) {
				/* ── بلوک‌های محتوا ───────────────────────────────────────
				   ⚠️ مسیر جدا دارد چون شکل ورودی‌اش «قالب نویسنده» است، نه
				   شکل ACF. تبدیل در `cyh_hub_blocks_to_acf()` انجام می‌شود
				   و هر بلوکی که روی سایت دیده **نمی‌شود** همان‌جا گزارش
				   می‌گیرد — به‌جای اینکه بی‌صدا خالی بماند. */
				if ( 'blocks' === $name ) {
					list( $acf_rows, $block_errors ) = cyh_hub_blocks_to_acf( $raw );

					foreach ( $block_errors as $msg ) {
						$report[] = [ $kind, $slug, 'blocks', '⚠ ' . $msg ];
					}

					$current = get_field( 'content_blocks', $target );
					$has_now = is_array( $current ) && ! empty( $current );

					if ( $has_now && ! $overwrite ) {
						$skipped++;
						$report[] = [ $kind, $slug, 'blocks', 'رد شد (از قبل ' . count( $current ) . ' بلوک دارد)' ];
						continue;
					}
					if ( ! $acf_rows ) {
						$report[] = [ $kind, $slug, 'blocks', 'هیچ بلوک معتبری در فایل نبود' ];
						continue;
					}

					if ( ! $dry_run ) {
						update_field( 'content_blocks', $acf_rows, $target );
					}

					$written++;
					$kinds = [];
					foreach ( $acf_rows as $r ) {
						$kinds[ $r['block_type'] ] = ( $kinds[ $r['block_type'] ] ?? 0 ) + 1;
					}
					$sum = [];
					foreach ( $kinds as $k => $c ) {
						$sum[] = "{$k}×{$c}";
					}
					$report[] = [
						$kind,
						$slug,
						'blocks',
						( $dry_run ? 'نوشته می‌شود' : 'نوشته شد' ) . ' — ' . implode( '، ', $sum ),
					];
					continue;
				}

				$is_simple   = array_key_exists( $name, $map[ $kind ]['simple'] );
				$is_repeater = in_array( $name, $map[ $kind ]['repeaters'], true );
				if ( ! $is_simple && ! $is_repeater ) {
					$report[] = [ $kind, $slug, $name, '⚠ فیلد ناشناخته — نادیده گرفته شد' ];
					continue;
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

	// گزارش خالی یعنی «هیچ موجودیتی در فایل نبود» — و باید همین را بگوید،
	// نه اینکه یک جدول بی‌ردیف نشان بدهد و کاربر حدس بزند.
	if ( ! $report ) {
		$report[] = [
			'—',
			'—',
			'—',
			'هیچ برند یا دسته‌ای در فایل پیدا نشد. ساختار فایل باید '
				. '{"categories": {"اسلاگ": {...}}} یا {"brands": {...}} باشد.',
		];
	}

	return [ 'rows' => $report, 'written' => $written, 'skipped' => $skipped, 'missing' => $missing ];
}


/**
 * تنها مسیر رندرِ جدول گزارش.
 *
 * ⚠️ چرا یک تابع، نه HTML دستی در هر نقطه:
 *
 * جدول مهاجرت بلوک‌ها **سه** ستون داشت در حالی که هر ردیف **چهار** مقدار
 * برمی‌گرداند. نتیجه کاملاً بی‌صدا بود:
 *
 *     اسلاگ زیر ستون «حجم» می‌نشست،
 *     حجم زیر ستون «نتیجه»،
 *     و متن نتیجه — تنها چیزی که کاربر بر اساسش تصمیم می‌گیرد — هرگز چاپ نمی‌شد.
 *
 * PHP هیچ شکایتی نمی‌کند وقتی اندیسی از یک آرایه **خوانده نشود**. پس این
 * دسته خرابی هیچ‌وقت خودش را نشان نمی‌دهد؛ فقط یک جدول آبرومند نشان می‌دهد
 * که محتوایش دروغ است. بدترین حالت ممکن برای صفحه‌ای که کارفرما پیش از
 * زدن دکمه‌ی «انتقال بده» به آن نگاه می‌کند.
 *
 * حالا تعداد ستون از خودِ ردیف بررسی می‌شود و ناهماهنگی **قرمز** چاپ
 * می‌شود، به‌جای اینکه ستون‌ها را بلغزاند.
 *
 * @param array       $cols     [ برچسب => عرض CSS ]؛ عرض خالی یعنی ستون کشسان.
 * @param array       $rows     ردیف‌ها؛ هر ردیف باید هم‌اندازه‌ی $cols باشد.
 * @param array       $code     اندیس ستون‌هایی که با <code> نمایش داده شوند.
 * @param string|null $dim_when اگر ستون آخر شامل این متن بود، ردیف کم‌رنگ شود.
 */
function cyh_hub_table( array $cols, array $rows, array $code = [], $dim_when = null ) {
	$n = count( $cols );

	echo '<table class="widefat striped" style="max-width:900px;margin-top:8px"><thead><tr>';
	foreach ( $cols as $label => $width ) {
		printf(
			'<th%s>%s</th>',
			$width ? ' style="width:' . esc_attr( $width ) . '"' : '',
			esc_html( $label )
		);
	}
	echo '</tr></thead><tbody>';

	foreach ( array_values( $rows ) as $i => $row ) {
		$row = array_values( (array) $row );

		// ناهماهنگی بلعیده نمی‌شود — همین بلعیدن بود که گزارش را دروغ‌گو کرد.
		if ( count( $row ) !== $n ) {
			printf(
				'<tr style="background:#fcf0f1"><td colspan="%d"><strong>ردیف %d خراب است:</strong> ' .
				'%d مقدار برای %d ستون — این یک باگ است، نه داده. مقدار خام: <code>%s</code></td></tr>',
				$n,
				(int) $i + 1,
				count( $row ),
				$n,
				esc_html( (string) wp_json_encode( $row, JSON_UNESCAPED_UNICODE ) )
			);
			continue;
		}

		$last = (string) $row[ $n - 1 ];
		echo ( null !== $dim_when && false !== strpos( $last, $dim_when ) )
			? '<tr style="opacity:.55">'
			: '<tr>';

		foreach ( $row as $c => $cell ) {
			printf(
				in_array( $c, $code, true ) ? '<td><code>%s</code></td>' : '<td>%s</td>',
				esc_html( (string) $cell )
			);
		}
		echo '</tr>';
	}

	echo '</tbody></table>';
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

	/* ⚠️ این خطا stash می‌شد ولی **هیچ‌وقت خوانده نمی‌شد**. یعنی اگر فایلی
	   انتخاب نمی‌شد یا JSON خراب بود، کاربر هیچ پیامی نمی‌دید و صفحه
	   بی‌تفاوت بارگذاری می‌شد. */
	$fatal = cyh_hub_take( 'error' );
	if ( $fatal ) {
		printf(
			'<div class="notice notice-error"><p><strong>ورود انجام نشد:</strong> %s</p></div>',
			esc_html( (string) $fatal )
		);
	}

	$report = cyh_hub_take( 'report' );
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
		cyh_hub_table(
			[ 'نوع' => '80px', 'اسلاگ' => '170px', 'فیلد' => '190px', 'نتیجه' => '' ],
			(array) ( $r['rows'] ?? [] ),
			[ 1, 2 ]
		);
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
