<?php
/**
 * انتشار تنظیمات سایت در گراف‌کیوال — مستقل از «WPGraphQL for ACF».
 *
 * ---------------------------------------------------------------------------
 * ⚠️ چرا این فایل لازم شد
 *
 * فیلدهای ACF روی *نوع‌های محتوا* (محصول، برند) بدون مشکل در گراف‌کیوال
 * دیده می‌شوند — `productFields` و `brandFields` سال‌هاست کار می‌کنند.
 * اما گروه فیلدی که روی یک **Options Page** نشسته، هرگز در اسکیما ظاهر
 * نشد و کوئری با این خطا برمی‌گشت:
 *
 *     Cannot query field "siteOptionsFields" on type "RootQuery"
 *
 * علت: پشتیبانی افزونه‌ی «WPGraphQL for ACF» از Options Page بین
 * نسخه‌های ۱.x و ۲.x تغییر کرده و به تنظیمات و نسخه‌ی دقیق آن وابسته
 * است. یعنی یک چیز حیاتی (شماره تلفن، آدرس، پرسش‌های متداول) به رفتار
 * نسخه‌ی یک افزونه‌ی جانبی گره خورده بود.
 *
 * راه‌حل: خودمان فیلد را ثبت می‌کنیم. مقادیر با `get_field(..., 'option')`
 * خوانده می‌شوند — همان API ای که ACF برای options page تضمین می‌کند و
 * بین نسخه‌ها پایدار است. از این پس:
 *
 *   • هیچ وابستگی به پشتیبانی options page در WPGraphQL for ACF نیست.
 *   • شکل خروجی را خودمان تعیین می‌کنیم، پس فرانت‌اند قابل پیش‌بینی است.
 *   • ارتقای افزونه‌ی جانبی نمی‌تواند بی‌صدا اطلاعات تماس را خالی کند.
 *
 * ⚠️ این داده عمومی است (تلفن و آدرس روی سایت نمایش داده می‌شوند)، پس
 * انتشار آن در گراف عمومی مشکلی ندارد. برخلاف `cyh_quote` که داده‌ی
 * خصوصی مشتری است و عمداً از گراف‌کیوال بیرون نگه داشته شده.
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** خواندن امن یک فیلد option — رشته‌ی تمیز یا null. */
function cyh_option_text( $name ) {
	if ( ! function_exists( 'get_field' ) ) {
		return null;
	}
	$value = get_field( $name, 'option' );
	if ( ! is_string( $value ) ) {
		return null;
	}
	$value = trim( $value );
	return '' === $value ? null : $value;
}

/** خواندن امن یک فیلد عددی. */
function cyh_option_float( $name ) {
	if ( ! function_exists( 'get_field' ) ) {
		return null;
	}
	$value = get_field( $name, 'option' );
	return is_numeric( $value ) ? (float) $value : null;
}

function cyh_register_site_options_graphql() {
	if ( ! function_exists( 'register_graphql_object_type' ) ) {
		return;
	}

	register_graphql_object_type(
		'CraneFaq',
		[
			'description' => 'یک پرسش متداول',
			'fields'      => [
				'question' => [ 'type' => 'String' ],
				'answer'   => [ 'type' => 'String' ],
			],
		]
	);

	register_graphql_object_type(
		'CraneBusinessHours',
		[
			'description' => 'یک بازه‌ی ساعت کاری',
			/* ⚠️ نام فیلد باید `days` باشد، نه `dayOfWeek` — دقیقاً همان
			 * باگی که کامنت check-architecture.mjs («۰ج») توضیح می‌دهد:
			 * ACF فیلد را `days` نام‌گذاری کرده و site-options.ts هم
			 * `days` می‌خواهد. اینجا (تایپ سفارشی خودِ shape #1) با
			 * `dayOfWeek` ثبت شده بود و آن بررسی معماری این تایپ را
			 * اصلاً نمی‌بیند — رجکس فقط دنبال متن «siteOptionsFields{»
			 * می‌گردد، نه «craneSiteOptions{». یعنی shape #1 (که کامنت‌های
			 * بالای این فایل می‌گویند «همان چیزی که واقعاً کار می‌کند»)
			 * همیشه با «Cannot query field days» می‌افتاد و بی‌سروصدا به
			 * shape #2 تنزل می‌کرد — دقیقاً همان shapeای که کامنت‌ها
			 * می‌گفتند فقط برای سازگاری عقب‌رو است و احتمالاً هرگز کار
			 * نمی‌کند. */
			'fields'      => [
				'days'   => [ 'type' => [ 'list_of' => 'String' ] ],
				'opens'  => [ 'type' => 'String' ],
				'closes' => [ 'type' => 'String' ],
			],
		]
	);

	register_graphql_object_type(
		'CraneAdvantage',
		[
			'description' => 'یک مزیت روی بخش «چرا کرین یدک» در صفحه‌ی اصلی',
			'fields'      => [
				'title' => [ 'type' => 'String' ],
				'body'  => [ 'type' => 'String' ],
			],
		]
	);

	register_graphql_object_type(
		'CraneHighlight',
		[
			'description' => 'یک نکته‌ی کوتاه کنار بلوک اقتدار دامنه',
			'fields'      => [
				'label' => [ 'type' => 'String' ],
				'value' => [ 'type' => 'String' ],
			],
		]
	);

	register_graphql_object_type(
		'CraneHighWearPart',
		[
			'description' => 'یک قطعه در بخش «قطعات مصرفی و پرتعویض» صفحه‌ی اصلی',
			'fields'      => [
				'categorySlug' => [ 'type' => 'String' ],
				'reason'       => [ 'type' => 'String' ],
			],
		]
	);

	register_graphql_object_type(
		'CraneSiteOptions',
		[
			'description' => 'تنظیمات سراسری سایت کرین یدک',
			'fields'      => [
				'phonePrimary'          => [ 'type' => 'String' ],
				'phoneSecondary'        => [ 'type' => 'String' ],
				'whatsapp'              => [ 'type' => 'String' ],
				'supportEmail'          => [ 'type' => 'String' ],
				'addressStreet'         => [ 'type' => 'String' ],
				'addressCity'           => [ 'type' => 'String' ],
				'addressRegion'         => [ 'type' => 'String' ],
				'addressPostal'         => [ 'type' => 'String' ],
				'instagram'             => [ 'type' => 'String' ],
				'telegram'              => [ 'type' => 'String' ],
				'googleBusinessProfile' => [ 'type' => 'String' ],
				'neshan'                => [ 'type' => 'String' ],
				'balad'                 => [ 'type' => 'String' ],
				'geoLat'                => [ 'type' => 'Float' ],
				'geoLng'                => [ 'type' => 'Float' ],
				'faqs'                  => [ 'type' => [ 'list_of' => 'CraneFaq' ] ],
				'businessHours'         => [ 'type' => [ 'list_of' => 'CraneBusinessHours' ] ],
				'advantages'            => [ 'type' => [ 'list_of' => 'CraneAdvantage' ] ],
				'authorityHeading'      => [ 'type' => 'String' ],
				'authorityParagraphs'   => [ 'type' => [ 'list_of' => 'String' ] ],
				'authorityHighlights'   => [ 'type' => [ 'list_of' => 'CraneHighlight' ] ],
				'highWearParts'         => [ 'type' => [ 'list_of' => 'CraneHighWearPart' ] ],
			],
		]
	);

	register_graphql_field(
		'RootQuery',
		'craneSiteOptions',
		[
			'type'        => 'CraneSiteOptions',
			'description' => 'تنظیمات سراسری سایت (تماس، پرسش‌های متداول، ساعات کاری)',
			'resolve'     => function () {
				// ── پرسش‌های متداول ──
				$faqs = [];
				$raw_faqs = function_exists( 'get_field' ) ? get_field( 'faqs', 'option' ) : null;
				if ( is_array( $raw_faqs ) ) {
					foreach ( $raw_faqs as $row ) {
						if ( ! is_array( $row ) ) {
							continue;
						}
						$q = isset( $row['question'] ) ? trim( (string) $row['question'] ) : '';
						$a = isset( $row['answer'] ) ? trim( (string) $row['answer'] ) : '';
						// پرسش بدون پاسخ وارد اسکیمای FAQPage نمی‌شود.
						if ( '' !== $q && '' !== $a ) {
							$faqs[] = [ 'question' => $q, 'answer' => $a ];
						}
					}
				}

				// ── ساعات کاری ──
				$hours = [];
				$raw_hours = function_exists( 'get_field' ) ? get_field( 'business_hours', 'option' ) : null;
				if ( is_array( $raw_hours ) ) {
					foreach ( $raw_hours as $row ) {
						if ( ! is_array( $row ) ) {
							continue;
						}
						// نام واقعی زیرفیلد ACF (field_cyh_hours_days) دقیقاً «days» است.
						$days = $row['days'] ?? [];
						if ( is_string( $days ) ) {
							$days = [ $days ];
						}
						$days   = is_array( $days ) ? array_values( array_filter( array_map( 'strval', $days ) ) ) : [];
						$opens  = isset( $row['opens'] ) ? trim( (string) $row['opens'] ) : '';
						$closes = isset( $row['closes'] ) ? trim( (string) $row['closes'] ) : '';
						if ( ! empty( $days ) && '' !== $opens && '' !== $closes ) {
							$hours[] = [ 'days' => $days, 'opens' => $opens, 'closes' => $closes ];
						}
					}
				}

				// ── مزیت‌های «چرا کرین یدک» ──
				$advantages = [];
				$raw_advantages = function_exists( 'get_field' ) ? get_field( 'advantages', 'option' ) : null;
				if ( is_array( $raw_advantages ) ) {
					foreach ( $raw_advantages as $row ) {
						if ( ! is_array( $row ) ) {
							continue;
						}
						$adv_title = isset( $row['title'] ) ? trim( (string) $row['title'] ) : '';
						$adv_body  = isset( $row['body'] ) ? trim( (string) $row['body'] ) : '';
						if ( '' !== $adv_title && '' !== $adv_body ) {
							$advantages[] = [ 'title' => $adv_title, 'body' => $adv_body ];
						}
					}
				}

				// ── پاراگراف‌های بلوک اقتدار دامنه ──
				// ⚠️ مثل faqs/hours، خروجی نهایی مسطح است: نوع گراف‌کیوال
				// [String] است، نه لیستی از آبجکت — چون هر ردیف فقط یک
				// زیرفیلد (`paragraph`) دارد و آبجکت‌کردنش زائد بود.
				$authority_paragraphs = [];
				$raw_paragraphs = function_exists( 'get_field' ) ? get_field( 'authority_paragraphs', 'option' ) : null;
				if ( is_array( $raw_paragraphs ) ) {
					foreach ( $raw_paragraphs as $row ) {
						$p = is_array( $row ) && isset( $row['paragraph'] ) ? trim( (string) $row['paragraph'] ) : '';
						if ( '' !== $p ) {
							$authority_paragraphs[] = $p;
						}
					}
				}

				// ── نکات کنار بلوک اقتدار دامنه ──
				$authority_highlights = [];
				$raw_highlights = function_exists( 'get_field' ) ? get_field( 'authority_highlights', 'option' ) : null;
				if ( is_array( $raw_highlights ) ) {
					foreach ( $raw_highlights as $row ) {
						if ( ! is_array( $row ) ) {
							continue;
						}
						$h_label = isset( $row['label'] ) ? trim( (string) $row['label'] ) : '';
						$h_value = isset( $row['value'] ) ? trim( (string) $row['value'] ) : '';
						if ( '' !== $h_label && '' !== $h_value ) {
							$authority_highlights[] = [ 'label' => $h_label, 'value' => $h_value ];
						}
					}
				}

				// ── قطعات مصرفی و پرتعویض ──
				// ⚠️ تطبیق اسلاگ با تاکسونومی واقعی اینجا انجام نمی‌شود — همان
				// جایی که همیشه بوده: فرانت‌اند (findCategory در taxonomy.ts).
				// این پرهیز عمدی است تا PHP مجبور نباشد ساختار تاکسونومی
				// فرانت‌اند را بشناسد.
				$high_wear_parts = [];
				$raw_wear = function_exists( 'get_field' ) ? get_field( 'high_wear_parts', 'option' ) : null;
				if ( is_array( $raw_wear ) ) {
					foreach ( $raw_wear as $row ) {
						if ( ! is_array( $row ) ) {
							continue;
						}
						$w_slug   = isset( $row['category_slug'] ) ? trim( (string) $row['category_slug'] ) : '';
						$w_reason = isset( $row['reason'] ) ? trim( (string) $row['reason'] ) : '';
						if ( '' !== $w_slug && '' !== $w_reason ) {
							$high_wear_parts[] = [ 'categorySlug' => $w_slug, 'reason' => $w_reason ];
						}
					}
				}

				return [
					'phonePrimary'          => cyh_option_text( 'phone_primary' ),
					'phoneSecondary'        => cyh_option_text( 'phone_secondary' ),
					'whatsapp'              => cyh_option_text( 'whatsapp' ),
					'supportEmail'          => cyh_option_text( 'support_email' ),
					'addressStreet'         => cyh_option_text( 'address_street' ),
					'addressCity'           => cyh_option_text( 'address_city' ),
					'addressRegion'         => cyh_option_text( 'address_region' ),
					'addressPostal'         => cyh_option_text( 'address_postal' ),
					'instagram'             => cyh_option_text( 'instagram' ),
					'telegram'              => cyh_option_text( 'telegram' ),
					'googleBusinessProfile' => cyh_option_text( 'google_business_profile' ),
					'neshan'                => cyh_option_text( 'neshan' ),
					'balad'                 => cyh_option_text( 'balad' ),
					'geoLat'                => cyh_option_float( 'geo_lat' ),
					'geoLng'                => cyh_option_float( 'geo_lng' ),
					'faqs'                  => $faqs,
					'businessHours'         => $hours,
					'advantages'            => $advantages,
					'authorityHeading'      => cyh_option_text( 'authority_heading' ),
					'authorityParagraphs'   => $authority_paragraphs,
					'authorityHighlights'   => $authority_highlights,
					'highWearParts'         => $high_wear_parts,
				];
			},
		]
	);
}
add_action( 'graphql_register_types', 'cyh_register_site_options_graphql' );
