<?php
/**
 * فیلدهای «هویت دسته» روی ترم‌های crane_category.
 *
 * ---------------------------------------------------------------------------
 * مسئله‌ای که این فایل حل می‌کند
 *
 * تا پیش از این، ساختار دسته‌بندی در فایل `src/data/taxonomy.ts` نوشته شده
 * بود و وردپرس فقط یک فهرست تخت از نام‌ها بود. یعنی:
 *
 *   • مدیر سایت نمی‌توانست دسته‌ی جدید بسازد — باید برنامه‌نویس کد می‌نوشت.
 *   • «گروه فنی» (سیلو) فقط یک رشته‌ی متنی داخل توضیح ترم بود، نه رابطه‌ی
 *     واقعیِ والد-فرزند.
 *   • تاکسونومی hierarchical ثبت شده بود ولی هیچ ترم والدی وجود نداشت، پس
 *     کشوی «دستهٔ مادر» ۳۱ دسته‌ی برگ را نشان می‌داد — یعنی یک تله.
 *
 * حالا وردپرس مرجع است. اما نام و توضیح به‌تنهایی کافی نیست: فرانت‌اند برای
 * هر دسته به عبارت کلیدی، آیکون و مترادف‌ها هم نیاز دارد. این فایل همان
 * فیلدها را روی خودِ ترم اضافه می‌کند تا هیچ‌چیزی در کد باقی نماند.
 *
 * تقسیم کار بین فیلد بومی وردپرس و ACF — عمدی است:
 *   • «نام» ترم        → نام نمایشی دسته
 *   • «نامک» ترم       → اسلاگ URL (باید لاتین باشد؛ در پایین اجبار می‌شود)
 *   • «توضیح» ترم      → همان blurb/intro. فیلد بومی است، پس فیلد جدید نساختیم.
 *   • ACF              → فقط چیزهایی که وردپرس معادل بومی ندارد.
 *
 * ⚠️ نام `graphql_field_name` این گروه عمداً `categoryMeta` است و **نباید**
 * با `categoryContent` یکی شود. دو گروه ACF با یک graphql_field_name باعث
 * می‌شوند یکی از آن‌ها بی‌سروصدا از اسکیما حذف شود — این باگ قبلاً در همین
 * پروژه اتفاق افتاده و سه بیلد را سوزانده است.
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * ثبت گروه فیلد.
 *
 * از `acf_add_local_field_group()` استفاده می‌کنیم و نه از Local JSON:
 * فایل JSON فقط گروه را «قابل همگام‌سازی» می‌کند و مدیر باید دستی Sync
 * بزند. این تابع بلافاصله ثبت می‌کند و هیچ قدم دستی لازم ندارد.
 */
function cyh_register_category_meta_fields() {
	if ( ! function_exists( 'acf_add_local_field_group' ) ) {
		return;
	}

	acf_add_local_field_group(
		[
			'key'                   => 'group_cyh_category_meta',
			'title'                 => 'هویت دسته (سئو و نمایش)',
			'graphql_field_name'    => 'categoryMeta',
			'show_in_graphql'       => 1,
			'menu_order'            => 0,
			'position'              => 'normal',
			'active'                => true,
			'description'           => 'این فیلدها ساختار و متادیتای دسته را تعیین می‌کنند. فرانت‌اند دقیقاً همین‌ها را می‌خواند.',
			'location'              => [
				[
					[
						'param'    => 'taxonomy',
						'operator' => '==',
						'value'    => 'crane_category',
					],
				],
			],
			'fields'                => [
				[
					'key'          => 'field_cyh_cat_keyword',
					'label'        => 'عبارت کلیدی',
					'name'         => 'keyword',
					'type'         => 'text',
					'instructions' => 'عبارتی که این صفحه باید برایش رتبه بگیرد — در &lt;title&gt; و &lt;h1&gt; استفاده می‌شود. مثال: «کوپلینگ جرثقیل سقفی». اگر خالی بماند، از نام دسته استفاده می‌شود.',
					'show_in_graphql' => 1,
				],
				[
					'key'          => 'field_cyh_cat_aka',
					'label'        => 'نام‌های دیگر (مترادف)',
					'name'         => 'aka',
					'type'         => 'textarea',
					'rows'         => 3,
					'instructions' => 'هر مترادف در یک خط. این‌ها صفحه‌ی جدا نمی‌گیرند و فقط در جستجوی داخلی سایت به کار می‌روند. مثال: «کوبلینگ».',
					'show_in_graphql' => 1,
				],
				[
					'key'          => 'field_cyh_cat_icon',
					'label'        => 'مسیر آیکون SVG',
					'name'         => 'icon_path',
					'type'         => 'textarea',
					'rows'         => 2,
					'instructions' => 'اختیاری و فنی. محتوای صفت <code>d</code> در یک آیکون ۲۴×۲۴ خطی. اگر خالی بماند، آیکون پیش‌فرض استفاده می‌شود و هیچ خطایی رخ نمی‌دهد — این فیلد را می‌توانید نادیده بگیرید.',
					'show_in_graphql' => 1,
				],
			],
		]
	);
}
add_action( 'acf/init', 'cyh_register_category_meta_fields' );


/**
 * اجبار اسلاگ لاتین روی ترم‌های crane_category.
 *
 * ⚠️ باگی که این تابع رفع می‌کند — و بدون آن کل معماری جدید می‌شکند:
 * مدیر سایت دسته را با نام فارسی می‌سازد («کوپلینگ جرثقیل سقفی») و فیلد
 * نامک را خالی می‌گذارد. وردپرس اسلاگ را از همان نام فارسی می‌سازد و
 * نتیجه یک اسلاگ درصدکدشده است:
 *
 *     /categories/hoist-accessories/%DA%A9%D9%88%D9%BE%D9%84%DB%8C%D9%86%DA%AF
 *
 * چنین URLای در گوگل بد دیده می‌شود، در واتس‌اپ شکسته می‌شود و در فایل‌های
 * استاتیک دردسر می‌سازد. پس اگر اسلاگ لاتین نبود، جلوی ذخیره را نمی‌گیریم
 * (که تجربه‌ی بدی است) بلکه یک اسلاگ لاتینِ موقت و یکتا می‌سازیم و به مدیر
 * هشدار می‌دهیم که آن را اصلاح کند.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️⚠️ خطای مرگبار نسخه‌ی ۱.۳.۰ — و درسی که از آن گرفته شد
 * ═══════════════════════════════════════════════════════════════════════════
 * نسخه‌ی ۱.۳.۰ این منطق را روی فیلتر `pre_term_slug` سوار کرده بود، با
 * امضای سه‌آرگومانی:
 *
 *     add_filter( 'pre_term_slug', 'cyh_...', 10, 3 );
 *     function cyh_...( $slug, $term_id, $taxonomy )
 *
 * اما هسته‌ی وردپرس این فیلتر را فقط با **دو** آرگومان صدا می‌زند:
 *
 *     // wp-includes/taxonomy.php → sanitize_term_field()
 *     $value = apply_filters( "pre_term_{$field}", $value, $taxonomy );
 *
 * در PHP 8، فراخوانی تابعی که سه پارامتر *اجباری* دارد با دو آرگومان،
 * یک ArgumentCountError پرتاب می‌کند — و چون این فیلتر در مسیر بارگذاری
 * پنل اجرا می‌شود، کل سایت با «خطای بحرانی» سفید می‌شد.
 *
 * دو تغییر که این کلاس از باگ را می‌بندد:
 *
 *   ۱) هوک درست: `wp_insert_term_data` و `wp_update_term_data` که آرایه‌ی
 *      کامل داده را می‌دهند و امضای مستندشان روشن است.
 *   ۲) **هر پارامتر هوک مقدار پیش‌فرض دارد.** حتی اگر آرایه‌ی آرگومان‌ها
 *      روزی تغییر کند، نتیجه یک رفتار ناقص است، نه سفید شدن سایت.
 *      هیچ کال‌بک هوکی در این افزونه نباید پارامتر بدون پیش‌فرض داشته باشد.
 *
 * صحت امضاها با `npm run check:hooks` سنجیده می‌شود.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * اگر اسلاگ لاتین نبود، یک اسلاگ موقتِ یکتا برمی‌گرداند.
 *
 * @param string $slug اسلاگ پیشنهادی.
 * @return string
 */
function cyh_latin_slug_or_placeholder( $slug ) {
	$slug = (string) $slug;

	// اسلاگ سالم: فقط حروف کوچک لاتین، رقم و خط تیره.
	if ( '' !== $slug && preg_match( '/^[a-z0-9-]+$/', $slug ) ) {
		return $slug;
	}

	// شناسه‌ی ترم هنوز وجود ندارد (هنگام درج)، پس از یک شناسه‌ی کوتاه و
	// یکتا استفاده می‌کنیم. مدیر سایت آن را با هشدار پنل اصلاح می‌کند.
	$base      = 'category-' . substr( md5( $slug . microtime( true ) . wp_rand() ), 0, 6 );
	$candidate = $base;
	$suffix    = 2;

	while ( term_exists( $candidate, 'crane_category' ) ) {
		$candidate = $base . '-' . $suffix;
		$suffix++;
	}

	return $candidate;
}

/**
 * هنگام ساخت دسته‌ی جدید.
 *
 * امضای هسته: apply_filters( 'wp_insert_term_data', $data, $taxonomy, $args )
 *
 * @param array  $data     آرایه‌ی name/slug/term_group.
 * @param string $taxonomy تاکسونومی.
 * @param array  $args     آرگومان‌های اصلی.
 * @return array
 */
function cyh_force_latin_slug_on_insert( $data = [], $taxonomy = '', $args = [] ) {
	if ( 'crane_category' !== $taxonomy || ! is_array( $data ) ) {
		return $data;
	}

	$data['slug'] = cyh_latin_slug_or_placeholder( $data['slug'] ?? '' );

	return $data;
}
add_filter( 'wp_insert_term_data', 'cyh_force_latin_slug_on_insert', 10, 3 );

/**
 * هنگام ویرایش دسته‌ی موجود.
 *
 * امضای هسته: apply_filters( 'wp_update_term_data', $data, $term_id, $taxonomy, $args )
 *
 * @param array  $data     آرایه‌ی name/slug/term_group.
 * @param int    $term_id  شناسه‌ی ترم.
 * @param string $taxonomy تاکسونومی.
 * @param array  $args     آرگومان‌های اصلی.
 * @return array
 */
function cyh_force_latin_slug_on_update( $data = [], $term_id = 0, $taxonomy = '', $args = [] ) {
	if ( 'crane_category' !== $taxonomy || ! is_array( $data ) ) {
		return $data;
	}

	$data['slug'] = cyh_latin_slug_or_placeholder( $data['slug'] ?? '' );

	return $data;
}
add_filter( 'wp_update_term_data', 'cyh_force_latin_slug_on_update', 10, 4 );


/**
 * هشدار به مدیر اگر دسته‌ای اسلاگ موقت دارد.
 *
 * بدون این، اسلاگ موقت بی‌سروصدا در URL می‌نشیند و ماه‌ها کسی نمی‌فهمد.
 */
function cyh_warn_placeholder_category_slugs() {
	$screen = get_current_screen();
	if ( ! $screen || 'edit-crane_category' !== $screen->id ) {
		return;
	}

	$terms = get_terms(
		[
			'taxonomy'   => 'crane_category',
			'hide_empty' => false,
		]
	);

	if ( is_wp_error( $terms ) ) {
		return;
	}

	$bad = [];
	foreach ( $terms as $term ) {
		if ( preg_match( '/^category-\d+(-\d+)?$/', $term->slug ) ) {
			$bad[] = $term->name;
		}
	}

	if ( ! $bad ) {
		return;
	}

	printf(
		'<div class="notice notice-warning"><p><strong>%d دسته اسلاگ موقت دارد:</strong> %s<br>' .
		'نامک این دسته‌ها را به یک عبارت لاتین معنادار تغییر دهید (مثال: <code>crane-coupling</code>). ' .
		'تا آن زمان، آدرس صفحه‌ی آن‌ها معنادار نیست.</p></div>',
		count( $bad ),
		esc_html( implode( '، ', $bad ) )
	);
}
add_action( 'admin_notices', 'cyh_warn_placeholder_category_slugs' );
