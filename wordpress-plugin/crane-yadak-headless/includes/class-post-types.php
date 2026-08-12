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

/**
 * ---------------------------------------------------------------------------
 * ترمیم اسلاگ *بعد از* ذخیره‌ی فیلدهای ACF.
 *
 * باگی که این تابع رفع می‌کند (نیمه‌ی گمشده‌ی cyh_force_latin_slug):
 *
 * فیلتر `wp_unique_post_slug` هنگام `wp_insert_post` اجرا می‌شود. اما ACF
 * فیلدها را روی `acf/save_post` ذخیره می‌کند که *بعد از* آن اجرا می‌شود.
 * یعنی در همان لحظه‌ای که وردپرس اسلاگ را می‌سازد، هنوز هیچ کد فنی و
 * برندی در دیتابیس نیست؛ فیلتر چیزی پیدا نمی‌کند و وردپرس به عنوان فارسی
 * برمی‌گردد:
 *     /products/کمربند-جرثقیل-پودم-mt318
 *
 * این دقیقاً همان باگ ترتیب اجرا بود که در سیدر هم دیده شد. آن‌جا با
 * نوشتن صریح `post_name` حل شد، اما محصولی که مدیر سایت دستی از پنل
 * وردپرس می‌سازد از مسیر سیدر عبور نمی‌کند و همچنان اسلاگ فارسی می‌گرفت.
 *
 * راه‌حل: بعد از این‌که ACF کارش تمام شد، اگر اسلاگ هنوز غیرلاتین است،
 * همین‌جا اصلاحش می‌کنیم — جایی که کد فنی و برند قطعاً در دسترس‌اند.
 *
 * ⚠️ چرا `$wpdb->update` به‌جای `wp_update_post`: فراخوانی
 * `wp_update_post` داخل هوک ذخیره، دوباره `save_post` را شلیک می‌کند و
 * حلقه‌ی بی‌نهایت می‌سازد. نوشتن مستقیم + پاک‌کردن کش، امن و قطعی است.
 * ---------------------------------------------------------------------------
 */
function cyh_repair_latin_slug_after_acf( $post_id ) {
	// ACF برای فرم‌های غیرپستی (مثل صفحه‌ی تنظیمات) رشته می‌فرستد.
	if ( ! is_numeric( $post_id ) ) {
		return;
	}

	$post_id = (int) $post_id;
	$post    = get_post( $post_id );
	if ( ! $post ) {
		return;
	}

	$targets = [ 'product', 'brand', 'industry', 'datasheet' ];
	if ( ! in_array( $post->post_type, $targets, true ) ) {
		return;
	}

	// اسلاگ اگر از قبل کاملاً ASCII است، دست نمی‌زنیم — ممکن است مدیر
	// سایت عمداً آن را دستی تنظیم کرده باشد.
	$current = urldecode( (string) $post->post_name );
	if ( '' !== $current && ! preg_match( '/[^\x20-\x7E]/', $current ) ) {
		return;
	}

	// همان منطق تولید اسلاگ که فیلتر استفاده می‌کند — حالا با داده‌ی موجود.
	$candidate = cyh_force_latin_slug( '', $post_id, $post->post_status, $post->post_type );
	if ( '' === $candidate ) {
		return;
	}

	// یکتاسازی نسبت به بقیه‌ی پست‌ها.
	$unique = wp_unique_post_slug( $candidate, $post_id, $post->post_status, $post->post_type, $post->post_parent );
	if ( $unique === $post->post_name ) {
		return;
	}

	global $wpdb;
	$wpdb->update( $wpdb->posts, [ 'post_name' => $unique ], [ 'ID' => $post_id ] );
	clean_post_cache( $post_id );
}
add_action( 'acf/save_post', 'cyh_repair_latin_slug_after_acf', 20 );

/**
 * ترمیم گروهی — برای محصولاتی که *پیش از* این اصلاح ساخته شده‌اند.
 *
 * بدون این، مدیر سایت باید تک‌تک محصولات موجود را باز کند و دوباره ذخیره
 * کند تا اسلاگشان درست شود. برای کاتالوگی که قرار است ده‌ها قلم داشته
 * باشد، این یعنی خطای انسانی حتمی.
 */
function cyh_repair_all_latin_slugs() {
	$posts = get_posts(
		[
			'post_type'      => [ 'product', 'brand', 'industry', 'datasheet' ],
			'post_status'    => [ 'publish', 'draft', 'pending', 'private' ],
			'posts_per_page' => -1,
			'fields'         => 'ids',
		]
	);

	$fixed = 0;
	foreach ( $posts as $id ) {
		$before = get_post_field( 'post_name', $id );
		cyh_repair_latin_slug_after_acf( $id );
		if ( get_post_field( 'post_name', $id ) !== $before ) {
			$fixed++;
		}
	}

	return $fixed;
}

/** دکمه‌ی «اصلاح آدرس‌های فارسی» روی فهرست محصولات. */
function cyh_handle_repair_slugs() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( 'دسترسی مجاز نیست.' );
	}
	check_admin_referer( 'cyh_repair_slugs' );

	$fixed = cyh_repair_all_latin_slugs();

	wp_safe_redirect(
		add_query_arg(
			[ 'post_type' => 'product', 'cyh_slugs_fixed' => $fixed ],
			admin_url( 'edit.php' )
		)
	);
	exit;
}
add_action( 'admin_post_cyh_repair_slugs', 'cyh_handle_repair_slugs' );

/** اعلان + دکمه‌ی ترمیم اسلاگ. */
function cyh_slug_repair_notice() {
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	if ( ! $screen || 'edit-product' !== $screen->id ) {
		return;
	}

	if ( isset( $_GET['cyh_slugs_fixed'] ) ) {
		printf(
			'<div class="notice notice-success is-dismissible"><p><strong>%d آدرس اصلاح شد.</strong> آدرس‌ها اکنون لاتین و بر اساس برند و کد فنی هستند.</p></div>',
			(int) $_GET['cyh_slugs_fixed']
		);
		return;
	}

	// فقط وقتی واقعاً آدرس فارسی وجود دارد هشدار می‌دهیم.
	global $wpdb;
	$bad = (int) $wpdb->get_var(
		"SELECT COUNT(*) FROM {$wpdb->posts}
		 WHERE post_type IN ('product','brand','industry','datasheet')
		   AND post_status NOT IN ('trash','auto-draft')
		   AND post_name REGEXP '[^ -~]'"
	);

	if ( $bad < 1 ) {
		return;
	}

	$url = wp_nonce_url( admin_url( 'admin-post.php?action=cyh_repair_slugs' ), 'cyh_repair_slugs' );

	printf(
		'<div class="notice notice-warning"><p><strong>⚠️ %d آدرس (URL) فارسی پیدا شد.</strong> '
		. 'آدرس فارسی در اشتراک‌گذاری به کدهای درصددار تبدیل می‌شود (مثلاً %%DA%%A9...) و برای سئو و ارسال لینک به مشتری مناسب نیست. '
		. 'با یک کلیک همه بر اساس برند و کد فنی به آدرس لاتین تبدیل می‌شوند.</p>'
		. '<p><a class="button button-primary" href="%s">اصلاح آدرس‌ها</a></p></div>',
		$bad,
		esc_url( $url )
	);
}
add_action( 'admin_notices', 'cyh_slug_repair_notice' );
