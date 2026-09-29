<?php
/**
 * صفحه‌ی «قیمت‌ها» در پنل — ایست ۲، فاز ۲ (docs/backlog.md).
 *
 * ---------------------------------------------------------------------------
 * چرا این صفحه، و چرا این شکل (تصمیم کارفرما، ۷ مهر ۱۴۰۵)
 *
 * قیمت پس از N روز (پیش‌فرض ۱۰) منقضی می‌شود و قلم به استعلام برمی‌گردد
 * (class-pricing.php). اگر نگه‌داشتن قیمت‌ها زحمت داشته باشد، کاتالوگ بی‌صدا
 * ۱۰۰٪ استعلامی می‌شود. پس:
 *
 *   • یک جدول، مرتب بر اساس نزدیک‌ترین انقضا.
 *   • ویرایش درجای قیمت — وارد کردن عدد تازه خودش یعنی بررسی شده، پس
 *     ذخیره‌ی چند ردیف با هم مجاز است.
 *   • «تأیید قیمت فعلی» **فقط ردیف‌به‌ردیف**. ⚠️ عمداً «تمدید همه» وجود
 *     ندارد: تمدید گروهی قاعده را به تشریفات تبدیل می‌کند — کلیک عادت
 *     می‌شود و قیمت کهنه تاریخ تازه می‌گیرد، که از نبودِ قاعده بدتر است.
 *     هر تأیید با نام تأییدکننده ثبت و در ردیف نشان داده می‌شود.
 *   • محافظ خطای انسانی: قیمت به **ریال** ذخیره می‌شود ولی ذهن مدیر با
 *     **تومان** کار می‌کند — یک صفر کم یعنی ۱۰ برابر خطا. معادل تومان
 *     کنار هر فیلد، و تغییر بیش از ۳۰٪ بدون تأیید صریح رد می‌شود (سمت
 *     سرور هم، نه فقط دیالوگ مرورگر).
 *   • بنر پنل + ویجت داشبورد برای قیمت‌های منقضی و رو به انقضا — بدون
 *     وابستگی به ایمیل (تحویل ایمیل روی این هاست هنوز آزموده نشده).
 * ---------------------------------------------------------------------------
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const CYH_PRICES_PAGE       = 'cyh-prices';
const CYH_PRICE_BIG_CHANGE  = 0.30;
const CYH_PRICE_SOON_WINDOW = 2 * DAY_IN_SECONDS;

/** رشته‌ی کاربر (ارقام فارسی، جداکننده) → عدد صحیح ریال یا null (خالی = حذف). */
function cyh_prices_parse_rial( $raw ) {
	$digits = preg_replace( '/\D/', '', cyh_to_latin_digits( (string) $raw ) );
	if ( '' === $digits ) {
		return null;
	}
	$n = (int) $digits;
	return $n > 0 ? $n : null;
}

/** تغییر بیش از آستانه؟ فقط وقتی هر دو عدد وجود دارند. */
function cyh_prices_is_big_change( $old, $new ) {
	if ( ! $old || ! $new ) {
		return false;
	}
	return abs( $new - $old ) / $old > CYH_PRICE_BIG_CHANGE;
}

function cyh_prices_write_field( $post_id, $name, $value ) {
	if ( function_exists( 'update_field' ) ) {
		update_field( $name, $value, $post_id );
	} else {
		update_post_meta( $post_id, $name, $value );
	}
}

/**
 * یک ردیف جدول را اعمال می‌کند. **بدون بررسی دسترسی** — فراخوان مسئول آن
 * است (cyh_prices_handle_post). جدا شده تا هارنس بدون ریدایرکت بیازمایدش.
 *
 * @param array $input { action: 'save'|'confirm', price, sale_price, stock_status, confirm_big: bool }
 * @return array{ ok: bool, changed: bool, error: string|null }
 */
function cyh_prices_apply_row( $post_id, array $input, $user_id ) {
	$post_id = (int) $post_id;
	if ( 'product' !== get_post_type( $post_id ) ) {
		return [ 'ok' => false, 'changed' => false, 'error' => 'محصول پیدا نشد.' ];
	}

	$old_price = cyh_price_number( cyh_product_field( $post_id, 'price' ) );
	$old_sale  = cyh_price_number( cyh_product_field( $post_id, 'sale_price' ) );

	if ( 'confirm' === ( $input['action'] ?? '' ) ) {
		if ( null === $old_price && null === $old_sale ) {
			return [ 'ok' => false, 'changed' => false, 'error' => 'قیمتی برای تأیید ثبت نشده.' ];
		}
		cyh_price_mark_updated( $post_id, $user_id );
		return [ 'ok' => true, 'changed' => true, 'error' => null ];
	}

	$new_price = cyh_prices_parse_rial( $input['price'] ?? '' );
	$new_sale  = cyh_prices_parse_rial( $input['sale_price'] ?? '' );
	$stock     = (string) ( $input['stock_status'] ?? '' );

	if ( empty( $input['confirm_big'] ) ) {
		foreach ( [ [ $old_price, $new_price ], [ $old_sale, $new_sale ] ] as [ $o, $n ] ) {
			if ( cyh_prices_is_big_change( $o, $n ) ) {
				return [
					'ok'      => false,
					'changed' => false,
					'error'   => sprintf(
						'تغییر بیش از ٪۳۰ (%s → %s ریال) — ذخیره نشد. اگر درست است، دوباره ذخیره کنید و تغییر را تأیید کنید.',
						number_format( (float) $o ),
						number_format( (float) $n )
					),
				];
			}
		}
	}

	$changed = false;
	if ( $new_price !== ( null === $old_price ? null : (int) $old_price ) ) {
		cyh_prices_write_field( $post_id, 'price', null === $new_price ? '' : $new_price );
		$changed = true;
	}
	if ( $new_sale !== ( null === $old_sale ? null : (int) $old_sale ) ) {
		cyh_prices_write_field( $post_id, 'sale_price', null === $new_sale ? '' : $new_sale );
		$changed = true;
	}
	// ⚠️ تاریخ فقط وقتی عددی تازه ثبت شده — پاک‌کردن قیمت، «تأیید» نیست.
	if ( $changed && ( null !== $new_price || null !== $new_sale ) ) {
		cyh_price_mark_updated( $post_id, $user_id );
	}

	if ( in_array( $stock, [ 'in_stock', 'on_order', 'unknown' ], true )
		&& $stock !== (string) cyh_product_field( $post_id, 'stock_status' ) ) {
		cyh_prices_write_field( $post_id, 'stock_status', $stock );
		$changed = true;
	}

	return [ 'ok' => true, 'changed' => $changed, 'error' => null ];
}

/** محصولات حالت «خرید آنلاین»، مرتب بر اساس نزدیک‌ترین انقضا (بدون تاریخ اول). */
function cyh_prices_rows( $now = null ) {
	$now  = null === $now ? time() : (int) $now;
	$rows = [];
	foreach ( get_posts( [ 'post_type' => 'product', 'post_status' => 'publish', 'posts_per_page' => -1 ] ) as $post ) {
		$p = cyh_product_pricing( $post->ID, $now );
		if ( 'cart' !== $p['buy_mode'] ) {
			continue; // استعلامی قیمت ندارد؛ جایش در این جدول نیست.
		}
		$p['id']           = (int) $post->ID;
		$p['confirmed_by'] = (int) get_post_meta( $post->ID, CYH_PRICE_CONFIRMED_META, true );
		$rows[]            = $p;
	}
	usort(
		$rows,
		static function ( $a, $b ) {
			return ( $a['valid_until'] ?? 0 ) <=> ( $b['valid_until'] ?? 0 );
		}
	);
	return $rows;
}

/**
 * چند قیمت نیاز به توجه دارند — فقط اقلام «موجود» با قیمت، چون فقط آن‌ها
 * با انقضا از فروش آنلاین می‌افتند.
 */
function cyh_prices_attention( $now = null ) {
	$now  = null === $now ? time() : (int) $now;
	$out  = [ 'expired' => 0, 'soon' => 0 ];
	foreach ( cyh_prices_rows( $now ) as $r ) {
		if ( 'in_stock' !== $r['stock'] || null === $r['effective'] ) {
			continue;
		}
		if ( null === $r['valid_until'] || $r['valid_until'] <= $now ) {
			$out['expired']++;
		} elseif ( $r['valid_until'] - $now <= CYH_PRICE_SOON_WINDOW ) {
			$out['soon']++;
		}
	}
	return $out;
}

/** تاریخ شمسی اگر intl هست، وگرنه میلادی — ساختن تاریخ شمسی دستی، منبع باگ است. */
function cyh_prices_fa_date( $ts ) {
	if ( ! $ts ) {
		return '—';
	}
	// توابع رویه‌ای intl، نه کلاس IntlDateFormatter: check-stub-coverage
	// متد روی کلاس درونی PHP را از متد stub‌نشده تشخیص نمی‌دهد.
	if ( function_exists( 'datefmt_create' ) ) {
		$fmt = datefmt_create( 'fa_IR@calendar=persian', 2, -1, 'Asia/Tehran', 0 ); // MEDIUM, NONE, TRADITIONAL
		$out = $fmt ? datefmt_format( $fmt, (int) $ts ) : false;
		if ( false !== $out ) {
			return $out;
		}
	}
	return gmdate( 'Y-m-d', (int) $ts + 12600 );
}

/* =========================================================================
   منو، ذخیره، بنر، ویجت
   ========================================================================= */
function cyh_prices_menu() {
	add_submenu_page(
		'edit.php?post_type=product',
		'قیمت‌ها',
		'قیمت‌ها',
		'edit_posts',
		CYH_PRICES_PAGE,
		'cyh_prices_render'
	);
}
add_action( 'admin_menu', 'cyh_prices_menu' );

function cyh_prices_handle_post() {
	if ( ! current_user_can( 'edit_posts' ) ) {
		wp_die( 'دسترسی ندارید.' );
	}
	check_admin_referer( 'cyh_prices_save' );

	$user    = get_current_user_id();
	$results = [ 'saved' => 0, 'errors' => [] ];

	// تنظیم مدت اعتبار — فقط مدیر کل.
	if ( isset( $_POST['ttl_days'] ) && current_user_can( 'manage_options' ) ) {
		update_option( CYH_PRICE_TTL_OPTION, max( 1, min( 90, (int) $_POST['ttl_days'] ) ) );
	}

	$confirm_id = isset( $_POST['confirm'] ) ? (int) $_POST['confirm'] : 0;
	$rows       = isset( $_POST['rows'] ) && is_array( $_POST['rows'] ) ? wp_unslash( $_POST['rows'] ) : [];
	$big        = isset( $_POST['confirm_big'] ) && is_array( $_POST['confirm_big'] ) ? array_map( 'intval', array_keys( $_POST['confirm_big'] ) ) : [];

	$targets = $confirm_id ? [ $confirm_id => [ 'action' => 'confirm' ] ] : $rows;
	foreach ( $targets as $id => $input ) {
		$id = (int) $id;
		if ( ! current_user_can( 'edit_post', $id ) ) {
			continue;
		}
		$input                = is_array( $input ) ? $input : [];
		$input['confirm_big'] = in_array( $id, $big, true );
		$r                    = cyh_prices_apply_row( $id, $input, $user );
		if ( $r['error'] ) {
			$results['errors'][] = get_the_title( $id ) . ': ' . $r['error'];
		} elseif ( $r['changed'] ) {
			$results['saved']++;
		}
	}

	// سایت استاتیک است: تغییر قیمت تا rebuild بعدی روی صفحه نمی‌آید.
	if ( $results['saved'] && function_exists( 'cyh_maybe_schedule_deploy' ) ) {
		cyh_maybe_schedule_deploy();
	}

	set_transient( 'cyh_prices_result_' . $user, $results, MINUTE_IN_SECONDS );
	wp_safe_redirect( admin_url( 'edit.php?post_type=product&page=' . CYH_PRICES_PAGE ) );
	exit;
}
add_action( 'admin_post_cyh_prices_save', 'cyh_prices_handle_post' );

function cyh_prices_admin_notice() {
	if ( ! current_user_can( 'edit_posts' ) ) {
		return;
	}
	$a = cyh_prices_attention();
	if ( ! $a['expired'] && ! $a['soon'] ) {
		return;
	}
	$parts = [];
	if ( $a['expired'] ) {
		$parts[] = sprintf( '%d قیمت منقضی شده و آن اقلام فعلاً آنلاین فروخته نمی‌شوند', $a['expired'] );
	}
	if ( $a['soon'] ) {
		$parts[] = sprintf( '%d قیمت تا ۲ روز دیگر منقضی می‌شود', $a['soon'] );
	}
	printf(
		'<div class="notice notice-%s"><p><strong>کرین یدک — قیمت‌ها:</strong> %s. <a href="%s">بررسی قیمت‌ها ←</a></p></div>',
		$a['expired'] ? 'error' : 'warning',
		esc_html( implode( '؛ ', $parts ) ),
		esc_url( admin_url( 'edit.php?post_type=product&page=' . CYH_PRICES_PAGE ) )
	);
}
add_action( 'admin_notices', 'cyh_prices_admin_notice' );

function cyh_prices_dashboard_widget() {
	if ( ! current_user_can( 'edit_posts' ) ) {
		return;
	}
	wp_add_dashboard_widget(
		'cyh_prices_widget',
		'کرین یدک — وضعیت قیمت‌ها',
		static function () {
			$a = cyh_prices_attention();
			printf(
				'<p>منقضی: <strong>%d</strong> · تا ۲ روز دیگر: <strong>%d</strong> · مدت اعتبار: %d روز</p><p><a class="button" href="%s">صفحه‌ی قیمت‌ها</a></p>',
				(int) $a['expired'],
				(int) $a['soon'],
				(int) cyh_price_ttl_days(),
				esc_url( admin_url( 'edit.php?post_type=product&page=' . CYH_PRICES_PAGE ) )
			);
		}
	);
}
add_action( 'wp_dashboard_setup', 'cyh_prices_dashboard_widget' );

/* =========================================================================
   رندر صفحه
   ========================================================================= */
function cyh_prices_render() {
	$user    = get_current_user_id();
	$result  = get_transient( 'cyh_prices_result_' . $user );
	delete_transient( 'cyh_prices_result_' . $user );
	$now     = time();
	$rows    = cyh_prices_rows( $now );
	$stocks  = [ 'in_stock' => 'موجود', 'on_order' => 'به‌سفارش', 'unknown' => 'نامشخص' ];

	echo '<div class="wrap"><h1>قیمت‌ها</h1>';
	echo '<p>قیمت‌ها به <strong>ریال</strong> ذخیره می‌شوند. قیمت هر قلم پس از <strong>'
		. (int) cyh_price_ttl_days() . ' روز</strong> بدون تغییر یا تأیید، از فروش آنلاین خارج و استعلامی می‌شود. '
		. 'فقط اقلام «خرید آنلاین» این‌جا هستند.</p>';

	if ( is_array( $result ) ) {
		if ( $result['saved'] ) {
			printf( '<div class="notice notice-success"><p>%d ردیف ذخیره شد. سایت چند دقیقه بعد به‌روز می‌شود.</p></div>', (int) $result['saved'] );
		}
		foreach ( (array) $result['errors'] as $err ) {
			printf( '<div class="notice notice-error"><p>%s</p></div>', esc_html( $err ) );
		}
	}

	echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" id="cyh-prices-form">';
	wp_nonce_field( 'cyh_prices_save' );
	echo '<input type="hidden" name="action" value="cyh_prices_save">';

	if ( current_user_can( 'manage_options' ) ) {
		printf(
			'<p><label>مدت اعتبار قیمت: <input type="number" min="1" max="90" name="ttl_days" value="%d" style="width:5em"> روز</label></p>',
			(int) cyh_price_ttl_days()
		);
	}

	if ( ! $rows ) {
		echo '<p>هیچ محصولی در حالت «خرید آنلاین» نیست.</p>';
	} else {
		echo '<table class="widefat striped"><thead><tr>'
			. '<th>محصول</th><th>قیمت (ریال)</th><th>قیمت تخفیف (ریال)</th><th>موجودی</th><th>اعتبار</th><th>آخرین تأیید</th><th></th>'
			. '</tr></thead><tbody>';
		foreach ( $rows as $r ) {
			$id    = (int) $r['id'];
			$left  = null === $r['valid_until'] ? null : (int) floor( ( $r['valid_until'] - $now ) / DAY_IN_SECONDS );
			if ( null === $left || $left < 0 ) {
				$badge = '<span style="color:#b32d2e;font-weight:700">منقضی</span>';
			} elseif ( $left <= 2 ) {
				$badge = '<span style="color:#996800;font-weight:700">' . (int) $left . ' روز مانده</span>';
			} else {
				$badge = '<span style="color:#00713c">' . (int) $left . ' روز مانده</span>';
			}
			$who = $r['confirmed_by'] ? get_userdata( $r['confirmed_by'] ) : null;

			echo '<tr>';
			printf( '<td><a href="%s">%s</a><br><code>%s</code></td>', esc_url( get_edit_post_link( $id ) ), esc_html( $r['name'] ), esc_html( $r['sku'] ) );
			foreach ( [ 'price' => $r['base'], 'sale_price' => $r['sale'] ] as $name => $val ) {
				printf(
					'<td><input type="text" inputmode="numeric" dir="ltr" class="cyh-rial" name="rows[%1$d][%2$s]" value="%3$s" data-old="%4$s" style="width:11em">'
					. '<br><small class="cyh-toman" style="color:#646970"></small></td>',
					$id,
					esc_attr( $name ),
					$val ? esc_attr( number_format( $val ) ) : '',
					$val ? (int) $val : ''
				);
			}
			echo '<td><select name="rows[' . $id . '][stock_status]">';
			foreach ( $stocks as $key => $label ) {
				printf( '<option value="%s"%s>%s</option>', esc_attr( $key ), selected( $r['stock'], $key, false ), esc_html( $label ) );
			}
			echo '</select></td>';
			printf( '<td>%s<br><small>%s</small></td>', $badge, esc_html( cyh_prices_fa_date( $r['valid_until'] ) ) );
			printf(
				'<td>%s<br><small>%s</small></td>',
				esc_html( cyh_prices_fa_date( $r['updated_at'] ) ),
				esc_html( $who ? $who->display_name : '—' )
			);
			printf(
				'<td><button type="submit" class="button" name="confirm" value="%d" title="قیمت را امروز در بازار بررسی کرده‌ام و هنوز درست است">تأیید قیمت فعلی</button></td>',
				$id
			);
			echo '</tr>';
		}
		echo '</tbody></table>';
		echo '<p><button type="submit" class="button button-primary">ذخیره‌ی تغییرات</button></p>';
	}
	echo '</form></div>';
	?>
	<script>
	(function () {
		// معادل تومان زنده — ریال/تومان، رایج‌ترین خطای ۱۰ برابری.
		var fmt = function (n) { return n.toLocaleString('fa-IR'); };
		var digits = function (s) { return (s || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/\D/g, ''); };
		document.querySelectorAll('.cyh-rial').forEach(function (input) {
			var out = input.parentNode.querySelector('.cyh-toman');
			var paint = function () {
				var n = parseInt(digits(input.value), 10);
				out.textContent = n ? '= ' + fmt(Math.round(n / 10)) + ' تومان' : '';
			};
			input.addEventListener('input', paint);
			paint();
		});
		// تغییر بیش از ٪۳۰: تأیید صریح. سرور بدون این علامت، ردیف را رد می‌کند.
		var form = document.getElementById('cyh-prices-form');
		if (!form) return;
		form.addEventListener('submit', function (e) {
			if (e.submitter && e.submitter.name === 'confirm') return;
			var big = [];
			form.querySelectorAll('.cyh-rial').forEach(function (input) {
				var o = parseInt(input.dataset.old, 10), n = parseInt(digits(input.value), 10);
				if (o && n && Math.abs(n - o) / o > 0.30) big.push({ input: input, o: o, n: n });
			});
			if (!big.length) return;
			var msg = big.map(function (b) { return fmt(b.o) + ' ← ' + fmt(b.n) + ' ریال'; }).join('\n');
			if (!window.confirm('این قیمت‌ها بیش از ٪۳۰ تغییر کرده‌اند:\n' + msg + '\n\nمطمئنید؟')) { e.preventDefault(); return; }
			big.forEach(function (b) {
				var id = (b.input.name.match(/rows\[(\d+)\]/) || [])[1];
				var h = document.createElement('input');
				h.type = 'hidden'; h.name = 'confirm_big[' + id + ']'; h.value = '1';
				form.appendChild(h);
			});
		});
	})();
	</script>
	<?php
}
