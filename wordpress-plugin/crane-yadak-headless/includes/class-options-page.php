<?php
/**
 * صفحه‌ی تنظیمات محتوایی سراسری (ACF Options Page) — برای داده‌هایی که به
 * هیچ CPT خاصی تعلق ندارند: سوالات متداول صفحه‌ی اصلی، ساعات کاری، مختصات
 * جغرافیایی، و لینک‌های Local Citation (نشان/بلد/گوگل بیزینس پروفایل).
 *
 * این صفحه دقیقاً معادل SITE.hours، SITE.geo، SITE.social و FAQS در
 * فرانت‌اند فعلی (src/data/site.ts و content.ts) است — تیم محتوا می‌تواند
 * این مقادیر را بدون دسترسی به کد از پنل وردپرس ویرایش کند.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function cyh_register_options_page() {
	if ( ! function_exists( 'acf_add_options_page' ) ) {
		// ACF Pro (یا افزونه‌ی ACF Options Page) فعال نیست — بدون این تابع
		// نمی‌توان صفحه‌ی تنظیمات ساخت. هشدار در admin_notices در فایل اصلی
		// پلاگین از قبل این وضعیت را به مدیر سایت گزارش می‌دهد.
		return;
	}

	acf_add_options_page(
		[
			'page_title' => 'تنظیمات سراسری سایت',
			'menu_title' => 'تنظیمات کرین یدک',
			'menu_slug'  => 'crane-site-settings',
			'capability' => 'manage_options',
			'icon_url'   => 'dashicons-admin-generic',
			// نکته گراف‌کیوال: show_in_graphql روی خودِ Options Page باعث
			// می‌شود یک نوع «CraneSiteSettings» با یک فیلد ریشه در Query
			// اسکیمای گراف‌کیوال قابل کوئری باشد (مثلاً query { craneSiteSettings { ... } }).
			'show_in_graphql' => true,
			'graphql_field_name' => 'craneSiteSettings',
		]
	);
}
add_action( 'acf/init', 'cyh_register_options_page' );
