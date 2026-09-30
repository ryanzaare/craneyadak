<?php
/**
 * برچسب «اصلی / غیر اصلی» محصول در پنل وردپرس: ستون، فیلتر و ویرایش گروهی.
 *
 * ویرایش تک‌محصول = فیلد ACF «اصالت کالا» در صفحه‌ی ویرایش محصول (acf-json). این فایل
 * کار روی *فهرست* را ممکن می‌کند: دیدن سریع محصولاتِ بدون برچسب، فیلتر کردنشان، و
 * تنظیم یک‌جای چندین محصول. هیچ مقداری خودکار حدس زده نمی‌شود؛ فقط انتخاب صریح مدیر.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function cyh_authenticity_choices() {
	return [
		'original'     => 'اصلی',
		'non_original' => 'غیر اصلی',
	];
}

/** مقدار ثبت‌شده یا '' (ثبت‌نشده). */
function cyh_product_authenticity( $post_id ) {
	$value = (string) cyh_product_field( $post_id, 'authenticity' );
	return isset( cyh_authenticity_choices()[ $value ] ) ? $value : '';
}

/* ------------------------------ ستون ------------------------------ */

function cyh_product_authenticity_column( $columns ) {
	$out = [];
	foreach ( $columns as $key => $label ) {
		$out[ $key ] = $label;
		if ( 'title' === $key ) {
			$out['cyh_authenticity'] = 'اصالت';
		}
	}
	return isset( $out['cyh_authenticity'] ) ? $out : $out + [ 'cyh_authenticity' => 'اصالت' ];
}
add_filter( 'manage_product_posts_columns', 'cyh_product_authenticity_column' );

function cyh_product_authenticity_column_content( $column, $post_id ) {
	if ( 'cyh_authenticity' !== $column ) {
		return;
	}
	$value = cyh_product_authenticity( $post_id );
	if ( '' === $value ) {
		echo '<span style="color:#d63638;font-weight:700">ثبت نشده</span>';
		return;
	}
	printf(
		'<span style="color:%s;font-weight:700">%s</span>',
		'original' === $value ? '#00a32a' : '#996800',
		esc_html( cyh_authenticity_choices()[ $value ] )
	);
}
add_action( 'manage_product_posts_custom_column', 'cyh_product_authenticity_column_content', 10, 2 );

/* ------------------------------ فیلتر ------------------------------ */

/** ?cyh_auth=original|non_original|unset — مقدار ناشناخته null (نادیده). */
function cyh_authenticity_filter_meta_query( $value ) {
	if ( 'unset' === $value ) {
		return [
			'relation' => 'OR',
			[ 'key' => 'authenticity', 'compare' => 'NOT EXISTS' ],
			[ 'key' => 'authenticity', 'value' => '' ],
		];
	}
	if ( isset( cyh_authenticity_choices()[ $value ] ) ) {
		return [ 'key' => 'authenticity', 'value' => $value ];
	}
	return null;
}

function cyh_authenticity_filter_dropdown( $post_type = '' ) {
	if ( 'product' !== $post_type ) {
		return;
	}
	$current = isset( $_GET['cyh_auth'] ) ? sanitize_key( (string) $_GET['cyh_auth'] ) : ''; // phpcs:ignore WordPress.Security.NonceVerification
	$options = [ '' => 'همه‌ی اصالت‌ها' ] + cyh_authenticity_choices() + [ 'unset' => 'ثبت نشده' ];
	echo '<select name="cyh_auth">';
	foreach ( $options as $value => $label ) {
		printf( '<option value="%s"%s>%s</option>', esc_attr( $value ), selected( $current, $value, false ), esc_html( $label ) );
	}
	echo '</select>';
}
add_action( 'restrict_manage_posts', 'cyh_authenticity_filter_dropdown' );

function cyh_authenticity_apply_filter( $query ) {
	if ( ! is_admin() || ! $query->is_main_query() || 'product' !== $query->get( 'post_type' ) || ! isset( $_GET['cyh_auth'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification
		return;
	}
	$clause = cyh_authenticity_filter_meta_query( sanitize_key( (string) $_GET['cyh_auth'] ) ); // phpcs:ignore WordPress.Security.NonceVerification
	if ( $clause ) {
		$query->set( 'meta_query', [ $clause ] );
	}
}
add_action( 'pre_get_posts', 'cyh_authenticity_apply_filter' );

/* ------------------------------ ویرایش گروهی ------------------------------ */

function cyh_authenticity_bulk_actions( $actions ) {
	$actions['cyh_set_original']     = 'اصالت: اصلی';
	$actions['cyh_set_non_original'] = 'اصالت: غیر اصلی';
	return $actions;
}
add_filter( 'bulk_actions-edit-product', 'cyh_authenticity_bulk_actions' );

/**
 * فقط محصولی که کاربر اجازه‌ی ویرایشش را دارد تغییر می‌کند (nonce فهرست را خود
 * وردپرس پیش از این هوک می‌سنجد). ذخیره با update_field تا کلید مرجع ACF هم درست بماند.
 */
function cyh_authenticity_handle_bulk( $redirect_to, $action, $post_ids ) {
	$map = [ 'cyh_set_original' => 'original', 'cyh_set_non_original' => 'non_original' ];
	if ( ! isset( $map[ $action ] ) ) {
		return $redirect_to;
	}
	$done = 0;
	foreach ( (array) $post_ids as $post_id ) {
		$post_id = (int) $post_id;
		if ( 'product' !== get_post_type( $post_id ) || ! current_user_can( 'edit_post', $post_id ) ) {
			continue;
		}
		if ( function_exists( 'update_field' ) ) {
			update_field( 'authenticity', $map[ $action ], $post_id );
		} else {
			update_post_meta( $post_id, 'authenticity', $map[ $action ] );
		}
		++$done;
	}
	return add_query_arg( 'cyh_bulk_auth', $done, $redirect_to );
}
add_filter( 'handle_bulk_actions-edit-product', 'cyh_authenticity_handle_bulk', 10, 3 );

function cyh_authenticity_bulk_notice() {
	if ( ! isset( $_GET['cyh_bulk_auth'], $_GET['post_type'] ) || 'product' !== $_GET['post_type'] ) { // phpcs:ignore WordPress.Security.NonceVerification
		return;
	}
	printf( '<div class="notice notice-success is-dismissible"><p>برچسب اصالت %d محصول به‌روز شد.</p></div>', (int) $_GET['cyh_bulk_auth'] ); // phpcs:ignore WordPress.Security.NonceVerification
}
add_action( 'admin_notices', 'cyh_authenticity_bulk_notice' );
