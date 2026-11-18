<?php
/**
 * سیستم محتوا — مرحله‌ی ۳: اندپوینت احرازشده برای انتشار فایل‌های content/ (docs/content-system.md).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * چرا
 * ═══════════════════════════════════════════════════════════════════════════
 * کارفرما (۲۷ آبان ۱۴۰۵): «کپی/پیست کند است؛ سیستمی که از فایل تا سایت را بی دخالت دستی انجام دهد — برای
 * هر نوع محتوا». ابزار ورود JSON (class-content-import-hub.php) فقط از پنل و فقط برای موجودیت‌های *موجود*
 * کار می‌کرد، عنوان/چکیده/مشخصات/گالری محصول را نمی‌نوشت و مقاله را نمی‌شناخت.
 *
 * این فایل همان `cyh_hub_blocks_to_acf()` را (یک مسیر تبدیل بلوک، نه دو) از راه REST در دسترس اسکریپت
 * انتشار می‌گذارد — با «رمز برنامه»ی وردپرس (Application Password) و قابلیت edit_others_posts.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * قواعد ایمنی
 * ═══════════════════════════════════════════════════════════════════════════
 *  • پیش‌فرض dry-run: فقط گزارش. نوشتن با `apply: true`.
 *  • ساختن موجودیت تازه فقط با `create: true` و فقط محصول، برند، مقاله. دسته ساخته نمی‌شود — تاکسونومی
 *    مرجعش وردپرس است (CLAUDE.md).
 *  • مالکیت: موجودیتی که پیش از این از فایل منتشر نشده (مثلاً SAGA1-L12 که دستی ساخته شد)، یا پس از آخرین
 *    انتشار در پنل ویرایش شده، **بازنویسی نمی‌شود** مگر با `force: true`. فایل مرجع است، ولی کار دست انسان
 *    بی‌صدا پاک نمی‌شود.
 *  • هر خطای بلوک = آن موجودیت اصلاً نوشته نمی‌شود (نیمه‌نوشتن، صفحه‌ی نیمه‌خالی می‌سازد).
 *
 * @package CraneYadakHeadless
 */

defined( 'ABSPATH' ) || exit;

const CYH_CONTENT_HASH   = '_cyh_content_hash';
const CYH_CONTENT_SYNCED = '_cyh_content_synced';
const CYH_MEDIA_SHA      = '_cyh_sha256';

/** ریشه‌ی payload → نوع موجودیت. */
function cyh_content_roots() {
	return [ 'products' => 'product', 'brands' => 'brand', 'categories' => 'category', 'articles' => 'article' ];
}

function cyh_content_permission() {
	return current_user_can( 'edit_others_posts' );
}

/** پیدا کردن موجودیت: [شناسه‌ی ACF (int یا «crane_category_N»)، نوع نوشته یا null]. */
function cyh_content_locate( $kind, $slug ) {
	if ( 'category' === $kind ) {
		$term = get_term_by( 'slug', $slug, 'crane_category' );
		return ( $term && ! is_wp_error( $term ) ) ? [ 'crane_category_' . $term->term_id, null, (int) $term->term_id ] : [ 0, null, 0 ];
	}
	$type  = 'article' === $kind ? 'post' : $kind;
	$posts = get_posts( [
		'post_type'      => $type,
		'name'           => $slug,
		'post_status'    => [ 'publish', 'draft', 'pending', 'private' ],
		'posts_per_page' => 1,
	] );
	return $posts ? [ (int) $posts[0]->ID, $type, (int) $posts[0]->ID ] : [ 0, $type, 0 ];
}

function cyh_content_meta_get( $kind, $id, $key ) {
	return 'category' === $kind ? get_term_meta( $id, $key, true ) : get_post_meta( $id, $key, true );
}

function cyh_content_meta_set( $kind, $id, $key, $val ) {
	return 'category' === $kind ? update_term_meta( $id, $key, $val ) : update_post_meta( $id, $key, $val );
}

/** نام فایل گالری → شناسه‌ی پیوست با کلید رسانه (همان کلیدی که هنگام بارگذاری از نام فایل ساخته می‌شود). */
function cyh_content_media_id( $file ) {
	$key = cyh_media_make_key( basename( (string) $file ) );
	return $key ? cyh_media_by_key( $key ) : 0;
}

/**
 * انتشار یک payload.
 *
 * @param array $payload { products|brands|categories|articles: { slug: { _post, _product, blocks } } }
 * @param array $opt     { apply: bool, create: bool, force: bool }
 * @return array { ok: bool, rows: [[kind, slug, field, msg]], written: int, errors: int }
 */
function cyh_content_import( $payload, $opt = [] ) {
	$apply  = ! empty( $opt['apply'] );
	$create = ! empty( $opt['create'] );
	$force  = ! empty( $opt['force'] );
	$rows   = [];
	$errors = 0;
	$done   = 0;

	if ( ! function_exists( 'update_field' ) ) {
		return [ 'ok' => false, 'rows' => [ [ '—', '—', '—', 'ACF فعال نیست.' ] ], 'written' => 0, 'errors' => 1 ];
	}

	foreach ( cyh_content_roots() as $root => $kind ) {
		foreach ( (array) ( $payload[ $root ] ?? [] ) as $slug => $entity ) {
			$slug   = sanitize_title( (string) $slug );
			$entity = (array) $entity;
			$fail   = function ( $msg ) use ( &$rows, &$errors, $kind, $slug ) {
				$rows[] = [ $kind, $slug, '—', '✗ ' . $msg ];
				$errors++;
			};

			// ── ۱. بلوک‌ها پیش از هر نوشتنی تبدیل و سنجیده می‌شوند ──
			$acf_rows = [];
			if ( isset( $entity['blocks'] ) ) {
				list( $acf_rows, $block_errors ) = cyh_hub_blocks_to_acf( $entity['blocks'] );
				if ( $block_errors ) {
					foreach ( $block_errors as $m ) {
						$fail( $m );
					}
					continue;
				}
			}

			// ── ۲. گالری: همه‌ی تصاویر باید از قبل در کتابخانه باشند ──
			$product = (array) ( $entity['_product'] ?? [] );
			$gallery = [];
			foreach ( (array) ( $product['gallery'] ?? [] ) as $g ) {
				$att = cyh_content_media_id( is_array( $g ) ? ( $g['file'] ?? '' ) : $g );
				if ( ! $att ) {
					$fail( 'تصویر گالری «' . esc_html( is_array( $g ) ? ( $g['file'] ?? '' ) : $g ) . '» در کتابخانه‌ی رسانه نیست — اسکریپت انتشار باید اول بارگذاری کند.' );
					continue 2;
				}
				$gallery[] = $att;
			}

			// ⚠️ برند و دسته هم پیش از هر نوشتنی حل می‌شوند (۲۸ آبان ۱۴۰۵): نسخه‌ی اول کد فنی را می‌نوشت و *بعد* به دسته‌ی
			// ناموجود می‌رسید — آزمون «دسته‌ی ناموجود» محصول نیمه‌نوشته را گرفت.
			$brand_id = 0;
			if ( ! empty( $product['brand'] ) ) {
				$brand = get_posts( [ 'post_type' => 'brand', 'name' => sanitize_title( $product['brand'] ), 'post_status' => [ 'publish', 'draft' ], 'posts_per_page' => 1 ] );
				if ( ! $brand ) {
					$fail( 'برند «' . esc_html( $product['brand'] ) . '» در وردپرس نیست.' );
					continue;
				}
				$brand_id = (int) $brand[0]->ID;
			}
			$cat_ids = [];
			foreach ( (array) ( $product['categories'] ?? [] ) as $cs ) {
				$t = get_term_by( 'slug', sanitize_title( $cs ), 'crane_category' );
				if ( ! $t || is_wp_error( $t ) ) {
					$fail( 'دسته‌ی «' . esc_html( $cs ) . '» در وردپرس نیست.' );
					continue 2;
				}
				$cat_ids[] = (int) $t->term_id;
			}

			// ── ۳. پیدا کردن یا ساختن ──
			list( $target, $post_type, $raw_id ) = cyh_content_locate( $kind, $slug );
			$post = (array) ( $entity['_post'] ?? [] );
			$hash = md5( wp_json_encode( $entity ) );

			if ( ! $target ) {
				if ( 'category' === $kind ) {
					$fail( 'دسته در وردپرس نیست. دسته ساخته نمی‌شود — تاکسونومی مرجعش پنل وردپرس است.' );
					continue;
				}
				if ( ! $create ) {
					$fail( 'در وردپرس نیست. برای ساختن، انتشار با create اجرا شود.' );
					continue;
				}
				if ( '' === trim( (string) ( $post['title'] ?? '' ) ) ) {
					$fail( 'برای ساختن، title لازم است.' );
					continue;
				}
				if ( ! $apply ) {
					$rows[] = [ $kind, $slug, 'post', 'ساخته می‌شود — ' . count( $acf_rows ) . ' بلوک' ];
					$done++;
					continue;
				}
				$raw_id = wp_insert_post( [
					'post_type'    => $post_type,
					'post_name'    => $slug,
					'post_title'   => sanitize_text_field( $post['title'] ),
					'post_excerpt' => sanitize_text_field( (string) ( $post['excerpt'] ?? '' ) ),
					// بی status صریح: پیش‌نویس — مقاله‌ی تازه پیش از انتشار عمومی دیده می‌شود.
					'post_status'  => in_array( (string) ( $post['status'] ?? '' ), [ 'publish', 'draft', 'pending' ], true ) ? (string) $post['status'] : 'draft',
				] );
				if ( ! $raw_id || is_wp_error( $raw_id ) ) {
					$fail( 'ساختن نوشته ناموفق بود.' );
					continue;
				}
				$target = (int) $raw_id;
				$rows[] = [ $kind, $slug, 'post', 'ساخته شد (#' . (int) $raw_id . ')' ];
			} else {
				// ── ۴. مالکیت ──
				$prev_hash = (string) cyh_content_meta_get( $kind, $raw_id, CYH_CONTENT_HASH );
				$synced    = (string) cyh_content_meta_get( $kind, $raw_id, CYH_CONTENT_SYNCED );
				$modified  = $post_type ? (string) get_post_field( 'post_modified_gmt', $raw_id ) : '';
				if ( '' === $prev_hash && ! $force ) {
					$fail( 'دستی ساخته شده و هرگز از فایل منتشر نشده — بازنویسی فقط با force (یک بار، برای واگذاری به فایل).' );
					continue;
				}
				if ( '' !== $prev_hash && $post_type && $synced && $modified && $modified > $synced && ! $force ) {
					$fail( "پس از آخرین انتشار ({$synced}) در پنل ویرایش شده ({$modified}) — بازنویسی فقط با force." );
					continue;
				}
				if ( $prev_hash === $hash && ! $force ) {
					$rows[] = [ $kind, $slug, '—', 'بی‌تغییر' ];
					continue;
				}
			}

			// ── ۵. نوشتن (یا گزارش) ──
			$what = [];
			if ( $post_type && $post ) {
				$what[] = 'عنوان/چکیده';
				$update = [
					'ID'           => $target,
					'post_title'   => sanitize_text_field( (string) ( $post['title'] ?? get_the_title( $target ) ) ),
					'post_excerpt' => sanitize_text_field( (string) ( $post['excerpt'] ?? '' ) ),
				];
				/* ⚠️ متن ویرایشگر (۲۸ آبان ۱۴۰۵): محتوای فایل در بلوک‌هاست. اگر متن قدیمی ویرایشگر بماند، صفحه هر دو را نشان
				   می‌دهد — متن قدیمی SAGA1-L12 (با Ni-MH و ادعاهای حذف‌شده) بالای بلوک‌های تازه. پس فایل متن ویرایشگر را هم
				   تعیین می‌کند؛ نسخه‌ی قبلی یک بار در متا نگه داشته می‌شود تا برگشت‌پذیر باشد. */
				if ( array_key_exists( 'content', $post ) ) {
					$old = (string) get_post_field( 'post_content', $target );
					if ( '' !== trim( $old ) ) {
						$what[] = 'متن ویرایشگر جایگزین شد (پشتیبان در متا)';
						$apply && update_post_meta( $target, '_cyh_content_backup', $old );
					}
					$update['post_content'] = wp_kses( (string) $post['content'], cyh_import_allowed_html() );
				}
				if ( $apply ) {
					wp_update_post( $update );
				}
			}
			if ( 'product' === $kind && $product ) {
				if ( isset( $product['sku'] ) ) {
					$what[] = 'کد فنی';
					$apply && update_field( 'sku', sanitize_text_field( (string) $product['sku'] ), $target );
				}
				if ( $brand_id ) {
					$what[] = 'برند';
					$apply && update_field( 'brand', [ $brand_id ], $target );
				}
				if ( $cat_ids ) {
					$what[] = 'دسته';
					$apply && wp_set_object_terms( $target, $cat_ids, 'crane_category' );
				}
				if ( isset( $product['specs'] ) ) {
					$specs = [];
					foreach ( (array) $product['specs'] as $s ) {
						$l = sanitize_text_field( (string) ( $s['label'] ?? '' ) );
						$v = sanitize_text_field( (string) ( $s['value'] ?? '' ) );
						if ( '' !== $l && '' !== $v ) {
							$specs[] = [ 'spec_label' => $l, 'spec_value' => $v ];
						}
					}
					$what[] = count( $specs ) . ' مشخصه';
					$apply && update_field( 'technical_specs', $specs, $target );
				}
				if ( $gallery ) {
					$what[] = count( $gallery ) . ' تصویر گالری';
					$apply && update_field( 'gallery', $gallery, $target );
				}
			}
			if ( isset( $entity['blocks'] ) ) {
				$what[] = count( $acf_rows ) . ' بلوک';
				$apply && update_field( 'content_blocks', $acf_rows, $target );
			}

			if ( $apply ) {
				cyh_content_meta_set( $kind, $raw_id, CYH_CONTENT_HASH, $hash );
				if ( $post_type ) {
					clean_post_cache( $raw_id );
					cyh_content_meta_set( $kind, $raw_id, CYH_CONTENT_SYNCED, (string) get_post_field( 'post_modified_gmt', $raw_id ) );
				}
			}
			$rows[] = [ $kind, $slug, '—', ( $apply ? 'نوشته شد' : 'نوشته می‌شود' ) . ' — ' . implode( '، ', $what ) ];
			$done++;
		}
	}

	foreach ( array_keys( (array) $payload ) as $k ) {
		if ( '_' !== substr( (string) $k, 0, 1 ) && ! array_key_exists( $k, cyh_content_roots() ) ) {
			$rows[] = [ '—', '—', (string) $k, '⚠ ریشه‌ی ناشناخته — نادیده گرفته شد' ];
		}
	}

	return [ 'ok' => 0 === $errors, 'rows' => $rows, 'written' => $done, 'errors' => $errors ];
}

/**
 * وضعیت تصاویر: کدام از قبل در کتابخانه است؟
 * ⚠️ نام یکسان با محتوای متفاوت (sha256 ذخیره‌شده فرق دارد) خطاست، نه «موجود» — وگرنه نسخه‌ی تازه‌ی یک
 * تصویر بی‌صدا هرگز بارگذاری نمی‌شد. نسخه‌ی تازه = نام تازه (قاعده‌ی ۴).
 *
 * @param array $files [ { name, sha256 } ]
 */
function cyh_content_media_lookup( $files ) {
	$out = [];
	foreach ( (array) $files as $f ) {
		$name = basename( (string) ( $f['name'] ?? '' ) );
		$sha  = strtolower( (string) ( $f['sha256'] ?? '' ) );
		$key  = cyh_media_make_key( $name );
		$id   = $key ? cyh_media_by_key( $key ) : 0;
		$row  = [ 'name' => $name, 'key' => $key, 'id' => $id ?: null, 'url' => null, 'status' => $id ? 'exists' : 'missing' ];
		if ( $id ) {
			$row['url'] = wp_get_attachment_url( $id );
			$stored     = (string) get_post_meta( $id, CYH_MEDIA_SHA, true );
			if ( '' === $stored ) {
				$row['status'] = 'exists-unverified'; // بارگذاری دستی پیش از سیستم محتوا
			} elseif ( $sha && $stored !== $sha ) {
				$row['status'] = 'conflict';
			}
		}
		$out[] = $row;
	}
	return $out;
}

function cyh_rest_content_import( WP_REST_Request $request ) {
	$payload = $request->get_param( 'payload' );
	if ( ! is_array( $payload ) ) {
		return new WP_Error( 'cyh_content_payload', 'payload باید شیء JSON باشد.', [ 'status' => 400 ] );
	}
	$result = cyh_content_import( $payload, [
		'apply'  => (bool) $request->get_param( 'apply' ),
		'create' => (bool) $request->get_param( 'create' ),
		'force'  => (bool) $request->get_param( 'force' ),
	] );
	return rest_ensure_response( $result );
}

function cyh_rest_content_media( WP_REST_Request $request ) {
	return rest_ensure_response( [ 'files' => cyh_content_media_lookup( (array) $request->get_param( 'files' ) ) ] );
}

/** پس از بارگذاری با /wp/v2/media: اثر انگشت و alt روی پیوست. */
function cyh_rest_content_media_meta( WP_REST_Request $request ) {
	$id  = (int) $request->get_param( 'id' );
	$sha = strtolower( (string) $request->get_param( 'sha256' ) );
	if ( ! $id || 'attachment' !== get_post_field( 'post_type', $id ) ) {
		return new WP_Error( 'cyh_content_media', 'پیوست پیدا نشد.', [ 'status' => 404 ] );
	}
	if ( preg_match( '/^[a-f0-9]{64}$/', $sha ) ) {
		update_post_meta( $id, CYH_MEDIA_SHA, $sha );
	}
	$alt = sanitize_text_field( (string) $request->get_param( 'alt' ) );
	if ( '' !== $alt ) {
		update_post_meta( $id, '_wp_attachment_image_alt', $alt );
	}
	return rest_ensure_response( [ 'id' => $id, 'key' => get_post_meta( $id, CYH_MEDIA_KEY, true ), 'url' => wp_get_attachment_url( $id ) ] );
}

function cyh_register_content_routes() {
	foreach ( [
		'/content/import'     => 'cyh_rest_content_import',
		'/content/media'      => 'cyh_rest_content_media',
		'/content/media-meta' => 'cyh_rest_content_media_meta',
	] as $route => $cb ) {
		register_rest_route( 'crane-yadak/v1', $route, [
			'methods'             => 'POST',
			'callback'            => $cb,
			'permission_callback' => 'cyh_content_permission',
		] );
	}
}
add_action( 'rest_api_init', 'cyh_register_content_routes' );
