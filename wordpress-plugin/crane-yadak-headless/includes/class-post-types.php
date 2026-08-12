<?php
/**
 * ثبت CPTها و تکسونومی سفارشی + expose کردن آن‌ها در WPGraphQL.
 *
 * نکته نام‌گذاری GraphQL: از پیشوند «crane» برای Single/Plural Name استفاده
 * شده (croneProduct نه Product) تا در صورتی که در آینده افزونه‌ی دیگری
 * (مثلاً WooCommerce) هم روی همین وردپرس نصب شود، هیچ برخورد نام نوع (Type
 * Name Collision) در اسکیمای گراف‌کیوال رخ ندهد — یک باگ رایج و سخت‌کشف در
 * پروژه‌های Headless که از قبل پیش‌بینی و رفع شده است.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function cyh_register_post_types() {

	// ---------------------------------------------------------------
	// CPT: product — معادل مستقیم آرایه‌ی mockProducts در فرانت‌اند فعلی
	// ---------------------------------------------------------------
	register_post_type(
		'product',
		[
			'labels'              => [
				'name'          => 'محصولات کرین یدک',
				'singular_name' => 'محصول کرین یدک',
				'add_new_item'  => 'افزودن محصول جدید',
				'edit_item'     => 'ویرایش محصول',
				'search_items'  => 'جستجوی محصولات',
			],
			'public'               => true,
			'publicly_queryable'   => false, // Headless: هیچ صفحه‌ی وردپرسی رندر نمی‌شود، فقط از طریق GraphQL کوئری می‌شود
			'show_ui'              => true,
			'show_in_menu'         => true,
			'menu_icon'            => 'dashicons-admin-tools',
			// 'excerpt' لازم است: فرانت‌اند از آن برای توضیح کوتاه محصول و متا
			// دیسکریپشن استفاده می‌کند. WPGraphQL فیلد excerpt را فقط وقتی
			// expose می‌کند که CPT صراحتاً از آن پشتیبانی کند — نبودش خطای
			// «Cannot query field "excerpt" on type "CraneProduct"» می‌دهد.
			'supports'             => [ 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields' ],
			'has_archive'          => false,
			'rewrite'              => false,
			'show_in_rest'         => true, // لازم برای ویرایشگر Gutenberg و پیش‌نمایش
			'show_in_graphql'      => true,
			'graphql_single_name'  => 'craneProduct',
			'graphql_plural_name'  => 'craneProducts',
		]
	);

	// ---------------------------------------------------------------
	// CPT: brand — معادل ENRICHED_BRANDS در src/data/site.ts
	// ---------------------------------------------------------------
	register_post_type(
		'brand',
		[
			'labels'              => [
				'name'          => 'برندهای کرین یدک',
				'singular_name' => 'برند',
				'add_new_item'  => 'افزودن برند جدید',
				'edit_item'     => 'ویرایش برند',
			],
			'public'               => true,
			'publicly_queryable'   => false,
			'show_ui'              => true,
			'show_in_menu'         => true,
			'menu_icon'            => 'dashicons-star-filled',
			'supports'             => [ 'title', 'thumbnail' ],
			'has_archive'          => false,
			// اسلاگ فرانت‌اند فعلی /brands/[slug] است؛ نگه‌داشتن همین اسلاگ در
			// وردپرس، جدول Redirect Map را در آینده کاملاً غیرضروری می‌کند.
			'rewrite'              => [ 'slug' => 'brands' ],
			'show_in_rest'         => true,
			'show_in_graphql'      => true,
			'graphql_single_name'  => 'craneBrand',
			'graphql_plural_name'  => 'craneBrands',
		]
	);

	// ---------------------------------------------------------------
	// CPT: datasheet — معادل DATASHEETS در src/data/content.ts
	// ---------------------------------------------------------------
	register_post_type(
		'datasheet',
		[
			'labels'              => [
				'name'          => 'اسناد فنی',
				'singular_name' => 'سند فنی',
				'add_new_item'  => 'افزودن سند فنی جدید',
				'edit_item'     => 'ویرایش سند فنی',
			],
			'public'               => true,
			'publicly_queryable'   => false,
			'show_ui'              => true,
			'show_in_menu'         => true,
			'menu_icon'            => 'dashicons-media-document',
			'supports'             => [ 'title' ],
			'has_archive'          => false,
			'rewrite'              => false,
			'show_in_rest'         => true,
			'show_in_graphql'      => true,
			'graphql_single_name'  => 'craneDatasheet',
			'graphql_plural_name'  => 'craneDatasheets',
		]
	);

	// ---------------------------------------------------------------
	// CPT: inquiry — لاگ داخلی درخواست‌های فرم تماس (فقط wp-admin، هرگز در
	// GraphQL منتشر نمی‌شود چون شامل اطلاعات شخصی مشتری است). این CPT به‌عنوان
	// نسخه‌ی پشتیبان لید در کنار wp_mail عمل می‌کند — اگر SMTP سرور بخاطر هر
	// دلیلی ایمیل را نرساند (یک مشکل بسیار رایج هاست‌های اشتراکی ایران)، لید
	// هرگز به‌طور کامل گم نمی‌شود.
	// ---------------------------------------------------------------
	register_post_type(
		'inquiry',
		[
			'labels'             => [
				'name'          => 'درخواست‌های استعلام',
				'singular_name' => 'درخواست استعلام',
			],
			'public'              => false,
			'publicly_queryable'  => false,
			'show_ui'             => true,
			'show_in_menu'        => true,
			'menu_icon'           => 'dashicons-email-alt',
			'supports'            => [ 'title', 'editor', 'custom-fields' ],
			'has_archive'         => false,
			'rewrite'             => false,
			'show_in_rest'        => false,
			'show_in_graphql'     => false,
			'capability_type'     => 'page',
		]
	);
}
add_action( 'init', 'cyh_register_post_types' );

function cyh_register_taxonomies() {

	// ---------------------------------------------------------------
	// Taxonomy: crane_category — معادل CATEGORIES در src/data/site.ts
	// روی CPT محصول (سلسله‌مراتبی، مثل دسته‌بندی پیش‌فرض وردپرس)
	// ---------------------------------------------------------------
	register_taxonomy(
		'crane_category',
		[ 'product' ],
		[
			'labels'              => [
				'name'          => 'دسته‌بندی قطعات',
				'singular_name' => 'دسته‌بندی',
			],
			'hierarchical'         => true,
			'public'               => true,
			'publicly_queryable'   => false,
			'show_ui'              => true,
			'show_admin_column'    => true,
			// اسلاگ فرانت‌اند فعلی /categories/[slug] است.
			'rewrite'              => [ 'slug' => 'categories' ],
			'show_in_rest'         => true,
			'show_in_graphql'      => true,
			'graphql_single_name'  => 'craneCategory',
			'graphql_plural_name'  => 'craneCategories',
		]
	);
}
add_action( 'init', 'cyh_register_taxonomies' );

/**
 * محاسبه‌ی خودکار حجم فایل PDF برای CPT «datasheet» هنگام ذخیره — دقیقاً
 * همان فیلد «size» که در حال حاضر به‌صورت دستی در src/data/content.ts
 * نوشته شده (مثل '4.2 MB'). این هوک باعث می‌شود ادمین سایت هرگز مجبور
 * نباشد حجم فایل را دستی محاسبه/تایپ کند — منبع خطای انسانی رایج.
 */
function cyh_auto_calculate_datasheet_size( $post_id ) {
	if ( 'datasheet' !== get_post_type( $post_id ) ) {
		return;
	}

	if ( ! function_exists( 'get_field' ) ) {
		return; // ACF هنوز لود نشده — این فقط یک محافظ دفاعی است.
	}

	$file = get_field( 'pdf_file', $post_id );

	if ( empty( $file ) || empty( $file['url'] ) ) {
		return;
	}

	$path = str_replace( wp_get_upload_dir()['baseurl'], wp_get_upload_dir()['basedir'], $file['url'] );

	if ( ! file_exists( $path ) ) {
		return;
	}

	$bytes    = filesize( $path );
	$megabyte = 1024 * 1024;
	$size_mb  = round( $bytes / $megabyte, 1 ) . ' MB';

	update_field( 'file_size_computed', $size_mb, $post_id );
}
add_action( 'acf/save_post', 'cyh_auto_calculate_datasheet_size', 20 );

/**
 * اجبار اسلاگ انگلیسی برای محصول، برند، صنعت و سند فنی.
 *
 * ⚠️ باگی که این تابع رفع می‌کند: مدیر محتوا عنوان فارسی می‌نویسد
 * («کمربند جرثقیل پودم MT318») و وردپرس همان را به اسلاگ تبدیل می‌کند.
 * نتیجه در فرانت‌اند:
 *   /products/کمربند-جرثقیل-پودم-mt318
 * که هنگام کپی‌شدن به این تبدیل می‌شود:
 *   /products/%DA%A9%D9%85%D8%B1%D8%A8%D9%86%D8%AF-...
 *
 * چرا مهم است: خریدار صنعتی ایرانی لینک قطعه را در واتساپ و تلگرام برای
 * مدیر خرید می‌فرستد. لینکی که به‌شکل رشته‌ی درهم‌ریخته‌ی درصددار دیده شود،
 * ناسالم به نظر می‌رسد و کلیک نمی‌شود — دقیقاً روی حساس‌ترین مسیر تبدیل.
 *
 * تصمیم طراحی: به‌جای «ترانویسی» فارسی به لاتین (که نتیجه‌اش اسلاگ‌های
 * زشت و غیرقابل‌پیش‌بینی است)، اسلاگ از داده‌ی ساختاریافته ساخته می‌شود:
 *   محصول → «برند + کد فنی»  → podem-mt318
 *   برند  → نام لاتین برند   → podem
 * این هم خواناست، هم پایدار، هم برای جستجوی کد فنی معنا دارد.
 *
 * اسلاگ فقط یک‌بار هنگام ایجاد ساخته می‌شود. اگر مدیر محتوا بعداً آن را
 * دستی تغییر دهد، دست‌نخورده می‌ماند — چون تغییر اسلاگِ منتشرشده یعنی از
 * دست رفتن رتبه، و کد نباید این تصمیم را به‌جای انسان بگیرد.
 */
function cyh_force_latin_slug( $slug, $post_ID, $post_status, $post_type ) {
	$targets = [ 'product', 'brand', 'industry', 'datasheet' ];
	if ( ! in_array( $post_type, $targets, true ) ) {
		return $slug;
	}

	// اسلاگ فعلی اگر کاراکتر غیر ASCII ندارد، یعنی یا دستی تنظیم شده یا
	// از قبل درست است — دست نمی‌زنیم.
	if ( $slug && ! preg_match( '/[^\x20-\x7E]/', urldecode( $slug ) ) ) {
		return $slug;
	}

	$parts = [];

	if ( 'product' === $post_type && function_exists( 'get_field' ) ) {
		$brand = get_field( 'brand', $post_ID );
		if ( is_array( $brand ) && ! empty( $brand[0] ) ) {
			$brand_id = is_object( $brand[0] ) ? $brand[0]->ID : (int) $brand[0];
			$brand_en = get_field( 'name_en', $brand_id );
			if ( $brand_en ) {
				$parts[] = $brand_en;
			}
		}

		$sku = get_field( 'sku', $post_ID );
		if ( $sku ) {
			$parts[] = $sku;
		}
	}

	if ( 'brand' === $post_type && function_exists( 'get_field' ) ) {
		$name_en = get_field( 'name_en', $post_ID );
		if ( $name_en ) {
			$parts[] = $name_en;
		}
	}

	$candidate = sanitize_title( implode( '-', $parts ) );

	// اگر هیچ داده‌ی لاتینی نبود (مثلاً محصول هنوز کد فنی ندارد)، به یک
	// شناسه‌ی پایدار برمی‌گردیم — بهتر از اسلاگ فارسی درصددار.
	if ( '' === $candidate ) {
		$candidate = $post_type . '-' . $post_ID;
	}

	return $candidate;
}
add_filter( 'wp_unique_post_slug', 'cyh_force_latin_slug', 10, 4 );

/**
 * همین قاعده برای ترم‌های دسته‌بندی: اسلاگ باید با اسلاگ انگلیسی داخل
 * `src/data/taxonomy.ts` مو به مو یکی باشد، وگرنه محصول در هیچ صفحه‌ی
 * دسته‌ای دیده نمی‌شود. اگر مدیر محتوا اسلاگ را خالی بگذارد، وردپرس نام
 * فارسی را می‌گذارد و این تطابق بی‌سروصدا می‌شکند.
 */
function cyh_warn_on_non_latin_term_slug( $term_id, $tt_id, $taxonomy ) {
	if ( 'crane_category' !== $taxonomy ) {
		return;
	}

	$term = get_term( $term_id, $taxonomy );
	if ( ! $term || is_wp_error( $term ) ) {
		return;
	}

	if ( preg_match( '/[^\x20-\x7E]/', urldecode( $term->slug ) ) ) {
		set_transient(
			'cyh_slug_warning',
			sprintf(
				'اسلاگ دسته‌ی «%s» فارسی است. اسلاگ باید انگلیسی و دقیقاً برابر مقدار تعریف‌شده در فرانت‌اند باشد (مثلاً rope-guide)، وگرنه محصولات این دسته در سایت نمایش داده نمی‌شوند.',
				$term->name
			),
			120
		);
	}
}
add_action( 'created_term', 'cyh_warn_on_non_latin_term_slug', 10, 3 );
add_action( 'edited_term', 'cyh_warn_on_non_latin_term_slug', 10, 3 );

function cyh_slug_warning_notice() {
	$msg = get_transient( 'cyh_slug_warning' );
	if ( ! $msg ) {
		return;
	}
	delete_transient( 'cyh_slug_warning' );
	printf( '<div class="notice notice-warning is-dismissible"><p><strong>هشدار اسلاگ:</strong> %s</p></div>', esc_html( $msg ) );
}
add_action( 'admin_notices', 'cyh_slug_warning_notice' );
