<?php
/**
 * منوی «دسته‌بندی قطعات» در پنل.
 *
 * ⚠️ (۲۸ مهر ۱۴۰۵) این فایل پیش‌تر ~۵۵۰ خط بذر یک‌باره‌ی مهاجرت داشت (`cyh_silo_blueprint`،
 * `cyh_taxonomy_blueprint`، `cyh_category_meta_seed` و دو تابع اجراکننده) که با هر درخواست وردپرس بار
 * می‌شد. مهاجرت ۷ سیلو / ۳۱ دسته انجام شده، دکمه‌اش پیش‌تر حذف شده بود و هیچ فراخواننده‌ای نداشتند —
 * پس حذف شدند (قاعده‌ی ۴). وردپرس مرجع یگانه‌ی تاکسونومی است (docs/taxonomy-ssot.md)؛ دسته‌ی تازه از پنل
 * ساخته می‌شود و build بعدی صفحه‌اش را می‌سازد. نسخه‌ی کامل بذرها در تاریخچه‌ی git هست.
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * منوی مستقل «دسته‌بندی قطعات».
 *
 * چرا: دسته‌بندی زیرمجموعه‌ی «محصول» نیست. سایت ۳۱ دسته دارد و فقط یک
 * محصول؛ دفن کردن آن زیر منوی محصولات، پرکاربردترین صفحه‌ی پنل را
 * سخت‌یاب می‌کند. تاکسونومی با `show_in_menu => false` ثبت شده و اینجا
 * منوی خودش را می‌گیرد.
 */
function cyh_category_menu() {
	add_menu_page(
		'دسته‌بندی قطعات',
		'دسته‌بندی قطعات',
		'manage_options',
		'edit-tags.php?taxonomy=crane_category&post_type=product',
		'',
		'dashicons-category',
		26
	);

	add_submenu_page(
		'edit-tags.php?taxonomy=crane_category&post_type=product',
		'همه‌ی دسته‌ها',
		'همه‌ی دسته‌ها',
		'manage_options',
		'edit-tags.php?taxonomy=crane_category&post_type=product'
	);

	/* ⚠️ زیرمنوی «ساختار دسته‌بندی» اینجا بود و حذف شد — ابزار مهاجرت
	   یک‌باره‌ای که کارش تمام شده (۷ سیلو و ۳۱ دسته ساخته شده) و دکمه‌اش
	   هم مرده بود: به `cyh_build_hierarchy` اشاره می‌کرد بدون هیچ هندلر. */
}
add_action( 'admin_menu', 'cyh_category_menu' );

/**
 * ⚠️ بدون این، وقتی روی صفحه‌ی ترم هستیم وردپرس منوی «محصولات» را
 * برجسته می‌کند، نه منوی خودمان — چون تاکسونومی به CPT محصول وصل است.
 */
function cyh_category_menu_highlight( $parent = '' ) {
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	if ( $screen && 'edit-crane_category' === $screen->id ) {
		return 'edit-tags.php?taxonomy=crane_category&post_type=product';
	}
	return $parent;
}
add_filter( 'parent_file', 'cyh_category_menu_highlight' );
