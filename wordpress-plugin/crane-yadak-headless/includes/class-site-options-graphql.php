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
			'fields'      => [
				'dayOfWeek' => [ 'type' => [ 'list_of' => 'String' ] ],
				'opens'     => [ 'type' => 'String' ],
				'closes'    => [ 'type' => 'String' ],
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
						$days = $row['day_of_week'] ?? ( $row['dayOfWeek'] ?? [] );
						if ( is_string( $days ) ) {
							$days = [ $days ];
						}
						$days   = is_array( $days ) ? array_values( array_filter( array_map( 'strval', $days ) ) ) : [];
						$opens  = isset( $row['opens'] ) ? trim( (string) $row['opens'] ) : '';
						$closes = isset( $row['closes'] ) ? trim( (string) $row['closes'] ) : '';
						if ( ! empty( $days ) && '' !== $opens && '' !== $closes ) {
							$hours[] = [ 'dayOfWeek' => $days, 'opens' => $opens, 'closes' => $closes ];
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
				];
			},
		]
	);
}
add_action( 'graphql_register_types', 'cyh_register_site_options_graphql' );
