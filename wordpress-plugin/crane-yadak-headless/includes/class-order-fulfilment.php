<?php
/**
 * رسیدگی به سفارش پرداخت‌شده (ایست ۲، فاز ۵): وضعیت ارسال، کد رهگیری مرسوله،
 * فایل فاکتور رسمی، ایمیل «ارسال شد» و ویجت داشبورد.
 *
 * ⚠️ جعبه‌ی «پاسخ واحد فروش» (وضعیت/متن پاسخ/پیش‌فاکتور) گردش‌کار *استعلام* است و
 * برای سفارش بی‌معناست؛ روی سفارش پنهان می‌شود (class-quote-requests.php) و این
 * جعبه جایش می‌آید. فقط سفارش *پرداخت‌شده* رسیدگی دارد: سمت سرور هم ذخیره‌ی
 * سفارش پرداخت‌نشده رد می‌شود، نه فقط پنهان‌کردن جعبه.
 *
 * هرچه مشتری می‌بیند از اینجا می‌آید و *دستی* توسط کارشناس نوشته می‌شود؛ هیچ وضعیت
 * یا کد رهگیری‌ای ساخته نمی‌شود (قاعده‌ی «هرگز چیزی از خودت نساز»).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// همان دلیل class-checkout.php: ثابت CYH_QUOTE_CPT در نام هوک‌ها هنگام بارگذاری لازم است.
require_once __DIR__ . '/class-quote-requests.php';

const CYH_FULFIL_NONCE_ACTION = 'cyh_save_fulfilment';

/** ترتیب = ترتیب پیشرفت. سه وضعیت: لغو/بازگشت وجه سیاست مالی است و این‌جا حدس زده نمی‌شود. */
function cyh_fulfilment_statuses() {
	return [
		'processing' => 'در حال آماده‌سازی',
		'shipped'    => 'ارسال شد',
		'delivered'  => 'تحویل شد',
	];
}

function cyh_order_is_paid( $post_id ) {
	return 'paid' === get_post_meta( $post_id, 'cyh_payment', true );
}

/** وضعیت فعلی؛ نبودِ متا برای سفارش پرداخت‌شده = «در حال آماده‌سازی». */
function cyh_order_fulfilment_status( $post_id ) {
	$status = (string) get_post_meta( $post_id, 'cyh_fulfilment', true );
	return isset( cyh_fulfilment_statuses()[ $status ] ) ? $status : 'processing';
}

/**
 * آنچه به مشتری داده می‌شود (REST). null برای سفارشی که پرداخت‌شده نیست: مشتری
 * برای سفارش ناموفق/در انتظار وضعیت ارسال نمی‌بیند.
 */
function cyh_order_fulfilment_view( $post_id ) {
	if ( ! cyh_order_is_paid( $post_id ) ) {
		return null;
	}
	$status = cyh_order_fulfilment_status( $post_id );
	return [
		'status'             => $status,
		'statusLabel'        => cyh_fulfilment_statuses()[ $status ],
		'trackingCode'       => (string) get_post_meta( $post_id, 'cyh_tracking_code', true ),
		'note'               => (string) get_post_meta( $post_id, 'cyh_fulfil_note', true ),
		'officialInvoiceUrl' => (string) get_post_meta( $post_id, 'cyh_official_invoice_url', true ),
	];
}

/* ------------------------------ جعبه‌ی پنل ------------------------------ */

function cyh_fulfilment_metabox( $post_type = '', $post = null ) {
	if ( CYH_QUOTE_CPT !== $post_type || ! is_object( $post ) || ! cyh_order_is_paid( $post->ID ) ) {
		return;
	}
	add_meta_box(
		'cyh_fulfilment',
		'رسیدگی به سفارش',
		function ( $post ) {
			wp_nonce_field( CYH_FULFIL_NONCE_ACTION, 'cyh_fulfil_nonce' );
			$status = cyh_order_fulfilment_status( $post->ID );
			$code   = (string) get_post_meta( $post->ID, 'cyh_tracking_code', true );
			$note   = (string) get_post_meta( $post->ID, 'cyh_fulfil_note', true );
			$file   = (string) get_post_meta( $post->ID, 'cyh_official_invoice_url', true );
			$ship   = (string) get_post_meta( $post->ID, 'cyh_shipping_label', true );

			echo '<p><label for="cyh_fulfilment"><strong>وضعیت</strong></label><br><select id="cyh_fulfilment" name="cyh_fulfilment" style="min-width:280px">';
			foreach ( cyh_fulfilment_statuses() as $key => $label ) {
				printf( '<option value="%s"%s>%s</option>', esc_attr( $key ), selected( $status, $key, false ), esc_html( $label ) );
			}
			echo '</select></p>';

			printf( '<p><strong>روش ارسال انتخاب‌شده توسط مشتری:</strong> %s</p>', esc_html( '' === $ship ? '—' : $ship ) );

			echo '<p><label for="cyh_tracking_code"><strong>کد رهگیری مرسوله (اختیاری)</strong></label><br>';
			printf( '<input type="text" id="cyh_tracking_code" name="cyh_tracking_code" value="%s" maxlength="60" style="width:100%%" dir="ltr"></p>', esc_attr( $code ) );

			echo '<p><label for="cyh_fulfil_note"><strong>توضیح برای مشتری (اختیاری)</strong></label><br>';
			echo '<span class="description">مثلاً نام شرکت حمل و شماره‌ی بارنامه. دقیقاً همین متن در «سفارش‌های من» و صفحه‌ی پیگیری دیده می‌شود.</span><br>';
			printf( '<textarea id="cyh_fulfil_note" name="cyh_fulfil_note" rows="3" maxlength="500" style="width:100%%">%s</textarea></p>', esc_textarea( $note ) );

			echo '<p><label for="cyh_official_invoice_url"><strong>فایل فاکتور رسمی (اختیاری)</strong></label><br>';
			printf( '<input type="url" id="cyh_official_invoice_url" name="cyh_official_invoice_url" value="%s" style="width:100%%" dir="ltr" placeholder="https://…">', esc_attr( $file ) );
			echo ' <button type="button" class="button" id="cyh-pick-invoice">انتخاب از کتابخانه رسانه</button>';
			echo '<br><span class="description">فاکتور رسمی (سامانه‌ی مودیان) را در «رسانه» بارگذاری و انتخاب کنید؛ مشتری پیوند دریافتش را می‌بیند. فاکتور غیررسمی سایت جداست و خودکار ساخته می‌شود.</span></p>';

			echo '<p style="background:#fff8e5;border-right:4px solid #dba617;padding:10px 12px">';
			echo 'با تغییر وضعیت به <strong>«ارسال شد»</strong> (برای اولین بار) ایمیل اطلاع‌رسانی برای مشتری فرستاده می‌شود.';
			echo '</p>';
			?>
			<script>
			jQuery(function ($) {
				$('#cyh-pick-invoice').on('click', function (e) {
					e.preventDefault();
					if (typeof wp === 'undefined' || !wp.media) { return; }
					var frame = wp.media({ title: 'انتخاب فایل فاکتور رسمی', multiple: false });
					frame.on('select', function () {
						$('#cyh_official_invoice_url').val(frame.state().get('selection').first().toJSON().url);
					});
					frame.open();
				});
			});
			</script>
			<?php
		},
		CYH_QUOTE_CPT,
		'normal',
		'high'
	);
}
add_action( 'add_meta_boxes', 'cyh_fulfilment_metabox', 10, 2 );

function cyh_save_fulfilment( $post_id ) {
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( ! isset( $_POST['cyh_fulfil_nonce'] ) ||
		! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['cyh_fulfil_nonce'] ) ), CYH_FULFIL_NONCE_ACTION ) ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	// ⚠️ سمت سرور هم: POST جعلی برای سفارش پرداخت‌نشده هیچ‌چیز ذخیره نمی‌کند.
	if ( ! cyh_order_is_paid( $post_id ) ) {
		return;
	}

	$statuses = cyh_fulfilment_statuses();
	$status   = sanitize_text_field( wp_unslash( $_POST['cyh_fulfilment'] ?? 'processing' ) );
	$status   = isset( $statuses[ $status ] ) ? $status : 'processing';
	update_post_meta( $post_id, 'cyh_fulfilment', $status );

	$code = cyh_to_latin_digits( sanitize_text_field( wp_unslash( $_POST['cyh_tracking_code'] ?? '' ) ) );
	update_post_meta( $post_id, 'cyh_tracking_code', mb_substr( $code, 0, 60 ) );
	update_post_meta( $post_id, 'cyh_fulfil_note', mb_substr( sanitize_textarea_field( wp_unslash( $_POST['cyh_fulfil_note'] ?? '' ) ), 0, 500 ) );

	// فقط http/https؛ رشته‌ی دیگر (javascript: …) خالی می‌شود.
	$url = esc_url_raw( wp_unslash( $_POST['cyh_official_invoice_url'] ?? '' ), [ 'http', 'https' ] );
	update_post_meta( $post_id, 'cyh_official_invoice_url', preg_match( '#^https?://#i', (string) $url ) ? $url : '' );

	// ایمیل «ارسال شد»: فقط یک بار برای هر سفارش (پرچم)، حتی اگر وضعیت برگردد و دوباره
	// shipped شود؛ ذخیره‌ی دوباره هم تکراری نمی‌فرستد. پرچم فقط پس از ارسال موفق ثبت می‌شود.
	if ( 'shipped' === $status && ! get_post_meta( $post_id, 'cyh_shipped_mail_sent', true ) ) {
		if ( cyh_order_notify_shipped( $post_id ) ) {
			update_post_meta( $post_id, 'cyh_shipped_mail_sent', 1 );
		}
	}
}
add_action( 'save_post_' . CYH_QUOTE_CPT, 'cyh_save_fulfilment' );

/* ------------------------------ ایمیل ------------------------------ */

function cyh_order_notify_shipped( $post_id ) {
	$to = cyh_order_recipient( $post_id );
	if ( '' === $to ) {
		return false;
	}
	$code     = (string) get_post_meta( $post_id, 'cyh_code', true );
	$customer = get_post_meta( $post_id, 'cyh_customer', true );
	$name     = is_array( $customer ) ? (string) ( $customer['name'] ?? '' ) : '';
	$ship     = (string) get_post_meta( $post_id, 'cyh_shipping_label', true );
	$track    = (string) get_post_meta( $post_id, 'cyh_tracking_code', true );
	$note     = (string) get_post_meta( $post_id, 'cyh_fulfil_note', true );
	$origin   = rtrim( (string) get_post_meta( $post_id, 'cyh_return_origin', true ), '/' );

	$body  = '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:720px;margin:0 auto;color:#101828;line-height:1.9;font-size:14px">';
	$body .= '<p>' . esc_html( '' === $name ? 'مشتری گرامی' : $name ) . ' عزیز، سفارش <strong dir="ltr">' . esc_html( $code ) . '</strong> ارسال شد.</p>';
	if ( '' !== $ship ) {
		$body .= '<p><strong>روش ارسال:</strong> ' . esc_html( $ship ) . '</p>';
	}
	if ( '' !== $track ) {
		$body .= '<p><strong>کد رهگیری مرسوله:</strong> <span dir="ltr">' . esc_html( $track ) . '</span></p>';
	}
	if ( '' !== $note ) {
		$body .= '<p>' . nl2br( esc_html( $note ) ) . '</p>';
	}
	$body .= '<p>هزینه‌ی ارسال پس‌کرایه است و هنگام تحویل به شرکت حمل پرداخت می‌شود.</p>';
	if ( '' !== $origin ) {
		$body .= '<p><a href="' . esc_url( $origin . '/account/orders/' ) . '">مشاهده‌ی سفارش‌های من</a></p>';
	}
	$body .= '</div>';

	return wp_mail(
		$to,
		sprintf( '%sسفارش %s ارسال شد', get_post_meta( $post_id, 'cyh_sandbox', true ) ? '[آزمایشی] ' : '', $code ),
		$body,
		[ 'Content-Type: text/html; charset=UTF-8' ]
	);
}

/* ------------------------------ فهرست پنل و ویجت ------------------------------ */

/**
 * ?cyh_fulfil=processing|shipped|delivered — «processing» شامل سفارش بدون متا هم
 * هست (پیش‌فرض). فقط مقدار شناخته‌شده اعمال می‌شود.
 */
function cyh_fulfilment_filter_meta_query( $value ) {
	if ( ! isset( cyh_fulfilment_statuses()[ $value ] ) ) {
		return null;
	}
	if ( 'processing' === $value ) {
		return [
			'relation' => 'OR',
			[ 'key' => 'cyh_fulfilment', 'compare' => 'NOT EXISTS' ],
			[ 'key' => 'cyh_fulfilment', 'value' => 'processing' ],
		];
	}
	return [ 'key' => 'cyh_fulfilment', 'value' => $value ];
}

function cyh_orders_dashboard_widget() {
	// فیلتر «در انتظار» در PHP (نه meta_query): متای cyh_fulfilment برای سفارش بدون
	// رسیدگی اصلاً وجود ندارد و همان پیش‌فرض «در حال آماده‌سازی» است.
	$paid     = get_posts(
		[
			'post_type'      => CYH_QUOTE_CPT,
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'meta_query'     => [ [ 'key' => 'cyh_payment', 'value' => 'paid' ] ], // phpcs:ignore WordPress.DB.SlowDBQuery
		]
	);
	$awaiting = array_values(
		array_filter(
			$paid,
			static function ( $post ) {
				return 'processing' === cyh_order_fulfilment_status( $post->ID );
			}
		)
	);
	if ( ! $awaiting ) {
		echo '<p>سفارش پرداخت‌شده‌ی در انتظار رسیدگی نیست.</p>';
	} else {
		printf( '<p><strong>%d</strong> سفارش پرداخت‌شده منتظر ارسال است:</p><ul style="margin:0 0 8px 0">', count( $awaiting ) );
		foreach ( array_slice( $awaiting, 0, 10 ) as $post ) {
			printf(
				'<li><a href="%s" dir="ltr">%s</a> — %s ریال</li>',
				esc_url( get_edit_post_link( $post->ID ) ),
				esc_html( (string) get_post_meta( $post->ID, 'cyh_code', true ) ),
				esc_html( number_format( (int) get_post_meta( $post->ID, 'cyh_total', true ) ) )
			);
		}
		echo '</ul>';
	}
	printf(
		'<p><a href="%s">در انتظار ارسال ←</a> · <a href="%s">همه‌ی سفارش‌ها ←</a></p>',
		esc_url( admin_url( 'edit.php?post_type=' . CYH_QUOTE_CPT . '&cyh_view=orders&cyh_fulfil=processing' ) ),
		esc_url( admin_url( 'edit.php?post_type=' . CYH_QUOTE_CPT . '&cyh_view=orders' ) )
	);
}

function cyh_register_orders_widget() {
	wp_add_dashboard_widget( 'cyh_orders_widget', 'سفارش‌های در انتظار ارسال', 'cyh_orders_dashboard_widget' );
}
add_action( 'wp_dashboard_setup', 'cyh_register_orders_widget' );
