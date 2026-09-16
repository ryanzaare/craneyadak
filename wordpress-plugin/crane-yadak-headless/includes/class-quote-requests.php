<?php
/**
 * سبد استعلام و درخواست پیش‌فاکتور.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ چرا این «سبد خرید» نیست — و عمداً نیست
 *
 * پیشنهاد اولیه یک سبد خرید سمت کلاینت به‌همراه تسویه‌حساب مهمان بود. آن
 * طراحی با سه واقعیتِ همین کسب‌وکار در تضاد است:
 *
 *   ۱) مدیرعامل صراحتاً گفت قیمت‌ها در این بازار قطعی نیستند — به همین
 *      دلیل نمودار تاریخچه‌ی قیمت حذف شد. سایتی که قیمت را برای نمودار
 *      به‌اندازه‌ی کافی پایدار نمی‌داند، نمی‌تواند همان قیمت را مبنای
 *      فروش قطعی آنلاین قرار دهد. این تناقض به اختلاف با مشتری ختم
 *      می‌شود، نه به فروش.
 *   ۲) پرداخت آنلاین در ایران به درگاه بانکی و نماد اعتماد الکترونیکی
 *      نیاز دارد. هیچ‌کدام هنوز وجود ندارند. دکمه‌ی «پرداخت» بدون درگاه،
 *      همان دکمه‌ی مرده‌ای است که الان داریم.
 *   ۳) خرید صنعتی چندنفره است: مهندس نت قطعه را انتخاب می‌کند، مدیر خرید
 *      با «پیش‌فاکتور رسمی» آن را تایید می‌کند. سبد خریدی که به «پرداخت
 *      کنید» ختم شود، وسط این زنجیره می‌افتد و کاری از پیش نمی‌برد.
 *
 * پس به‌جای سبد خرید، «سبد استعلام» ساخته شد: کاربر چند قطعه را جمع
 * می‌کند و یک درخواست پیش‌فاکتور می‌فرستد.
 *
 * شکاف واقعی هم دقیقاً همین بود: استعلام تا امروز تک‌محصولی بود، در حالی
 * که یک اورهال معمولی به پنج قطعه‌ی هم‌زمان نیاز دارد و کاربر مجبور بود
 * پنج بار فرم پر کند یا بی‌خیال شود.
 * ---------------------------------------------------------------------------
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const CYH_QUOTE_CPT = 'cyh_quote';

/* =========================================================================
   ۱) نوع محتوا — درخواست‌ها در پایگاه داده می‌مانند، نه فقط در ایمیل
   ========================================================================= */

/**
 * چرا CPT و نه فقط ایمیل: ایمیل گم می‌شود، فیلتر اسپم می‌خورد و قابل
 * پیگیری نیست. درخواست ثبت‌شده در پنل، وضعیت دارد و می‌توان بعداً
 * پیگیری کرد که کدام استعلام به فروش رسید.
 *
 * `show_in_graphql` عمداً false است: این داده‌ی خصوصی مشتری است و هیچ
 * دلیلی ندارد در گراف عمومی سایت استاتیک ظاهر شود.
 */
function cyh_register_quote_cpt() {
	register_post_type(
		CYH_QUOTE_CPT,
		[
			'labels'          => [
				'name'          => 'درخواست‌های استعلام',
				'singular_name' => 'درخواست استعلام',
				'menu_name'     => 'درخواست‌های استعلام',
				'all_items'     => 'همه‌ی درخواست‌ها',
				'search_items'  => 'جستجوی درخواست',
				'not_found'     => 'درخواستی ثبت نشده است.',
			],
			'public'          => false,
			'show_ui'         => true,
			/* ⚠️ قبلاً زیر «محصولات» بود. درخواست خرید مشتری، محصول نیست —
			   مهم‌ترین صندوق ورودی کسب‌وکار است و نباید زیر یک منوی دیگر
			   پنهان شود. منوی مستقل با نشان زنگوله. */
			'show_in_menu'    => true,
			'menu_icon'       => 'dashicons-bell',
			'menu_position'   => 27,
			'show_in_graphql' => false,
			'supports'        => [ 'title' ],
			'capability_type' => 'post',
			'map_meta_cap'    => true,
			'capabilities'    => [ 'create_posts' => 'do_not_allow' ], // فقط از فرم سایت
		]
	);
}
add_action( 'init', 'cyh_register_quote_cpt' );

/* =========================================================================
   ۲) اندپوینت REST
   ========================================================================= */
function cyh_register_quote_route() {
	register_rest_route(
		'crane-yadak/v1',
		'/quote',
		[
			'methods'             => 'POST',
			'permission_callback' => '__return_true',
			'callback'            => 'cyh_rest_submit_quote',
		]
	);
}
add_action( 'rest_api_init', 'cyh_register_quote_route' );

/** کد رهگیری کوتاه و قابل خواندن روی تلفن. */
function cyh_generate_tracking_code() {
	// بدون حروف مبهم (I/O/0/1) — کد باید پای تلفن بدون اشتباه خوانده شود.
	$alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	$code     = '';
	for ( $i = 0; $i < 6; $i++ ) {
		$code .= $alphabet[ random_int( 0, strlen( $alphabet ) - 1 ) ];
	}
	return 'CY-' . $code;
}

/**
 * ثبت درخواست استعلام.
 *
 * ⚠️ اعتبارسنجی روی سرور انجام می‌شود، نه فقط در مرورگر. اعتبارسنجی
 * سمت کلاینت برای تجربه‌ی کاربر است؛ هر کسی می‌تواند مستقیم به اندپوینت
 * درخواست بفرستد.
 */
function cyh_rest_submit_quote( $request ) {
	// تله‌ی ربات — فیلد پنهانی که انسان پر نمی‌کند.
	if ( '' !== trim( (string) $request->get_param( 'website' ) ) ) {
		return new WP_REST_Response( [ 'ok' => true, 'message' => 'ثبت شد.' ], 200 );
	}

	$name  = sanitize_text_field( (string) $request->get_param( 'name' ) );
	$phone = sanitize_text_field( (string) $request->get_param( 'phone' ) );
	$org   = sanitize_text_field( (string) $request->get_param( 'organization' ) );
	$note  = sanitize_textarea_field( (string) $request->get_param( 'note' ) );
	$items = $request->get_param( 'items' );

	if ( '' === $name || '' === $phone ) {
		return new WP_REST_Response(
			[ 'ok' => false, 'message' => 'نام و شماره تماس الزامی است.' ],
			400
		);
	}

	// شماره‌ی ایران: ارقام فارسی/عربی هم پذیرفته و به لاتین تبدیل می‌شوند،
	// چون کاربر با کیبورد فارسی عدد فارسی تایپ می‌کند.
	$phone_latin = strtr(
		$phone,
		[
			'۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
			'۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
			'٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
			'٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
		]
	);
	$digits = preg_replace( '/\D/', '', $phone_latin );
	if ( strlen( $digits ) < 10 || strlen( $digits ) > 13 ) {
		return new WP_REST_Response(
			[ 'ok' => false, 'message' => 'شماره تماس معتبر نیست.' ],
			400
		);
	}

	if ( ! is_array( $items ) || count( $items ) === 0 ) {
		return new WP_REST_Response(
			[ 'ok' => false, 'message' => 'سبد استعلام خالی است.' ],
			400
		);
	}

	// سقف تعداد اقلام — جلوگیری از ارسال حجیم مخرب.
	$items = array_slice( $items, 0, 50 );

	$clean_items = [];
	foreach ( $items as $item ) {
		if ( ! is_array( $item ) ) {
			continue;
		}
		$slug = sanitize_title( (string) ( $item['slug'] ?? '' ) );
		if ( '' === $slug ) {
			continue;
		}
		/**
		 * ⚠️ قیمت از سبد کاربر پذیرفته *نمی‌شود* — از وردپرس خوانده می‌شود.
		 *
		 * سبد در localStorage مرورگر است و کاربر می‌تواند آزادانه آن را
		 * ویرایش کند. اگر قیمت ارسالی مرورگر را ذخیره کنیم، هر کسی
		 * می‌تواند سفارشی با قیمت دلخواه ثبت کند و بعد ادعا کند سایت
		 * همان را تایید کرده است. قیمت لحظه‌ی ثبت، مستقیم از فیلد ACF
		 * همان محصول در پایگاه داده خوانده می‌شود.
		 */
		$product   = get_page_by_path( $slug, OBJECT, 'product' );
		$buy_mode  = 'rfq';
		$unit      = null;

		/* ⚠️ گارد ACF: اگر افزونه‌ی ACF غیرفعال باشد، get_field وجود ندارد
		   و فراخوانی‌اش خطای مرگبار می‌دهد — یعنی ثبت سفارش مشتری با
		   خطای ۵۰۰ شکست می‌خورد، فقط چون یک افزونه غیرفعال شده. در آن
		   حالت همه‌چیز امن‌ترین مسیر یعنی «استعلام» می‌شود. */
		if ( $product && function_exists( 'get_field' ) ) {
			$mode = get_field( 'buy_mode', $product->ID );
			$raw  = get_field( 'sale_price', $product->ID );
			if ( '' === $raw || null === $raw ) {
				$raw = get_field( 'price', $product->ID );
			}
			$numeric = is_numeric( $raw ) ? (float) $raw : null;

			// «خرید مستقیم» فقط وقتی معنا دارد که هم حالت cart باشد و هم
			// قیمت واقعی ثبت شده باشد. یکی بدون دیگری بی‌معناست.
			if ( 'cart' === $mode && null !== $numeric && $numeric > 0 ) {
				$buy_mode = 'cart';
				$unit     = $numeric;
			}
		}

		$clean_items[] = [
			'slug'     => $slug,
			'name'     => sanitize_text_field( (string) ( $item['name'] ?? '' ) ),
			'sku'      => sanitize_text_field( (string) ( $item['sku'] ?? '' ) ),
			'qty'      => max( 1, min( 9999, (int) ( $item['qty'] ?? 1 ) ) ),
			'buy_mode' => $buy_mode,
			'unit'     => $unit,
		];
	}

	if ( count( $clean_items ) === 0 ) {
		return new WP_REST_Response(
			[ 'ok' => false, 'message' => 'هیچ قطعه‌ی معتبری در درخواست نبود.' ],
			400
		);
	}

	/**
	 * نوع درخواست از خودِ اقلام استنتاج می‌شود، نه از انتخاب کاربر.
	 *
	 *   • همه‌ی اقلام دارای قیمت قطعی  → «سفارش» (order)
	 *   • حتی یک قلم استعلامی          → «استعلام» (quote)
	 *
	 * ⚠️ چرا حتی یک قلم استعلامی کل درخواست را استعلامی می‌کند: اگر
	 * سفارشی نیمی قیمت‌دار و نیمی نامعلوم باشد، مبلغ نهایی معلوم نیست.
	 * وانمود کردن به این‌که «سفارش قطعی» است، همان تناقضی است که به
	 * اختلاف با مشتری ختم می‌شود.
	 */
	$all_priced = true;
	$estimate   = 0.0;
	foreach ( $clean_items as $item ) {
		if ( 'cart' !== $item['buy_mode'] || null === $item['unit'] ) {
			$all_priced = false;
			break;
		}
		$estimate += $item['unit'] * $item['qty'];
	}
	$kind = $all_priced ? 'order' : 'quote';

	$code = cyh_generate_tracking_code();

	$post_id = wp_insert_post(
		[
			'post_type'   => CYH_QUOTE_CPT,
			'post_status' => 'publish',
			'post_title'  => sprintf(
				'%s — %s (%s، %d قلم)',
				$code,
				$name,
				'order' === $kind ? 'سفارش' : 'استعلام',
				count( $clean_items )
			),
		],
		true
	);

	if ( is_wp_error( $post_id ) ) {
		return new WP_REST_Response(
			[ 'ok' => false, 'message' => 'ثبت درخواست ناموفق بود. لطفاً تماس بگیرید.' ],
			500
		);
	}

	update_post_meta( $post_id, 'cyh_code', $code );
	update_post_meta( $post_id, 'cyh_name', $name );
	update_post_meta( $post_id, 'cyh_phone', $digits );
	update_post_meta( $post_id, 'cyh_org', $org );
	update_post_meta( $post_id, 'cyh_note', $note );
	/**
	 * ⚠️ آرایه مستقیم ذخیره می‌شود، نه JSON — رفع باگ نمایش یونیکد.
	 *
	 * نسخه‌ی قبل `wp_json_encode()` بود. آن تابع به‌صورت پیش‌فرض کاراکتر
	 * غیرلاتین را به دنباله‌ی فرار تبدیل می‌کند: «لنت» می‌شود
	 * `\u0644\u0646\u062a`. تا اینجا مشکلی نیست چون json_decode آن را
	 * برمی‌گرداند — اما وردپرس هنگام ذخیره‌ی متا، بک‌اسلش‌ها را حذف
	 * می‌کند. نتیجه در پایگاه داده `u0644u0646u062a` است: یک رشته‌ی JSON
	 * *معتبر* که محتوایش دیگر فارسی نیست. به همین دلیل در پنل به‌جای نام
	 * قطعه، همان متن خام دیده می‌شد.
	 *
	 * راه‌حل درست، JSON_UNESCAPED_UNICODE نیست — آن هم به بک‌اسلش‌های
	 * دیگر (مثل `/`) حساس می‌ماند. راه‌حل این است که اصلاً از JSON عبور
	 * نکنیم: وردپرس آرایه‌ی PHP را خودش با `maybe_serialize()` ذخیره و
	 * موقع خواندن باز می‌کند. هیچ فراری، هیچ بک‌اسلشی، هیچ ابهامی.
	 */
	update_post_meta( $post_id, 'cyh_items', $clean_items );
	update_post_meta( $post_id, 'cyh_status', 'new' );
	update_post_meta( $post_id, 'cyh_kind', $kind );
	update_post_meta( $post_id, 'cyh_estimate', $all_priced ? $estimate : '' );

	/**
	 * اطلاع‌رسانی به واحد فروش.
	 * ⚠️ اگر ایمیل نرود، درخواست از بین نمی‌رود — در پنل ثبت شده است.
	 * به همین دلیل نتیجه‌ی wp_mail بررسی نمی‌شود و خطایش به کاربر
	 * برنمی‌گردد: درخواستِ او واقعاً ثبت شده و گفتن «خطا» دروغ است.
	 */
	$lines = [];
	foreach ( $clean_items as $item ) {
		$lines[] = sprintf(
			'- %s%s × %d',
			$item['name'] ? $item['name'] : $item['slug'],
			$item['sku'] ? ' (کد ' . $item['sku'] . ')' : '',
			$item['qty']
		);
	}
	wp_mail(
		get_option( 'admin_email' ),
		sprintf( 'درخواست استعلام جدید %s', $code ),
		implode(
			"\n",
			[
				'کد رهگیری: ' . $code,
				'نام: ' . $name,
				'تلفن: ' . $digits,
				'سازمان: ' . ( $org ? $org : '—' ),
				'',
				'اقلام:',
				implode( "\n", $lines ),
				'',
				'توضیح: ' . ( $note ? $note : '—' ),
			]
		)
	);

	return new WP_REST_Response(
		[
			'ok'      => true,
			'code'    => $code,
			'kind'    => $kind,
			'message' => 'order' === $kind
				? sprintf( 'سفارش شما ثبت شد. کد رهگیری: %s — کارشناس برای هماهنگی پرداخت و ارسال تماس می‌گیرد.', $code )
				: sprintf( 'درخواست شما ثبت شد. کد رهگیری: %s', $code ),
		],
		200
	);
}

/**
 * خواندن اقلام — با سازگاری عقب‌رو.
 *
 * درخواست‌هایی که پیش از رفع باگ ثبت شده‌اند، هنوز رشته‌ی JSON (و احتمالاً
 * مخدوش) در پایگاه داده دارند. این تابع هر دو حالت را می‌خواند تا
 * رکوردهای قدیمی از دست نروند.
 */
function cyh_get_quote_items( $post_id ) {
	$raw = get_post_meta( $post_id, 'cyh_items', true );

	if ( is_array( $raw ) ) {
		return $raw;
	}

	if ( is_string( $raw ) && '' !== $raw ) {
		$decoded = json_decode( $raw, true );
		if ( is_array( $decoded ) ) {
			// رکورد قدیمیِ مخدوش: `u0644…` را به کاراکتر واقعی برگردان.
			foreach ( $decoded as $i => $item ) {
				if ( isset( $item['name'] ) && is_string( $item['name'] ) ) {
					$decoded[ $i ]['name'] = preg_replace_callback(
						'/u([0-9a-fA-F]{4})/',
						static function ( $m ) {
							return mb_convert_encoding( pack( 'n', hexdec( $m[1] ) ), 'UTF-8', 'UTF-16BE' );
						},
						$item['name']
					);
				}
			}
			return $decoded;
		}
	}

	return [];
}

/* =========================================================================
   ۳) نمایش در پنل
   ========================================================================= */
function cyh_quote_columns( $columns ) {
	return [
		'cb'         => $columns['cb'] ?? '',
		'title'      => 'درخواست',
		'cyh_phone'  => 'تلفن',
		'cyh_org'    => 'سازمان',
		'cyh_items'  => 'اقلام',
		'date'       => 'تاریخ',
	];
}
add_filter( 'manage_' . CYH_QUOTE_CPT . '_posts_columns', 'cyh_quote_columns' );

function cyh_quote_column_content( $column, $post_id ) {
	if ( 'cyh_phone' === $column ) {
		$phone = get_post_meta( $post_id, 'cyh_phone', true );
		printf( '<a href="tel:%s" dir="ltr">%s</a>', esc_attr( $phone ), esc_html( $phone ) );
		return;
	}
	if ( 'cyh_org' === $column ) {
		echo esc_html( get_post_meta( $post_id, 'cyh_org', true ) ?: '—' );
		return;
	}
	if ( 'cyh_items' === $column ) {
		$items = cyh_get_quote_items( $post_id );
		if ( empty( $items ) ) {
			echo '—';
			return;
		}
		echo '<ul style="margin:0">';
		foreach ( $items as $item ) {
			printf(
				'<li>%s%s × %d</li>',
				esc_html( $item['name'] ?: $item['slug'] ),
				$item['sku'] ? ' <code>' . esc_html( $item['sku'] ) . '</code>' : '',
				(int) $item['qty']
			);
		}
		echo '</ul>';
	}
}
add_action( 'manage_' . CYH_QUOTE_CPT . '_posts_custom_column', 'cyh_quote_column_content', 10, 2 );

/** جزئیات کامل در صفحه‌ی ویرایش. */
function cyh_quote_metabox() {
	add_meta_box(
		'cyh_quote_details',
		'جزئیات درخواست',
		function ( $post ) {
			$items = cyh_get_quote_items( $post->ID );
			printf(
				'<p><strong>کد رهگیری:</strong> <code>%s</code></p>' .
				'<p><strong>نام:</strong> %s</p>' .
				'<p><strong>تلفن:</strong> <a href="tel:%s" dir="ltr">%s</a></p>' .
				'<p><strong>سازمان:</strong> %s</p>',
				esc_html( get_post_meta( $post->ID, 'cyh_code', true ) ),
				esc_html( get_post_meta( $post->ID, 'cyh_name', true ) ),
				esc_attr( get_post_meta( $post->ID, 'cyh_phone', true ) ),
				esc_html( get_post_meta( $post->ID, 'cyh_phone', true ) ),
				esc_html( get_post_meta( $post->ID, 'cyh_org', true ) ?: '—' )
			);

			echo '<p><strong>اقلام درخواستی:</strong></p><ol>';
			if ( ! empty( $items ) ) {
				foreach ( $items as $item ) {
					printf(
						'<li>%s%s — تعداد %d</li>',
						esc_html( $item['name'] ?: $item['slug'] ),
						$item['sku'] ? ' (کد ' . esc_html( $item['sku'] ) . ')' : '',
						(int) $item['qty']
					);
				}
			}
			echo '</ol>';

			$note = get_post_meta( $post->ID, 'cyh_note', true );
			if ( $note ) {
				printf( '<p><strong>توضیح مشتری:</strong><br>%s</p>', esc_html( $note ) );
			}
		},
		CYH_QUOTE_CPT,
		'normal',
		'high'
	);
}
add_action( 'add_meta_boxes', 'cyh_quote_metabox' );

/* =========================================================================
   ۴) گردش کار پاسخ — از درخواست تا پیش‌فاکتور
   =========================================================================
   ⚠️ شکافی که این بخش پر می‌کند:
   تا اینجا درخواست مشتری در پنل ثبت می‌شد و بعد… هیچ. هیچ مسیری برای
   پاسخ دادن وجود نداشت، و مشتری هیچ راهی نداشت وضعیت را ببیند. یعنی
   فرم ثبت درخواست عملاً یک صندوق پستی یک‌طرفه بود.

   گردش کار حالا چهار وضعیت دارد و مشتری در هر لحظه می‌تواند وضعیت
   خودش را ببیند — بدون ساختن حساب کاربری.
   ========================================================================= */

/** وضعیت‌های مجاز درخواست. */
function cyh_quote_statuses() {
	return [
		'new'         => 'جدید — بررسی نشده',
		'in_progress' => 'در حال بررسی فنی',
		'answered'    => 'پاسخ داده شد — پیش‌فاکتور صادر شد',
		'closed'      => 'بسته شده',
	];
}

/** جعبه‌ی پاسخ واحد فروش. */
function cyh_quote_response_metabox() {
	add_meta_box(
		'cyh_quote_response',
		'پاسخ واحد فروش',
		function ( $post ) {
			wp_nonce_field( 'cyh_save_quote_response', 'cyh_quote_nonce' );

			$status   = get_post_meta( $post->ID, 'cyh_status', true ) ?: 'new';
			$response = get_post_meta( $post->ID, 'cyh_response', true );
			$file     = get_post_meta( $post->ID, 'cyh_proforma_url', true );

			echo '<p><label for="cyh_status"><strong>وضعیت درخواست</strong></label><br>';
			echo '<select id="cyh_status" name="cyh_status" style="min-width:280px">';
			foreach ( cyh_quote_statuses() as $key => $label ) {
				printf(
					'<option value="%s"%s>%s</option>',
					esc_attr( $key ),
					selected( $status, $key, false ),
					esc_html( $label )
				);
			}
			echo '</select></p>';

			echo '<p><label for="cyh_response"><strong>متن پاسخ به مشتری</strong></label><br>';
			echo '<span class="description">این متن دقیقاً همان چیزی است که مشتری در صفحه‌ی پیگیری می‌بیند. قیمت، مهلت اعتبار و شرایط تحویل را اینجا بنویسید.</span><br>';
			printf(
				'<textarea id="cyh_response" name="cyh_response" rows="6" style="width:100%%">%s</textarea></p>',
				esc_textarea( $response )
			);

			echo '<p><label for="cyh_proforma_url"><strong>فایل پیش‌فاکتور (اختیاری)</strong></label><br>';
			printf(
				'<input type="url" id="cyh_proforma_url" name="cyh_proforma_url" value="%s" style="width:100%%" dir="ltr" placeholder="https://…">',
				esc_attr( $file )
			);
			echo ' <button type="button" class="button" id="cyh-pick-file">انتخاب از کتابخانه رسانه</button>';
			echo '<br><span class="description">فایل PDF پیش‌فاکتور را در «رسانه» بارگذاری و اینجا انتخاب کنید. لینک برای مشتری در صفحه‌ی پیگیری نمایش داده می‌شود.</span></p>';

			// ⚠️ فقط وقتی وضعیت «پاسخ داده شد» باشد، پاسخ برای مشتری
			// نمایان می‌شود. این جدا بودن عمدی است: کارشناس می‌تواند
			// پیش‌نویس بنویسد و بعداً منتشر کند.
			echo '<p style="background:#fff8e5;border-right:4px solid #dba617;padding:10px 12px;margin-top:14px">';
			echo 'پاسخ فقط زمانی برای مشتری نمایش داده می‌شود که وضعیت روی <strong>«پاسخ داده شد»</strong> تنظیم شود. تا آن لحظه می‌توانید آزادانه پیش‌نویس بنویسید.';
			echo '</p>';
			?>
			<script>
			jQuery(function ($) {
				$('#cyh-pick-file').on('click', function (e) {
					e.preventDefault();
					// wp.media همیشه در دسترس نیست (اگر اسکریپت لود نشده باشد)؛
					// در آن حالت کاربر می‌تواند نشانی را دستی بچسباند.
					if (typeof wp === 'undefined' || !wp.media) { return; }
					var frame = wp.media({ title: 'انتخاب فایل پیش‌فاکتور', multiple: false });
					frame.on('select', function () {
						var att = frame.state().get('selection').first().toJSON();
						$('#cyh_proforma_url').val(att.url);
					});
					frame.open();
				});
			});
			</script>
			<?php
		},
		CYH_QUOTE_CPT,
		'normal',
		'high'
	);
}
add_action( 'add_meta_boxes', 'cyh_quote_response_metabox' );

/** بارگذاری آپلودر رسانه فقط در صفحه‌ی همین نوع محتوا. */
function cyh_quote_admin_assets( $hook ) {
	global $post_type;
	if ( CYH_QUOTE_CPT === $post_type && in_array( $hook, [ 'post.php', 'post-new.php' ], true ) ) {
		wp_enqueue_media();
	}
}
add_action( 'admin_enqueue_scripts', 'cyh_quote_admin_assets' );

/** ذخیره‌ی پاسخ. */
function cyh_save_quote_response( $post_id ) {
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( ! isset( $_POST['cyh_quote_nonce'] ) ||
		! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['cyh_quote_nonce'] ) ), 'cyh_save_quote_response' ) ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}

	$statuses = cyh_quote_statuses();
	$status   = sanitize_text_field( wp_unslash( $_POST['cyh_status'] ?? 'new' ) );
	update_post_meta( $post_id, 'cyh_status', isset( $statuses[ $status ] ) ? $status : 'new' );

	update_post_meta(
		$post_id,
		'cyh_response',
		sanitize_textarea_field( wp_unslash( $_POST['cyh_response'] ?? '' ) )
	);
	update_post_meta(
		$post_id,
		'cyh_proforma_url',
		esc_url_raw( wp_unslash( $_POST['cyh_proforma_url'] ?? '' ) )
	);
}
add_action( 'save_post_' . CYH_QUOTE_CPT, 'cyh_save_quote_response' );

/* =========================================================================
   ۵) پیگیری مهمان — بدون حساب کاربری
   =========================================================================
   ⚠️ مسئله: کاربر حساب نمی‌سازد، پس اگر مرورگر را ببندد یا دستگاه عوض
   کند، کد رهگیری را از دست می‌دهد.

   راه‌حل دو لایه است:
     ۱) سمت مرورگر: کدها در localStorage می‌مانند، پس روی همان دستگاه
        فهرست درخواست‌ها خودکار دیده می‌شود.
     ۲) سمت سرور: صفحه‌ی /track با «کد رهگیری + شماره تماس» وضعیت را
        نشان می‌دهد. این کار روی هر دستگاهی جواب می‌دهد.

   ⚠️ چرا شماره تماس هم لازم است و کد به‌تنهایی کافی نیست:
   کد ۶ کاراکتری از الفبای ۳۲تایی حدود یک میلیارد حالت دارد — برای حدس
   تصادفی امن است، اما اگر کسی کد دیگری را ببیند (مثلاً روی کاغذ یا در
   یک پیام فوروارد شده) می‌تواند اطلاعات تماس و اقلام آن سفارش را
   ببیند. الزام تطابق شماره تماس، این نشت را می‌بندد.

   ⚠️ محدودسازی نرخ: بدون آن، همین اندپوینت به ابزار شمارش کدها تبدیل
   می‌شود. ۱۰ تلاش در ۱۰ دقیقه برای هر IP.
   ========================================================================= */

function cyh_register_quote_status_route() {
	register_rest_route(
		'crane-yadak/v1',
		'/quote-status',
		[
			'methods'             => 'GET',
			'permission_callback' => '__return_true',
			'callback'            => 'cyh_rest_quote_status',
		]
	);
}
add_action( 'rest_api_init', 'cyh_register_quote_status_route' );

function cyh_rest_quote_status( $request ) {
	// ── محدودسازی نرخ ──
	$ip  = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : 'unknown';
	$key = 'cyh_track_' . md5( $ip );
	$hits = (int) get_transient( $key );
	if ( $hits >= 10 ) {
		return new WP_REST_Response(
			[ 'ok' => false, 'message' => 'تعداد تلاش زیاد بود. چند دقیقه بعد دوباره امتحان کنید.' ],
			429
		);
	}
	set_transient( $key, $hits + 1, 10 * MINUTE_IN_SECONDS );

	$code  = strtoupper( sanitize_text_field( (string) $request->get_param( 'code' ) ) );
	$phone = preg_replace( '/\D/', '', cyh_to_latin_digits( (string) $request->get_param( 'phone' ) ) );

	if ( '' === $code || '' === $phone ) {
		return new WP_REST_Response(
			[ 'ok' => false, 'message' => 'کد رهگیری و شماره تماس لازم است.' ],
			400
		);
	}

	$found = get_posts(
		[
			'post_type'      => CYH_QUOTE_CPT,
			'post_status'    => 'publish',
			'posts_per_page' => 1,
			'meta_query'     => [ // phpcs:ignore WordPress.DB.SlowDBQuery
				'relation' => 'AND',
				[ 'key' => 'cyh_code', 'value' => $code ],
				[ 'key' => 'cyh_phone', 'value' => $phone ],
			],
		]
	);

	// پیام یکسان برای «پیدا نشد» و «شماره نمی‌خواند» — تا نتوان با
	// آزمون‌وخطا فهمید کدام کد واقعی است.
	if ( empty( $found ) ) {
		return new WP_REST_Response(
			[ 'ok' => false, 'message' => 'درخواستی با این کد و شماره پیدا نشد.' ],
			404
		);
	}

	$post     = $found[0];
	$statuses = cyh_quote_statuses();
	$status   = get_post_meta( $post->ID, 'cyh_status', true ) ?: 'new';
	$answered = 'answered' === $status || 'closed' === $status;

	return new WP_REST_Response(
		[
			'ok'          => true,
			'code'        => $code,
			'status'      => $status,
			'statusLabel' => $statuses[ $status ] ?? $status,
			'kind'        => get_post_meta( $post->ID, 'cyh_kind', true ) ?: 'quote',
			'submittedAt' => get_the_date( 'c', $post ),
			'items'       => array_map(
				static function ( $item ) {
					return [
						'name' => $item['name'] ?: $item['slug'],
						'sku'  => $item['sku'],
						'qty'  => (int) $item['qty'],
					];
				},
				cyh_get_quote_items( $post->ID )
			),
			// پاسخ فقط پس از انتشار توسط کارشناس برگردانده می‌شود.
			'response'    => $answered ? (string) get_post_meta( $post->ID, 'cyh_response', true ) : '',
			'proformaUrl' => $answered ? (string) get_post_meta( $post->ID, 'cyh_proforma_url', true ) : '',
		],
		200
	);
}

/** ارقام فارسی/عربی → لاتین. */
function cyh_to_latin_digits( $value ) {
	return strtr(
		$value,
		[
			'۰' => '0', '۱' => '1', '۲' => '2', '۳' => '3', '۴' => '4',
			'۵' => '5', '۶' => '6', '۷' => '7', '۸' => '8', '۹' => '9',
			'٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
			'٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
		]
	);
}

/** ستون وضعیت در فهرست درخواست‌ها. */
function cyh_quote_status_column( $columns ) {
	$out = [];
	foreach ( $columns as $key => $label ) {
		$out[ $key ] = $label;
		if ( 'title' === $key ) {
			$out['cyh_status'] = 'وضعیت';
		}
	}
	return $out;
}
add_filter( 'manage_' . CYH_QUOTE_CPT . '_posts_columns', 'cyh_quote_status_column', 20 );

function cyh_quote_status_column_content( $column, $post_id ) {
	if ( 'cyh_status' !== $column ) {
		return;
	}
	$statuses = cyh_quote_statuses();
	$status   = get_post_meta( $post_id, 'cyh_status', true ) ?: 'new';
	$colors   = [
		'new'         => '#d63638',
		'in_progress' => '#996800',
		'answered'    => '#00a32a',
		'closed'      => '#646970',
	];
	printf(
		'<span style="color:%s;font-weight:700">%s</span>',
		esc_attr( $colors[ $status ] ?? '#646970' ),
		esc_html( $statuses[ $status ] ?? $status )
	);
}
add_action( 'manage_' . CYH_QUOTE_CPT . '_posts_custom_column', 'cyh_quote_status_column_content', 20, 2 );
