<?php
/**
 * یابنده‌ی قطعه از روی علائم خرابی — داده در وردپرس (۷ آذر ۱۴۰۵، backlog O33)
 * ---------------------------------------------------------------------------
 * ⚠️ چرا (کارفرما، ۶ آذر ۱۴۰۵): «بک‌اند تنها منبع حقیقت است — این قاعده بود؛ هرگز تکرار نشود». یابنده‌ی خرابی با
 * ۲۵ نشانه در src/data/faults.ts (کد فرانت‌اند) ساخته شده بود؛ کارفرما نمی‌توانست نشانه‌ای بیفزاید یا متنی را درست
 * کند. حالا:
 *   • CPT cyh_fault — هر نوشته یک نشانه (عنوان = نشانه). ترتیب داخل گروه = «ترتیب» (menu_order).
 *   • تاکسونومی cyh_fault_group — گروه‌ها (ریموت کنترل، سیم‌بکسل، …)؛ اسلاگ = لنگر صفحه (#remote)، ترتیب با فیلد ACF.
 *   • فیلدهای ACF (acf-json/group_cyh_fault_fields.json): معنی، اقدام، دسته‌ی قطعه، راهنما، منبع (عنوان، نشانی، بند).
 * ⚠️ قاعده‌ی ۲ (هرگز چیزی از خودت نساز): منبع، نشانی و بند فیلد *اجباری*‌اند؛ build هر نشانه‌ی بی منبع یا با دسته‌ی
 * ناموجود را رد می‌کند (src/lib/faults.test.mts).
 * ⚠️ تاکسونومی در object_type خودِ register_taxonomy به CPT وصل است — نه register_taxonomy_for_object_type از جای
 * دیگر (همان دامی که قابلیت پرسش و پاسخ را کشت؛ graphql-contract-guard).
 *
 * ورود یک‌باره: cyh_faults_seed() در اولین بار شدن پنل، ۹ گروه و ۲۵ نشانه را از includes/data/fault-seed-v1.json
 * می‌سازد (همان داده‌ی قبلی، بی تغییر) و پرچم cyh_fault_seed_v1 را می‌گذارد. ⚠️ فقط وقتی هیچ نشانه‌ای در وردپرس
 * نیست — ویرایش‌های کارفرما هرگز بازنویسی نمی‌شوند. فایل seed در نسخه‌ی بعدی افزونه حذف می‌شود (قاعده‌ی ۴).
 * ---------------------------------------------------------------------------
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'init', 'cyh_register_faults', 6 );
function cyh_register_faults( $unused = null ) {
	register_post_type(
		'cyh_fault',
		[
			'labels'              => [
				'name'          => 'نشانه‌های خرابی',
				'singular_name' => 'نشانه‌ی خرابی',
				'add_new_item'  => 'افزودن نشانه‌ی خرابی',
				'edit_item'     => 'ویرایش نشانه‌ی خرابی',
				'menu_name'     => 'یابنده‌ی خرابی',
			],
			'public'              => true,
			'publicly_queryable'  => false,
			'show_ui'             => true,
			'show_in_menu'        => true,
			'menu_icon'           => 'dashicons-warning',
			'supports'            => [ 'title', 'page-attributes' ],
			'has_archive'         => false,
			'rewrite'             => false,
			'show_in_rest'        => true,
			'show_in_graphql'     => true,
			'graphql_single_name' => 'craneFault',
			'graphql_plural_name' => 'craneFaults',
		]
	);

	register_taxonomy(
		'cyh_fault_group',
		[ 'cyh_fault' ],
		[
			'labels'              => [
				'name'          => 'گروه‌های خرابی',
				'singular_name' => 'گروه خرابی',
				'add_new_item'  => 'افزودن گروه',
			],
			'public'              => true,
			'publicly_queryable'  => false,
			'hierarchical'        => true, // رابط چک‌باکس در ویرایشگر؛ عملاً تک‌سطحی
			'show_ui'             => true,
			'show_admin_column'   => true,
			'rewrite'             => false,
			'show_in_rest'        => true,
			'show_in_graphql'     => true,
			'graphql_single_name' => 'craneFaultGroup',
			'graphql_plural_name' => 'craneFaultGroups',
		]
	);
}

add_action( 'admin_init', 'cyh_faults_seed' );
function cyh_faults_seed( $unused = null ) {
	if ( get_option( 'cyh_fault_seed_v1' ) ) {
		return;
	}
	if ( ! function_exists( 'update_field' ) || ! current_user_can( 'manage_options' ) ) {
		return; // ACF و مدیر لازم است؛ بار بعد دوباره تلاش می‌شود
	}
	$existing = get_posts( [ 'post_type' => 'cyh_fault', 'post_status' => 'any', 'numberposts' => 1, 'fields' => 'ids' ] );
	if ( $existing ) {
		update_option( 'cyh_fault_seed_v1', 'skipped-existing', false );
		return;
	}
	$file = CYH_PLUGIN_DIR . 'includes/data/fault-seed-v1.json';
	$data = is_readable( $file ) ? json_decode( (string) file_get_contents( $file ), true ) : null;
	if ( ! is_array( $data ) || empty( $data['groups'] ) ) {
		return;
	}
	foreach ( $data['groups'] as $group ) {
		$term = term_exists( $group['slug'], 'cyh_fault_group' );
		if ( ! $term ) {
			$term = wp_insert_term( $group['name'], 'cyh_fault_group', [ 'slug' => $group['slug'] ] );
		}
		if ( is_wp_error( $term ) ) {
			continue;
		}
		$term_id = (int) ( is_array( $term ) ? $term['term_id'] : $term );
		update_field( 'order', (int) $group['order'], 'cyh_fault_group_' . $term_id );
		foreach ( $group['faults'] as $f ) {
			$post_id = wp_insert_post(
				[
					'post_type'   => 'cyh_fault',
					'post_status' => 'publish',
					'post_title'  => $f['symptom'],
					'menu_order'  => (int) $f['order'],
				],
				true
			);
			if ( is_wp_error( $post_id ) ) {
				continue;
			}
			wp_set_object_terms( $post_id, [ $term_id ], 'cyh_fault_group' );
			foreach ( [ 'meaning', 'action', 'category', 'guide', 'source_title', 'source_url', 'source_ref' ] as $k ) {
				update_field( $k, (string) $f[ $k ], $post_id );
			}
		}
	}
	update_option( 'cyh_fault_seed_v1', gmdate( 'c' ), false );
}
