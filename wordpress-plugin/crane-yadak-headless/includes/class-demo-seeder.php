<?php
/**
 * داده‌ی نمایشی برای کار طراحی — «فیکسچر»، نه محصول واقعی.
 *
 * ⚠️ چرا این فایل با احتیاط شدید نوشته شده:
 *
 * درخواست اولیه این بود که ۱۵ «قطعه‌ی واقعی صنعتی» با «کدهای معادل OEM
 * واقعی» مستقیماً به‌عنوان محصول منتشر شود. این کار انجام نشد، به این دلیل:
 *
 * کد معادل OEM حساس‌ترین داده‌ی کل این سایت است. اگر یک کد معادل اشتباه
 * منتشر شود، مهندس نت قطعه‌ی اشتباه را برای یک جرثقیل در حال کار سفارش
 * می‌دهد. این دیگر یک مسئله‌ی سئو نیست؛ مسئله‌ی ایمنی و مسئولیت حقوقی است.
 * هیچ منبع قابل‌اتکایی برای تولید کد قطعه‌ی واقعی دماگ یا پودم در اختیار
 * نبود، و تولید رشته‌های «قابل‌قبول به‌نظر» دقیقاً همان داده‌ی جعلی است که
 * کل این پروژه برای حذفش کار کرده — این‌بار با ظاهر یک کد فنی.
 *
 * اما نیاز واقعی پشت درخواست درست بود: نمی‌توان یک چیدمان صنعتیِ پرتراکم
 * را با یک محصول خالی طراحی کرد.
 *
 * راه‌حل: داده‌ی نمایشی ساخته می‌شود، اما به‌گونه‌ای که **امکان نشت به
 * پروداکشن نداشته باشد**:
 *   ۱) هر رکورد متای `_cyh_demo` می‌گیرد.
 *   ۲) فرانت‌اند این رکوردها را با نشان «نمونه‌ی نمایشی» رندر می‌کند،
 *      روی آن‌ها `noindex` می‌گذارد و از sitemap حذفشان می‌کند.
 *   ۳) گزارش هر بیلد تعدادشان را با صدای بلند اعلام می‌کند.
 *   ۴) یک دکمه‌ی «حذف کامل داده‌ی نمایشی» همه را یکجا پاک می‌کند.
 *   ۵) کدهای فنی عمداً با پیشوند `DEMO-` ساخته می‌شوند تا هرگز با کد
 *      واقعی سازنده اشتباه گرفته نشوند.
 *
 * مشخصات مهندسی متن‌ها واقعی و مبتنی بر استاندارد صنعت است (نوع سایش،
 * کلاس کاری، الزام محیطی)؛ فقط «کد قطعه» و «سازگاری دقیق مدل» ساختگی و
 * علامت‌گذاری‌شده است، چون تنها همان‌ها نیاز به تایید سازنده دارند.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CYH_DEMO_META', '_cyh_demo' );

/**
 * ۱۵ فیکسچر طراحی، پخش‌شده روی سیلوهای مختلف تا چیدمان با تنوع واقعی
 * (نام کوتاه/بلند، با قیمت/استعلامی، موجود/سفارشی) آزمایش شود.
 */
function cyh_demo_products() {
	$brands = [ 'demag' => 'Demag', 'podem' => 'Podem', 'telecrane' => 'Telecrane', 'schneider' => 'Schneider', 'stahl' => 'Stahl' ];

	$long = function ( $name, $role, $failure, $selection ) {
		return
			"<p><strong>{$name}</strong> {$role}</p>" .
			"<h2>نقش این قطعه در مجموعه</h2><p>{$role} عملکرد آن مستقیماً روی پایداری حرکت و ایمنی بار اثر می‌گذارد؛ به همین دلیل در برنامه‌ی نگهداری پیشگیرانه جزو اقلام تحت پایش دوره‌ای قرار می‌گیرد.</p>" .
			"<h2>نشانه‌های فرسودگی</h2><p>{$failure}</p>" .
			"<h2>معیار انتخاب</h2><p>{$selection}</p>" .
			"<h2>نصب و راه‌اندازی</h2><p>پیش از نصب، منبع تغذیه قفل و برچسب‌گذاری شود (Lock-out/Tag-out) و جرثقیل کاملاً بدون بار قرار گیرد. پس از نصب، یک سیکل کامل بدون بار و سپس یک سیکل با بار آزمایشی اجرا شود و عملکرد لیمیت سوئیچ‌ها و ترمز کنترل گردد.</p>" .
			"<h2>گارانتی و فاکتور</h2><p>تمام اقلام با فاکتور رسمی قابل ارائه به واحد مالی و ضمانت کتبی اصالت کالا تحویل می‌شوند. پیش از صدور پیش‌فاکتور، سازگاری قطعه با مدل دستگاه توسط کارشناس فنی بررسی می‌شود.</p>";
	};

	$items = [
		[ 'کمربند (روپ‌گاید) بالابر سیم‌بکسلی', 'rope-guide', 'podem', 'on_order', null,
		  'روی درام نصب می‌شود و سیم‌بکسل را در شیار هدایت می‌کند تا رشته‌ها روی هم سوار نشوند.',
		  'پیچش نامنظم سیم‌بکسل روی درام، صدای سایش فلزی از ناحیه‌ی درام، و پودر سایش زیر مجموعه‌ی بالابر.',
		  'گام شیار درام، قطر سیم‌بکسل و تعداد شاخه (Reeving) باید با مدل دستگاه یکی باشد؛ نسخه‌ی راست‌گرد و چپ‌گرد قابل تعویض نیستند.' ],
		[ 'درام شیاردار بالابر', 'crane-drum', 'demag', 'on_order', null,
		  'سیم‌بکسل را در لایه‌ی منظم جمع می‌کند و بار محوری مکانیزم بالابر را تحمل می‌کند.',
		  'سایش لبه‌ی شیار، بیضی‌شدن مقطع، و ترک در جوش نشیمنگاه فلنج.',
		  'قطر نامی، گام شیار و طول موثر باید با نقشه‌ی سازنده مطابقت داشته باشد.' ],
		[ 'کوپلینگ فلزی انتقال گشتاور', 'crane-coupling', 'stahl', 'in_stock', 18500000,
		  'گشتاور موتور را به گیربکس منتقل می‌کند و ناهم‌محوری جزئی و ضربه‌ی راه‌اندازی را جذب می‌کند.',
		  'صدای تق‌تق هنگام تغییر جهت، لقی محسوس بین دو نیمه، و سایش دنده‌های درگیر.',
		  'گشتاور نامی، قطر شفت ورودی و خروجی، و میزان ناهم‌محوری مجاز تعیین‌کننده‌اند.' ],
		[ 'موتور گیربکس حرکت طولی', 'gearbox-motor', 'demag', 'on_order', null,
		  'حرکت طولی پل جرثقیل روی ریل را تامین می‌کند و ترمز مگنتی روی همان شفت نصب است.',
		  'گرم‌شدن غیرعادی بدنه، نشتی روغن از کاسه‌نمد، و افت گشتاور در شروع حرکت.',
		  'کلاس کاری (FEM/ISO)، نسبت تبدیل، توان و ولتاژ کاری باید با مشخصات دستگاه هم‌خوان باشد.' ],
		[ 'چرخ راهبر فولادی عملیات‌حرارتی', 'crane-wheel', 'demag', 'in_stock', 32000000,
		  'وزن پل و بار را روی ریل منتقل می‌کند و مسیر حرکت را حفظ می‌کند.',
		  'سایش فلنج، تخت‌شدن موضعی سطح غلتش، و صدای برخورد در محل اتصال ریل.',
		  'قطر، عرض تماس، نوع فلنج و سختی سطح باید با ریل و بار طراحی هم‌خوان باشد.' ],
		[ 'بیرینگ کروی نشیمنگاه چرخ', 'bearing', 'demag', 'in_stock', 4200000,
		  'بار شعاعی و محوری چرخ را تحمل می‌کند و اصطکاک حرکت را کاهش می‌دهد.',
		  'صدای زوزه هنگام حرکت، گرمای موضعی، و لقی محسوس در آزمون دستی.',
		  'سری بیرینگ، لقی داخلی و نوع گریس باید متناسب با دما و بار محیط انتخاب شود.' ],
		[ 'کلگی محرک انتهای پل', 'end-carriage', 'stahl', 'on_order', null,
		  'مجموعه‌ی شاسی، چرخ و مکانیزم محرکه در دو انتهای پل جرثقیل است.',
		  'ناهم‌ترازی حرکت، سایش نامتقارن چرخ‌ها، و ترک در جوش شاسی.',
		  'دهانه‌ی پل، بار طراحی و فاصله‌ی مرکز چرخ‌ها تعیین‌کننده‌ی مدل است.' ],
		[ 'فلکه و دیسک ترمز مگنتی', 'brake-wheel-disc', 'demag', 'in_stock', 9800000,
		  'در لحظه‌ی قطع برق یا توقف موتور، مانع سقوط بار می‌شود.',
		  'افزایش فاصله‌ی توقف بار، لرزش هنگام توقف، و کاهش ضخامت لنت زیر حد مجاز.',
		  'قطر فلکه، ضخامت لنت و گشتاور ترمز باید با مشخصات موتور مطابقت کند.' ],
		[ 'مگنت (بوبین) بازکننده‌ی ترمز', 'brake-magnet', 'demag', 'in_stock', 7400000,
		  'با تحریک الکتریکی، فک ترمز را باز می‌کند تا مکانیزم آزاد شود.',
		  'باز نشدن کامل ترمز، صدای هوم ممتد، و داغ‌شدن بیش از حد بوبین.',
		  'ولتاژ کاری (AC/DC)، نیروی جذب و ابعاد نصب باید دقیقاً مطابق مدل ترمز باشد.' ],
		[ 'رکتیفایر تغذیه‌ی ترمز', 'rectifier', 'schneider', 'in_stock', 3600000,
		  'برق AC را برای بوبین ترمز یکسو می‌کند و با قطع سریع، زمان توقف را کوتاه می‌کند.',
		  'تاخیر در گرفتن ترمز، گرم‌شدن غیرعادی، و سوختن مکرر فیوز مدار ترمز.',
		  'ولتاژ ورودی/خروجی و نوع قطع (سمت AC یا DC) باید با مدار موجود هم‌خوان باشد.' ],
		[ 'ریموت کنترل رادیویی صنعتی ۸ کاناله', 'remote-control', 'telecrane', 'in_stock', 46000000,
		  'کنترل حرکات جرثقیل را از فاصله‌ی ایمن و خارج از محدوده‌ی بار ممکن می‌کند.',
		  'قطع و وصل متناوب فرمان، کاهش برد موثر، و تاخیر در پاسخ رله‌ها.',
		  'تعداد کانال، فرکانس کاری مجاز و درجه‌ی حفاظت گیرنده متناسب با محیط انتخاب شود.' ],
		[ 'لیمیت سوئیچ انتهای مسیر', 'microswitch', 'schneider', 'in_stock', 2900000,
		  'حرکت را در انتهای کورس مجاز به‌صورت خودکار قطع می‌کند.',
		  'عمل‌کردن دیر یا زودتر از نقطه‌ی تنظیم، و چسبندگی کنتاکت.',
		  'نوع اهرم، تعداد کنتاکت و درجه‌ی حفاظت باید با شرایط نصب هم‌خوان باشد.' ],
		[ 'کنتاکتور قدرت مدار حرکت', 'contactor', 'schneider', 'in_stock', 5300000,
		  'مدار قدرت موتورها را با فرمان کم‌جریان قطع و وصل می‌کند.',
		  'جوش‌خوردن کنتاکت، صدای وزوز بوبین، و افت ولتاژ روی بار.',
		  'جریان نامی، کلاس کاری (AC-3/AC-4) و ولتاژ بوبین تعیین‌کننده‌اند؛ کلاس کاری در بارهای پرتکرار حیاتی است.' ],
		[ 'جاروبک انتقال جریان شین', 'current-collector', 'demag', 'in_stock', 1850000,
		  'جریان را از شین برق‌رسان به کالسکه‌ی متحرک منتقل می‌کند.',
		  'جرقه‌زنی روی شین، افت ولتاژ در انتهای مسیر، و سایش سریع زغال.',
		  'جنس زغال، نیروی فنر و سطح تماس باید با نوع شین و آمپراژ مصرفی هم‌خوان باشد.' ],
		[ 'قلاب فورج‌شده با زبانه‌ی ایمنی', 'crane-hook', 'stahl', 'on_order', null,
		  'بار را به مجموعه‌ی بالابر متصل می‌کند و آخرین حلقه‌ی زنجیره‌ی ایمنی است.',
		  'بازشدگی دهانه بیش از حد مجاز، ترک در ناحیه‌ی گلویی، و خرابی زبانه‌ی ایمنی.',
		  'ظرفیت نامی، کلاس مقاومت و نوع اتصال (شفت/چشمی) باید با مکانیزم هم‌خوان باشد.' ],
	];

	$out = [];
	foreach ( $items as $i => $it ) {
		list( $name, $cat, $brand, $stock, $price, $role, $failure, $selection ) = $it;
		$code = sprintf( 'DEMO-%s-%03d', strtoupper( substr( $brand, 0, 3 ) ), $i + 1 );

		$out[] = [
			'title'    => $name . ' ' . $brands[ $brand ],
			'excerpt'  => sprintf( '%s تامین با بررسی سازگاری فنی، فاکتور رسمی و ضمانت اصالت کالا.', $role ),
			'content'  => $long( $name, $role, $failure, $selection ),
			'category' => $cat,
			'brand'    => $brand,
			'sku'      => $code,
			'price'    => $price,
			'stock'    => $stock,
			'specs'    => [
				[ 'spec_label' => 'کلاس کاری', 'spec_value' => 'مطابق FEM / ISO — نمونه‌ی نمایشی' ],
				[ 'spec_label' => 'شرایط محیط', 'spec_value' => 'صنعتی، غبارآلود' ],
				[ 'spec_label' => 'گارانتی', 'spec_value' => 'ضمانت کتبی اصالت کالا' ],
			],
			// ⚠️ کدهای معادل عمداً DEMO هستند. کد OEM واقعی فقط باید از
			// کاتالوگ رسمی سازنده وارد شود.
			'oem'      => [
				[ 'oem_brand' => $brands[ $brand ], 'oem_part_number' => $code . '-A' ],
				[ 'oem_brand' => 'معادل عمومی', 'oem_part_number' => $code . '-B' ],
			],
			'models'   => [
				[ 'crane_brand' => $brands[ $brand ], 'model_name' => 'نمونه‌ی نمایشی — نیازمند تایید' ],
			],
		];
	}

	return $out;
}

/** درج فیکسچرها. رکوردهای موجود دوباره ساخته نمی‌شوند. */
function cyh_seed_demo_products() {
	$created = 0;
	$skipped = 0;

	foreach ( cyh_demo_products() as $item ) {
		if ( get_page_by_path( sanitize_title( $item['brand'] . '-' . $item['sku'] ), OBJECT, 'product' ) ) {
			$skipped++;
			continue;
		}

		$post_id = wp_insert_post(
			[
				'post_type'    => 'product',
				'post_status'  => 'publish',
				'post_title'   => $item['title'],
				'post_excerpt' => $item['excerpt'],
				'post_content' => $item['content'],
			]
		);

		if ( is_wp_error( $post_id ) || ! $post_id ) {
			continue;
		}

		update_post_meta( $post_id, CYH_DEMO_META, '1' );

		$term = get_term_by( 'slug', $item['category'], 'crane_category' );
		if ( $term && ! is_wp_error( $term ) ) {
			wp_set_object_terms( $post_id, [ (int) $term->term_id ], 'crane_category' );
		}

		if ( function_exists( 'update_field' ) ) {
			$brand_post = get_page_by_path( $item['brand'], OBJECT, 'brand' );
			update_field( 'sku', $item['sku'], $post_id );
			update_field( 'buy_mode', $item['price'] ? 'cart' : 'rfq', $post_id );
			update_field( 'stock_status', $item['stock'], $post_id );
			update_field( 'technical_specs', $item['specs'], $post_id );
			update_field( 'oem_cross_reference', $item['oem'], $post_id );
			update_field( 'compatible_models', $item['models'], $post_id );
			if ( $item['price'] ) {
				update_field( 'price', $item['price'], $post_id );
			}
			if ( $brand_post ) {
				update_field( 'brand', [ $brand_post->ID ], $post_id );
			}
		}

		$created++;
	}

	return [ 'created' => $created, 'skipped' => $skipped ];
}

/** حذف کامل — بازگشت به وضعیت تمیز با یک کلیک. */
function cyh_purge_demo_products() {
	$ids = get_posts(
		[
			'post_type'      => 'product',
			'post_status'    => 'any',
			'posts_per_page' => -1,
			'fields'         => 'ids',
			'meta_key'       => CYH_DEMO_META,
			'meta_value'     => '1',
		]
	);

	foreach ( $ids as $id ) {
		wp_delete_post( $id, true );
	}

	return count( $ids );
}

function cyh_count_demo_products() {
	return count(
		get_posts(
			[
				'post_type'      => 'product',
				'post_status'    => 'any',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				'meta_key'       => CYH_DEMO_META,
				'meta_value'     => '1',
			]
		)
	);
}

/** فیلد `isDemo` در گراف‌کیوال تا فرانت‌اند بتواند این رکوردها را جدا کند. */
function cyh_register_demo_graphql_field() {
	if ( ! function_exists( 'register_graphql_field' ) ) {
		return;
	}

	register_graphql_field(
		'CraneProduct',
		'isDemo',
		[
			'type'        => 'Boolean',
			'description' => 'داده‌ی نمایشی برای کار طراحی — محصول واقعی نیست.',
			'resolve'     => function ( $post ) {
				return (bool) get_post_meta( $post->ID, CYH_DEMO_META, true );
			},
		]
	);
}
add_action( 'graphql_register_types', 'cyh_register_demo_graphql_field' );

/** دکمه‌ها روی صفحه‌ی فهرست محصولات. */
function cyh_demo_admin_notice() {
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	if ( ! $screen || 'edit-product' !== $screen->id ) {
		return;
	}

	$count = cyh_count_demo_products();
	$seed  = wp_nonce_url( admin_url( 'admin-post.php?action=cyh_seed_demo' ), 'cyh_seed_demo' );
	$purge = wp_nonce_url( admin_url( 'admin-post.php?action=cyh_purge_demo' ), 'cyh_purge_demo' );

	if ( $count > 0 ) {
		printf(
			'<div class="notice notice-warning"><p><strong>⚠️ %d محصول نمایشی روی سایت وجود دارد.</strong> '
			. 'این‌ها فقط برای کار طراحی ساخته شده‌اند: کد فنی‌شان با پیشوند <code>DEMO-</code> است، '
			. 'در سایت با نشان «نمونه‌ی نمایشی» دیده می‌شوند، <code>noindex</code> دارند و در نقشه‌ی سایت نمی‌آیند. '
			. '<strong>پیش از انتشار نهایی سایت حتماً حذفشان کنید.</strong></p>'
			. '<p><a href="%s" class="button button-primary">حذف کامل داده‌ی نمایشی</a></p></div>',
			$count,
			esc_url( $purge )
		);
		return;
	}

	printf(
		'<div class="notice notice-info"><p><strong>داده‌ی نمایشی برای کار طراحی</strong><br>'
		. '۱۵ قطعه‌ی نمونه با توضیحات کامل و مشخصات فنی ساخته می‌شود تا چیدمان صفحات با داده‌ی واقع‌نما آزمایش شود. '
		. 'کدهای فنی عمداً <code>DEMO-</code> هستند و کد معادل OEM واقعی محسوب نمی‌شوند — '
		. 'کد واقعی فقط باید از کاتالوگ رسمی سازنده وارد شود.</p>'
		. '<p><a href="%s" class="button button-secondary">ساخت داده‌ی نمایشی</a></p></div>',
		esc_url( $seed )
	);
}
add_action( 'admin_notices', 'cyh_demo_admin_notice' );

function cyh_handle_seed_demo() {
	if ( ! current_user_can( 'manage_options' ) || ! check_admin_referer( 'cyh_seed_demo' ) ) {
		wp_die( 'دسترسی مجاز نیست.' );
	}
	$r = cyh_seed_demo_products();
	set_transient( 'cyh_demo_notice', sprintf( '%d محصول نمایشی ساخته شد، %d مورد از قبل وجود داشت.', $r['created'], $r['skipped'] ), 60 );
	wp_safe_redirect( wp_get_referer() ?: admin_url( 'edit.php?post_type=product' ) );
	exit;
}
add_action( 'admin_post_cyh_seed_demo', 'cyh_handle_seed_demo' );

function cyh_handle_purge_demo() {
	if ( ! current_user_can( 'manage_options' ) || ! check_admin_referer( 'cyh_purge_demo' ) ) {
		wp_die( 'دسترسی مجاز نیست.' );
	}
	$n = cyh_purge_demo_products();
	set_transient( 'cyh_demo_notice', sprintf( '%d محصول نمایشی حذف شد.', $n ), 60 );
	wp_safe_redirect( wp_get_referer() ?: admin_url( 'edit.php?post_type=product' ) );
	exit;
}
add_action( 'admin_post_cyh_purge_demo', 'cyh_handle_purge_demo' );

function cyh_demo_result_notice() {
	$msg = get_transient( 'cyh_demo_notice' );
	if ( ! $msg ) {
		return;
	}
	delete_transient( 'cyh_demo_notice' );
	printf( '<div class="notice notice-success is-dismissible"><p><strong>داده‌ی نمایشی:</strong> %s</p></div>', esc_html( $msg ) );
}
add_action( 'admin_notices', 'cyh_demo_result_notice' );
