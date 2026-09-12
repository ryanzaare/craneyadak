<?php
/**
 * Plugin Name:       Crane Yadak — Headless Backend
 * Plugin URI:        https://craneyadak.com
 * Description:       بک‌اند Headless برای فرانت‌اند Astro سایت کرین یدک. CPTهای محصول/برند/صنعت/سند فنی
 *                     را با پشتیبانی WPGraphQL ثبت می‌کند، فیلدهای ACF Pro را از طریق Local JSON همگام
 *                     نگه می‌دارد، و یک اندپوینت REST امن برای فرم استعلام قیمت فراهم می‌کند.
 * Version:           3.1.0
 * Requires PHP:      8.0
 * Requires Plugins:  advanced-custom-fields-pro, wp-graphql
 * Author:            Crane Yadak Engineering
 * Text Domain:       crane-yadak-headless
 *
 * ---------------------------------------------------------------------------
 * نکته معماری مهم: این پلاگین به‌عمد به‌جای افزودن منطق پراکنده در functions.php
 * قالب، به‌صورت یک پلاگین مستقل نوشته شده. چرا؟ چون در معماری Headless، قالب
 * (Theme) اصلاً رندر نمی‌شود — تنها وردپرس به‌عنوان منبع داده (از طریق
 * WPGraphQL) استفاده می‌شود. نگه‌داشتن منطق CPT/ACF/REST در یک پلاگین یعنی
 * حتی با تعویض قالب هم، بک‌اند سالم می‌ماند.
 * ---------------------------------------------------------------------------
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // دسترسی مستقیم مجاز نیست.
}

/**
 * ⚠️ نگهبان نسخه‌ی تکراری — رفع خطای «افزونه به‌دلیل مشکلی جدی فعال نشد».
 *
 * ═══════════════════════════════════════════════════════════════════════
 * چه اتفاقی افتاد
 * ═══════════════════════════════════════════════════════════════════════
 * دو نسخه از این افزونه هم‌زمان در wp-content/plugins قرار گرفت. وقتی
 * نسخه‌ی دوم فعال می‌شود در حالی که نسخه‌ی اول فعال است، PHP همه‌ی
 * توابع `cyh_*` را برای بار دوم می‌بیند و خطای مرگبار می‌دهد:
 *
 *     Fatal error: Cannot redeclare cyh_activate()
 *
 * وردپرس این خطا را می‌گیرد و فقط جمله‌ی مبهم «افزونه به‌دلیل داشتن
 * مشکلی جدی فعال نشد» را نشان می‌دهد — بدون گفتن این‌که علت، وجود یک
 * نسخه‌ی دوم است. مدیر سایت هیچ راهی ندارد بفهمد مشکل از کجاست.
 *
 * علت وجود نسخه‌ی دوم، خطای من در ساخت فایل zip بود: آرشیو را از داخل
 * پوشه‌ی افزونه ساخته بودم، پس فایل‌ها در ریشه‌ی zip بودند و پوشه‌ی
 * والد وجود نداشت. وردپرس در این حالت پوشه را خودش می‌سازد و نتیجه‌اش
 * یک نصب دوم در کنار نصب قبلی است.
 *
 * این نگهبان خطای مرگبار را به یک پیام خوانا تبدیل می‌کند و به‌جای
 * سفیدشدن صفحه، دقیقاً می‌گوید چه باید کرد.
 */
if ( defined( 'CYH_VERSION' ) ) {
	add_action(
		'admin_notices',
		static function () {
			echo '<div class="notice notice-error"><p><strong>کرین یدک:</strong> دو نسخه از این افزونه هم‌زمان نصب است و نسخه‌ی دوم بارگذاری نشد.</p>' .
				'<p>به <em>افزونه‌ها</em> بروید، نسخه‌ی تکراری «Crane Yadak — Headless Backend» را <strong>غیرفعال و حذف</strong> کنید، سپس تنها یک نسخه را فعال نگه دارید.</p>' .
				'<p>حذف افزونه هیچ داده‌ای را پاک نمی‌کند — محصولات، برندها، دسته‌ها و مقادیر ACF در پایگاه داده باقی می‌مانند.</p></div>';
		}
	);
	return;
}

define( 'CYH_VERSION', '3.1.0' );
define( 'CYH_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'CYH_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * بررسی پیش‌نیازها — به‌جای شکست خاموش، به مدیر سایت هشدار واضح می‌دهد که
 * ACF Pro و WPGraphQL نصب/فعال نیستند. این یک تصمیم آگاهانه است: بدون این
 * دو افزونه، هیچ‌کدام از CPTها یا فیلدها در گراف‌کیوال قابل مشاهده نخواهند
 * بود و دیباگ آن بدون این پیام هشدار بسیار زمان‌بر خواهد بود.
 */
function cyh_check_dependencies() {
	$missing = [];

	if ( ! class_exists( 'ACF' ) ) {
		$missing[] = 'Advanced Custom Fields PRO';
	}

	if ( ! class_exists( 'WPGraphQL' ) ) {
		$missing[] = 'WPGraphQL';
	}

	if ( ! empty( $missing ) ) {
		add_action(
			'admin_notices',
			function () use ( $missing ) {
				printf(
					'<div class="notice notice-error"><p><strong>Crane Yadak Headless:</strong> افزونه(های) پیش‌نیاز فعال نیستند: %s. تا نصب و فعال‌سازی این افزونه‌ها، محصولات/برندها/صنایع در WPGraphQL قابل کوئری نخواهند بود.</p></div>',
					esc_html( implode( '، ', $missing ) )
				);
			}
		);
	}
}
add_action( 'admin_init', 'cyh_check_dependencies' );

/**
 * ⚠️ حیاتی: معرفی پوشه‌ی acf-json این پلاگین به ACF.
 *
 * باگی که این تابع رفع می‌کند: ACF به‌صورت پیش‌فرض فقط پوشه‌ی `acf-json`
 * داخل *قالب* را برای Local JSON اسکن می‌کند. یک پلاگین باید مسیر خودش را
 * صراحتاً با فیلتر `acf/settings/load_json` معرفی کند؛ وگرنه فایل‌های JSON
 * گروه‌های فیلد هرگز خوانده نمی‌شوند و عملاً انگار وجود ندارند.
 *
 * علامت این باگ در فرانت‌اند دقیقاً همین بود:
 *   Cannot query field "productFields" on type "CraneProduct"
 *   Cannot query field "brandFields" on type "CraneBrand"
 * یعنی CPTها درست ثبت شده بودند اما هیچ گروه فیلدی به آن‌ها وصل نبود، چون
 * ACF اصلاً این پنج فایل JSON را ندیده بود.
 *
 * نکته: مسیر پیش‌فرض قالب حذف نمی‌شود، فقط مسیر این پلاگین به آن اضافه
 * می‌شود — تا اگر روزی گروه فیلدی سمت قالب تعریف شد، از کار نیفتد.
 */
function cyh_register_acf_json_load_path( $paths ) {
	$paths[] = CYH_PLUGIN_DIR . 'acf-json';
	return $paths;
}
add_filter( 'acf/settings/load_json', 'cyh_register_acf_json_load_path' );

/**
 * ⚠️ ثبت مستقیم گروه‌های فیلد — رفع ریشه‌ای یک باگ که سه بار تکرار شد.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * چرا فیلتر load_json بالا کافی نبود
 * ═══════════════════════════════════════════════════════════════════════
 * `acf/settings/load_json` فقط به ACF می‌گوید «در این پوشه هم دنبال
 * فایل بگرد». نتیجه‌اش این است که گروه‌ها در پنل زیر
 * ACF ← گروه‌های فیلد ← «Sync available» *ظاهر می‌شوند* — اما تا وقتی
 * مدیر سایت روی دکمه‌ی Sync کلیک نکند، در پایگاه داده ثبت نمی‌شوند و
 * برای WPGraphQL اصلاً وجود ندارند.
 *
 * علامتش دقیقاً همین خطاها بود، سه بار پشت سر هم:
 *   Cannot query field "isDemo" on type "CraneProduct"
 *   Cannot query field "priceHistory" on type "ProductFields"
 *
 * هر بار علت یکی بود: من یک گروه فیلد جدید به مخزن اضافه می‌کردم،
 * افزونه نصب می‌شد، اما آن گروه هرگز sync نمی‌شد. یعنی هر تغییر فیلد،
 * یک مرحله‌ی دستیِ نامرئی لازم داشت که فراموش کردنش قطعی بود.
 *
 * `acf_add_local_field_group()` گروه را در همان لحظه ثبت می‌کند — بدون
 * پایگاه داده، بدون کلیک، بدون امکان فراموش شدن. نصب افزونه یعنی وجود
 * فیلدها. این کلاسِ باگ از اینجا به بعد ممکن نیست.
 *
 * نکته: اگر گروهی قبلاً sync شده و در پایگاه داده باشد، نسخه‌ی پایگاه
 * داده اولویت دارد و ACF نسخه‌ی محلی را نادیده می‌گیرد. پس این تابع
 * نصب‌های فعلی را خراب نمی‌کند.
 */
function cyh_register_local_field_groups() {
	if ( ! function_exists( 'acf_add_local_field_group' ) ) {
		return;
	}

	$seen_keys = [];
	$seen_gql  = [];

	foreach ( (array) glob( CYH_PLUGIN_DIR . 'acf-json/*.json' ) as $file ) {
		$raw = file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		if ( false === $raw ) {
			continue;
		}

		$group = json_decode( $raw, true );

		// گروه بدون key برای ACF بی‌معناست و ثبتش خطا می‌دهد.
		if ( ! is_array( $group ) || empty( $group['key'] ) ) {
			continue;
		}

		/*
		 * ⚠️ نگهبان فایل تکراری — رفع خطای «categoryContent در دو فایل».
		 *
		 * ریشه‌ی باگ: ACF هنگام ذخیره‌ی یک گروه، فایل را همیشه به نام
		 * `{key}.json` می‌نویسد. اما نام فایل‌های این پوشه با key آن‌ها
		 * یکی نبود (`group_category_content.json` در برابر key
		 * `group_cyh_category_content`). پس اولین باری که مدیر سایت یک
		 * گروه را در پنل ویرایش و ذخیره کرد، ACF فایل *دومی* ساخت با
		 * همان key و همان graphql_field_name — و این حلقه هر دو را ثبت
		 * می‌کرد. نتیجه: تصادم قرمز در WPGraphQL.
		 *
		 * ریشه‌ی مشکل با هم‌نام کردن فایل و key حل شد. این نگهبان لایه‌ی
		 * دوم است: حتی اگر روزی فایل سرگردانی پیدا شود، اولین ثبت برنده
		 * است و بقیه با هشدار رد می‌شوند — نه اینکه بی‌صدا اسکیما بشکند.
		 */
		if ( isset( $seen_keys[ $group['key'] ] ) ) {
			$GLOBALS['cyh_acf_dupe_files'][] = [ basename( $file ), $seen_keys[ $group['key'] ], $group['key'] ];
			continue;
		}

		$gql = $group['graphql_field_name'] ?? '';
		if ( $gql && isset( $seen_gql[ $gql ] ) ) {
			$GLOBALS['cyh_acf_dupe_files'][] = [ basename( $file ), $seen_gql[ $gql ], $gql ];
			continue;
		}

		$seen_keys[ $group['key'] ] = basename( $file );
		if ( $gql ) {
			$seen_gql[ $gql ] = basename( $file );
		}

		acf_add_local_field_group( $group );
	}
}

/**
 * هشدار درباره‌ی فایل‌های ACF تکراری که رد شدند.
 */
function cyh_notice_acf_duplicate_files() {
	if ( empty( $GLOBALS['cyh_acf_dupe_files'] ) ) {
		return;
	}

	echo '<div class="notice notice-warning"><p><strong>کرین یدک:</strong> فایل(های) گروه فیلد تکراری در پوشه‌ی <code>acf-json</code> پیدا شد و نادیده گرفته شدند:</p><ul style="list-style:disc;margin-inline-start:24px">';
	foreach ( $GLOBALS['cyh_acf_dupe_files'] as $dupe ) {
		printf(
			'<li><code>%s</code> با <code>%s</code> تصادم دارد (روی <code>%s</code>) — فایل اول نادیده گرفته شد.</li>',
			esc_html( $dupe[0] ),
			esc_html( $dupe[1] ),
			esc_html( $dupe[2] )
		);
	}
	echo '</ul><p>فایل اضافی را از پوشه‌ی افزونه حذف کنید. نام هر فایل باید دقیقاً برابر <code>key</code> داخلش باشد.</p></div>';
}
add_action( 'admin_notices', 'cyh_notice_acf_duplicate_files' );
add_action( 'acf/init', 'cyh_register_local_field_groups' );

/**
 * ⚠️ نگهبانِ تصادم نام گراف‌کیوال — رفع باگی که سه بیلد طول کشید.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * باگ واقعی چه بود
 * ═══════════════════════════════════════════════════════════════════════
 * فیلد `price_history` در یک گروه *جداگانه* تعریف شده بود، اما همان
 * `graphql_field_name` گروه اصلی را داشت: هر دو «productFields».
 *
 * WPGraphQL برای ACF نمی‌تواند دو گروه فیلد را در یک تایپ ادغام کند.
 * وقتی دو گروه یک نام را ادعا کنند، یکی برنده می‌شود و دیگری بی‌صدا
 * کنار گذاشته می‌شود. نتیجه: `price_history` هرگز زیر `productFields`
 * ظاهر نشد و خطای زیر در هر بیلد تکرار شد:
 *
 *     Cannot query field "priceHistory" on type "ProductFields"
 *
 * این خطا شبیه «افزونه قدیمی است» به نظر می‌رسید و من دو بار همان را
 * تشخیص دادم — در حالی که مشکل، تعریفِ خودِ گروه بود نه نسخه‌ی افزونه.
 * فیلد حالا داخل group_product_fields.json ادغام شده است.
 *
 * این تابع تضمین می‌کند اگر روزی دوباره چنین تصادمی ساخته شد، به‌جای یک
 * خطای مبهم در بیلد فرانت‌اند، یک هشدار صریح در پنل وردپرس دیده شود.
 */
function cyh_warn_on_graphql_name_collision() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$seen  = [];
	$clash = [];

	foreach ( (array) glob( CYH_PLUGIN_DIR . 'acf-json/*.json' ) as $file ) {
		$raw   = file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		$group = false === $raw ? null : json_decode( $raw, true );

		if ( ! is_array( $group ) || empty( $group['graphql_field_name'] ) ) {
			continue;
		}

		// دو گروه فقط وقتی تصادم دارند که روی *همان* نوع محتوا باشند.
		$types = [];
		foreach ( (array) ( $group['location'] ?? [] ) as $rule_group ) {
			foreach ( (array) $rule_group as $rule ) {
				if ( isset( $rule['param'], $rule['value'] ) && 'post_type' === $rule['param'] ) {
					$types[] = $rule['value'];
				}
			}
		}

		$key = $group['graphql_field_name'] . '|' . implode( ',', $types );

		if ( isset( $seen[ $key ] ) ) {
			$clash[ $key ] = [ $seen[ $key ], basename( $file ) ];
		}
		$seen[ $key ] = basename( $file );
	}

	if ( empty( $clash ) ) {
		return;
	}

	echo '<div class="notice notice-error"><p><strong>کرین یدک — تصادم نام گراف‌کیوال:</strong></p><ul style="list-style:disc;margin-right:20px">';
	foreach ( $clash as $key => $files ) {
		printf(
			'<li><code>%s</code> در دو فایل تعریف شده: <code>%s</code> و <code>%s</code></li>',
			esc_html( explode( '|', $key )[0] ),
			esc_html( $files[0] ),
			esc_html( $files[1] )
		);
	}
	echo '</ul><p>دو گروه فیلد نمی‌توانند یک نام گراف‌کیوال داشته باشند؛ یکی بی‌صدا نادیده گرفته می‌شود. فیلدها را در یک گروه ادغام کنید.</p></div>';
}
add_action( 'admin_notices', 'cyh_warn_on_graphql_name_collision' );

/**
 * محل ذخیره‌ی تغییرات گروه‌های فیلد نیز همین پوشه است، تا اگر مدیر سایت در
 * پنل ACF چیزی را ویرایش کرد، همان فایل JSON داخل پلاگین به‌روز شود و
 * تعریف فیلدها بین وردپرس و مخزن کد از هم واگرا نشود.
 */
function cyh_register_acf_json_save_path( $path ) {
	return CYH_PLUGIN_DIR . 'acf-json';
}
add_filter( 'acf/settings/save_json', 'cyh_register_acf_json_save_path' );

/**
 * گروه‌های ACF یتیم — آن‌هایی که در وردپرس هستند ولی مخزن نمی‌شناسدشان.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * شکافی که این تابع می‌بندد
 * ═══════════════════════════════════════════════════════════════════════
 * سند معماری فهرستی از گروه‌های ACF داشت با عنوان «پاک می‌شوند»، و بعداً
 * علامت «✅ اجرا شد» خورد چون **فایل‌های فرانت‌اند** بررسی و تأیید شدند
 * که حذف شده‌اند. ولی گروه ACF فقط در مخزن حذف نشده بود — باید از خودِ
 * وردپرس هم حذف می‌شد، و نشد.
 *
 * نتیجه: سه گروه (`datasheet_fields`، `category_content`، `brand_profile`)
 * ماه‌ها در پنل زنده ماندند. یعنی صفحه‌ی ویرایش برند هنوز ۱۲ فیلد قدیمی
 * نشان می‌داد، در حالی که همه‌ی مستندات می‌گفتند آن مدل بازنشسته شده.
 *
 * ریشه‌ی مسئله ساختاری است: `check-architecture.mjs` فقط پوشه‌ی `acf-json`
 * را می‌بیند. هیچ ابزاری در سمت مخزن نمی‌تواند بداند در پایگاه داده‌ی
 * وردپرس چه هست. تنها جایی که می‌شود این را فهمید، **داخل خود وردپرس**
 * است — یعنی همین‌جا.
 *
 * این تابع چیزی حذف نمی‌کند. حذف تصمیم انسان است؛ کار این تابع فقط این
 * است که دیگر ممکن نباشد کسی نداند.
 */
function cyh_acf_orphan_groups() {
	if ( ! function_exists( 'acf_get_field_groups' ) ) {
		return [];
	}

	$known = [];
	foreach ( (array) glob( CYH_PLUGIN_DIR . 'acf-json/*.json' ) as $file ) {
		$raw = file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		if ( false === $raw ) {
			continue;
		}
		$g = json_decode( $raw, true );
		if ( is_array( $g ) && ! empty( $g['key'] ) ) {
			$known[ $g['key'] ] = true;
		}
	}

	// اگر هیچ JSONای خوانده نشد یعنی مسیر خراب است، نه اینکه همه یتیم‌اند.
	if ( ! $known ) {
		return [];
	}

	$orphans = [];
	foreach ( (array) acf_get_field_groups() as $group ) {
		$key = $group['key'] ?? '';
		if ( '' === $key || isset( $known[ $key ] ) ) {
			continue;
		}
		// گروه‌های local متعلق به افزونه‌های دیگرند و به ما ربطی ندارند.
		if ( ! empty( $group['local'] ) ) {
			continue;
		}
		$orphans[] = [ $key, (string) ( $group['title'] ?? $key ) ];
	}

	return $orphans;
}

function cyh_acf_orphan_notice() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	$id     = is_object( $screen ) ? (string) ( $screen->id ?? '' ) : '';
	if ( false === strpos( $id, 'acf-field-group' ) ) {
		return;
	}

	$orphans = cyh_acf_orphan_groups();
	if ( ! $orphans ) {
		return;
	}

	$rows = [];
	foreach ( $orphans as $o ) {
		$rows[] = sprintf( '<li><strong>%s</strong> — <code>%s</code></li>', esc_html( $o[1] ), esc_html( $o[0] ) );
	}

	printf(
		'<div class="notice notice-warning"><p><strong>%d گروه فیلد در وردپرس هست که افزونه نمی‌شناسد:</strong></p><ul style="margin-inline-start:20px;list-style:disc">%s</ul>' .
		'<p>این‌ها یا از نسخه‌های قدیمی مانده‌اند یا دستی ساخته شده‌اند. اگر بازنشسته‌اند، ' .
		'<strong>حذفشان از همین صفحه لازم است</strong> — حذف از مخزن کافی نیست و آن‌ها را از پنل پاک نمی‌کند. ' .
		'مقادیر ذخیره‌شده در پایگاه داده با حذف گروه از بین نمی‌روند.</p></div>',
		count( $orphans ),
		implode( '', $rows )
	);
}
add_action( 'admin_notices', 'cyh_acf_orphan_notice' );

/**
 * هشدار «شما در صفحه‌ی اشتباه هستید».
 *
 * مسئله‌ی واقعی که این تابع حل می‌کند: روی این نصب وردپرس، یک نوع پست
 * دیگر با نامی شبیه «قطعات جرثقیل» وجود دارد که متعلق به این پلاگین نیست.
 * ادمین سایت (که لزوماً فنی نیست) وارد آن صفحه می‌شود، هیچ فیلدی از
 * فیلدهای محصول را نمی‌بیند و طبیعتاً نتیجه می‌گیرد که «پلاگین خراب است».
 * این دقیقاً یک بار اتفاق افتاد و یک چرخه‌ی کامل دیباگ هدر داد.
 *
 * وردپرس راهی برای جلوگیری از ثبت CPT توسط کد دیگر ندارد؛ اما می‌توان
 * لحظه‌ای که کاربر در صفحه‌ی اشتباه است را تشخیص داد و او را به صفحه‌ی
 * درست هدایت کرد.
 */
function cyh_warn_on_foreign_crane_post_type() {
	if ( ! function_exists( 'get_current_screen' ) ) {
		return;
	}

	$screen = get_current_screen();
	if ( ! $screen || ! in_array( $screen->base, [ 'post', 'edit' ], true ) ) {
		return;
	}

	$current = $screen->post_type;
	$ours    = [ 'product', 'brand', 'inquiry' ];

	// فقط وقتی هشدار می‌دهیم که: نوع پست جاری مال ما نباشد، و نامش به‌وضوح
	// شبیه محتوای همین پلاگین باشد. این محدودیت عمدی است تا روی نوشته‌ها و
	// برگه‌های عادی وردپرس هشدار بی‌ربط نشان داده نشود.
	if ( in_array( $current, $ours, true ) ) {
		return;
	}

	$object = get_post_type_object( $current );
	if ( ! $object ) {
		return;
	}

	$label = $object->labels->name ?? '';
	if ( ! preg_match( '/جرثقیل|قطعه|قطعات|crane|part/iu', $label . ' ' . $current ) ) {
		return;
	}

	$correct_url = admin_url( 'post-new.php?post_type=product' );

	printf(
		'<div class="notice notice-warning"><p><strong>توجه:</strong> این صفحه («%1$s») متعلق به افزونه‌ی کرین یدک نیست و فیلدهای محصول (کد فنی، برند، قیمت، دسته‌بندی) در آن نمایش داده نمی‌شوند. برای ثبت قطعه از منوی <strong>«محصولات کرین یدک»</strong> استفاده کنید. &nbsp;<a class="button button-primary" href="%2$s">افزودن محصول در صفحه‌ی درست</a></p></div>',
		esc_html( $label ),
		esc_url( $correct_url )
	);
}
add_action( 'admin_notices', 'cyh_warn_on_foreign_crane_post_type' );

require_once CYH_PLUGIN_DIR . 'includes/class-post-types.php';
require_once CYH_PLUGIN_DIR . 'includes/class-cors.php';
require_once CYH_PLUGIN_DIR . 'includes/class-rest-contact.php';
require_once CYH_PLUGIN_DIR . 'includes/class-admin-settings.php';
require_once CYH_PLUGIN_DIR . 'includes/class-options-page.php';
require_once CYH_PLUGIN_DIR . 'includes/class-deploy-webhook.php';
require_once CYH_PLUGIN_DIR . 'includes/class-ai-validator.php';
require_once CYH_PLUGIN_DIR . 'includes/class-content-import.php';
require_once CYH_PLUGIN_DIR . 'includes/class-community.php';
require_once CYH_PLUGIN_DIR . 'includes/class-taxonomy-hierarchy.php';
require_once CYH_PLUGIN_DIR . 'includes/class-category-meta.php';
require_once CYH_PLUGIN_DIR . 'includes/class-content-import-hub.php';
require_once CYH_PLUGIN_DIR . 'includes/class-legacy-cleanup.php';
require_once CYH_PLUGIN_DIR . 'includes/class-quote-requests.php';
require_once CYH_PLUGIN_DIR . 'includes/class-site-options-graphql.php';
require_once CYH_PLUGIN_DIR . 'includes/class-inquiry-uploads.php';

/**
 * فلاش‌کردن Rewrite Rules هنگام فعال/غیرفعال‌سازی — بدون این، اسلاگ‌های
 * سفارشی CPT (مثل /brands/) تا اولین ذخیره‌ی دستی Permalinks کار نمی‌کنند
 * و یک باگ کلاسیک و گیج‌کننده‌ی وردپرس برای هرکسی است که این مرحله را فراموش کند.
 */
function cyh_activate() {
	cyh_register_post_types();
	cyh_register_taxonomies();
	// نقش‌های سازمانی (کارشناس فنی، سردبیر، فروش) — فقط یک‌بار هنگام
	// فعال‌سازی ثبت می‌شوند؛ add_role در اجراهای بعدی بی‌اثر است.
	cyh_register_roles();
	flush_rewrite_rules();
}
register_activation_hook( __FILE__, 'cyh_activate' );

function cyh_deactivate() {
	flush_rewrite_rules();
	cyh_clear_deploy_cron(); // تعریف در includes/class-deploy-webhook.php
}
register_deactivation_hook( __FILE__, 'cyh_deactivate' );

/**
 * نکته آگاهانه (یافته‌شده در بازبینی — تصمیم عمدی، نه یک قلم فراموش‌شده):
 * این پلاگین عمداً هیچ uninstall.php ندارد که محصولات/برندها/و مخصوصاً
 * درخواست‌های استعلام (CPT «inquiry» که شامل نام و شماره تماس مشتریان
 * واقعی است) را هنگام حذف پلاگین پاک کند. حذف خودکار داده‌ی مشتری با یک
 * کلیک تصادفی «Delete» روی پلاگین، خطرناک‌تر از نگه‌داشتن چند رکورد
 * اضافه در دیتابیس است. اگر روزی نیاز به پاک‌سازی کامل بود، این کار باید
 * آگاهانه و دستی از داشبورد وردپرس انجام شود، نه خودکار و برگشت‌ناپذیر.
 */
