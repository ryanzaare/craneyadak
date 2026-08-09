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
				'name'          => 'محصولات',
				'singular_name' => 'محصول',
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
				'name'          => 'برندها',
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
	// CPT: industry — معادل INDUSTRIES در src/data/content.ts
	// ---------------------------------------------------------------
	register_post_type(
		'industry',
		[
			'labels'              => [
				'name'          => 'صنایع تحت پوشش',
				'singular_name' => 'صنعت',
				'add_new_item'  => 'افزودن صنعت جدید',
				'edit_item'     => 'ویرایش صنعت',
			],
			'public'               => true,
			'publicly_queryable'   => false,
			'show_ui'              => true,
			'show_in_menu'         => true,
			'menu_icon'            => 'dashicons-building',
			'supports'             => [ 'title', 'editor' ],
			'has_archive'          => false,
			'rewrite'              => [ 'slug' => 'industries' ],
			'show_in_rest'         => true,
			'show_in_graphql'      => true,
			'graphql_single_name'  => 'craneIndustry',
			'graphql_plural_name'  => 'craneIndustries',
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
