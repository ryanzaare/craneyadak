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
	// CPT: product
	// ---------------------------------------------------------------
	/*
	 * ⚠️ نگهبان تصادم — تنها چیزی که از یکپارچه‌سازی ووکامرس باقی مانده.
	 *
	 * ووکامرس هم نوع محتوایی به همین اسلاگ (`product`) ثبت می‌کند و دو ثبت
	 * هم‌نام یکدیگر را بازنویسی می‌کنند. نتیجه بسته به اولویت هوک است و هر
	 * دو حالتش خراب: یا `craneProducts` از گراف‌کیوال حذف می‌شود و کل لایه‌ی
	 * محصول فرانت‌اند در زمان build می‌میرد، یا پنل ووکامرس از کار می‌افتد.
	 *
	 * کل یکپارچه‌سازی ووکامرس حذف شد چون استفاده نمی‌شود، اما این ده خط
	 * عمداً ماند: اگر روزی کسی ووکامرس را نصب کند، به‌جای سفید شدن سایت،
	 * یک پیام روشن می‌گیرد. حذف این هم برای صرفه‌جویی چند کیلوبایت،
	 * معامله‌ی بدی است.
	 */
	if ( class_exists( 'WooCommerce' ) ) {
		add_action( 'admin_notices', function () {
			echo '<div class="notice notice-error"><p><strong>کرین یدک:</strong> ووکامرس فعال است و با نوع محتوای <code>product</code> این افزونه تصادم دارد.</p>' .
				'<p>تا زمانی که ووکامرس فعال باشد، محصولات کرین یدک ثبت نمی‌شوند و <code>craneProducts</code> در گراف‌کیوال وجود نخواهد داشت. ' .
				'ووکامرس را غیرفعال کنید، یا برای یکپارچه‌سازی درست با تیم فنی تماس بگیرید.</p></div>';
		} );
	} else {
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
	} // پایان: نگهبان تصادم ووکامرس

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

	/* ⚠️ CPT «اسناد فنی» (datasheet) حذف شد — و همه‌ی بازمانده‌هایش.

	   قابلیت اسناد فنی از فرانت‌اند حذف شد چون شش سندی که تعریف شده بود
	   عنوان‌های ساختگی برای فایل‌هایی بود که هرگز وجود نداشتند.

	   حذف‌شده‌ها (برای اینکه دوباره کسی دنبالشان نگردد):
	     • خودِ CPT
	     • گروه ACF «Datasheet Fields» (acf-json/group_datasheet_fields.json)
	     • فیلد `datasheet_files` روی محصول — Relationship به CPTای که
	       دیگر وجود نداشت، یعنی یک فیلد همیشه‌خالی در پنل.

	   اگر روزی سند فنی واقعی وجود داشت، فیلد جدید روی خودِ محصول اضافه
	   می‌شود — جایی که خریدار دنبالش می‌گردد، نه یک آرشیو مستقل. */

	// ---------------------------------------------------------------
	// CPT: inquiry — لاگ داخلی درخواست‌های فرم تماس (فقط wp-admin، هرگز در
	// GraphQL منتشر نمی‌شود چون شامل اطلاعات شخصی مشتری است). این CPT به‌عنوان
	// نسخه‌ی پشتیبان لید در کنار wp_mail عمل می‌کند — اگر SMTP سرور بخاطر هر
	// دلیلی ایمیل را نرساند (یک مشکل بسیار رایج هاست‌های اشتراکی ایران)، لید
	// هرگز به‌طور کامل گم نمی‌شود.
	// ---------------------------------------------------------------
	/* ⚠️ برچسب این CPT عوض شد.
	   قبلاً «درخواست‌های استعلام» نام داشت — دقیقاً همان برچسب CPT
	   جدید `cyh_quote`. نتیجه دو منوی هم‌نام در نوار کناری بود و
	   هیچ‌کس نمی‌فهمید کدام کدام است.

	   تفاوت واقعی این دو:
	     • این یکی (inquiry) → پیام‌های فرم «تماس با ما».
	     • cyh_quote         → سبد استعلام چندقلمی با کد رهگیری.
	   این CPT حذف نشد چون هنوز زنده است: اندپوینت REST فرم تماس
	   لیدها را در همین ثبت می‌کند. حذفش یعنی از دست رفتن لید. */
	register_post_type(
		'inquiry',
		[
			'labels'             => [
				'name'          => 'پیام‌های فرم تماس',
				'singular_name' => 'پیام تماس',
				'menu_name'     => 'پیام‌های تماس',
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
	/* ⚠️ `cyh_question` عمداً همین‌جا در آرایه‌ی object_type است و نه با
	   `register_taxonomy_for_object_type()` در فایل خودش.

	   نسخه‌ی اول همان کار را می‌کرد و **بی‌صدا شکست خورد**: آن فایل روی
	   `init` با اولویت ۵ اجرا می‌شود و این تابع روی اولویت پیش‌فرض ۱۰ —
	   یعنی وصل‌کردن تاکسونومی *پیش از ساخته‌شدن خودش* صدا زده می‌شد.
	   `register_taxonomy_for_object_type()` در این حالت فقط `false`
	   برمی‌گرداند و هیچ خطایی نمی‌دهد. نتیجه روی سایت:
	   «Cannot query field "craneCategories" on type "CraneQuestion"» و
	   کل بخش پرسش و پاسخ، خاموش.

	   ثبت در همین آرایه به ترتیب اجرای هوک‌ها وابسته نیست. CPT روی
	   اولویت ۵ ساخته می‌شود و این تابع روی ۱۰ آن را می‌بیند. */
	register_taxonomy(
		'crane_category',
		[ 'product', 'cyh_question' ],
		[
			'labels'              => [
				'name'          => 'دسته‌بندی قطعات',
				'singular_name' => 'دسته‌بندی',
			],
			'hierarchical'         => true,
			'public'               => true,
			'publicly_queryable'   => false,
			'show_ui'              => true,
			// از منوی «محصولات» خارج می‌شود و منوی مستقل خودش را می‌گیرد
			// (پایین همین فایل). دسته‌بندی یک موجودیت مستقل است، نه
			// زیرمجموعه‌ی محصول — و مدیر محتوا هم آن را همان‌جا می‌جوید.
			'show_in_menu'         => false,
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
	$targets = [ 'product', 'brand' ];
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

	$targets = [ 'product', 'brand' ];
	if ( ! in_array( $post->post_type, $targets, true ) ) {
		return;
	}

	$current = urldecode( (string) $post->post_name );

	// ⚠️ دو حالت باید ترمیم شوند، نه یکی.
	//
	// نسخه‌ی قبل فقط اسلاگ‌های غیر-ASCII را ترمیم می‌کرد و هر اسلاگ
	// انگلیسی را «دستی و عمدی» فرض می‌گرفت. اما خودِ فیلتر
	// cyh_force_latin_slug وقتی فیلدهای ACF هنوز ذخیره نشده‌اند، به
	// `{post_type}-{ID}` برمی‌گردد — یعنی `brand-59`. آن اسلاگ کاملاً
	// ASCII است، پس این تابع از کنارش رد می‌شد و هرگز ترمیمش نمی‌کرد.
	//
	// نتیجه‌ی واقعی روی سایت: هر ۱۷ برند با اسلاگ brand-59 تا brand-75
	// ماندند. آدرس‌ها بی‌معنا شدند و جست‌وجوی برند با اسلاگ لاتین
	// (که سایر بخش‌های کد انجام می‌دهند) شکست خورد.
	$is_placeholder = (bool) preg_match( '/^' . preg_quote( $post->post_type, '/' ) . '-\d+$/', $current );
	$is_ascii       = '' !== $current && ! preg_match( '/[^\x20-\x7E]/', $current );

	if ( $is_ascii && ! $is_placeholder ) {
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
			'post_type'      => [ 'product', 'brand' ],
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

/* ⚠️ ابزار «اصلاح آدرس‌ها» و تابع کمکی‌اش `cyh_find_broken_slugs()` اینجا
   بودند و **حذف شدند**. سه دلیل:

     ۱) سند معماری آن را «مهاجرت یک‌باره — حذف پس از آخرین اجرا» علامت زده
        بود و کارش تمام شده: هر ۷۱ صفحه با اسلاگ لاتین ساخته می‌شود.
     ۲) **دکمه‌اش مرده بود** — به `admin-post.php?action=cyh_repair_slugs`
        لینک می‌داد در حالی که هیچ `admin_post_cyh_repair_slugs` ثبت نشده
        بود. کلیک روی آن بی‌صدا هیچ کاری نمی‌کرد.
     ۳) تابع کمکی‌اش هیچ مصرف‌کننده‌ی دیگری نداشت.

   ⚠️ اما `cyh_force_latin_slug()` بالاتر **زنده و لازم** است: روی فیلتر
   `wp_unique_post_slug` نشسته و هر اسلاگ تازه را در لحظه‌ی ساخت لاتین
   می‌کند. آن پیشگیری است؛ این ابزارِ ترمیمِ گذشته بود. */
