<?php
/**
 * پرسش و پاسخ روی صفحه‌ی دسته.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * چرا این فایل وجود دارد — و چرا از سامانه‌ی موجود استفاده نکرد
 * ═══════════════════════════════════════════════════════════════════════════
 * `class-community.php` پرسش، گزارش نصب و نظر را روی **دیدگاه وردپرس**
 * می‌سازد و درست کار می‌کند. طبیعی‌ترین کار این بود که همان را برای دسته
 * هم صدا بزنیم.
 *
 * ولی نمی‌شود: دیدگاه در وردپرس فقط به **نوشته** می‌چسبد
 * (`comment_post_ID` کلید خارجی به جدول posts است). دسته‌های این پروژه
 * **ترم تاکسونومی**‌اند، نه نوشته. یعنی این یک کار «وصل‌کردن» نبود،
 * یک تصمیم ذخیره‌سازی بود. سه گزینه بررسی و در `docs/backlog.md` ثبت شد؛
 * کارفرما گزینه‌ی CPT را تأیید کرد.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * چرا پرسشِ دسته ارزشمندترین محتوای سئویی این پروژه است
 * ═══════════════════════════════════════════════════════════════════════════
 * هر پرسش، یک عبارت جستجوی واقعی است با کلمات خود خریدار — چیزی که هیچ
 * نویسنده‌ای حدس نمی‌زند: «آیا سیم‌بکسل ۱۲ میلی‌متری روی درام دماگ
 * می‌خورد؟». این متن را نمی‌شود نوشت؛ فقط می‌شود جمعش کرد.
 *
 * ⚠️ برند عمداً بیرون است. پرسش روی صفحه‌ی دماگ یعنی پرسش گارانتی و
 * پشتیبانی برای سازنده‌ای که نمایندگی‌اش را نداریم — پاسخ‌دادن به آن،
 * رابطه‌ای را تلویحاً ادعا می‌کند که وجود ندارد. همان ریسک حقوقیِ ادعای
 * نمایندگی، این بار از در پشتی.
 *
 * ⚠️ بدهی شناخته‌شده — دو مسیر برای «پرسش»: پرسشِ محصول هنوز روی دیدگاه
 * است و پرسشِ دسته اینجاست. این دقیقاً همان الگوی «دو سامانه که آرام‌آرام
 * واگرا می‌شوند» است که این پروژه قبلاً از آن ضربه خورده. به همین دلیل:
 *   • اعتبارسنجی **مشترک** است (`cyh_validate_submission`) و اینجا کپی نشد.
 *   • این CPT از روز اول فیلد `cyh_entity_type` دارد و می‌تواند محصول را
 *     هم نگه دارد. مهاجرت محصول به اینجا یک *انتقال داده* است، نه
 *     بازطراحی — و چون هنوز هیچ پرسش واقعی ثبت نشده، هزینه‌اش امروز صفر
 *     است. تصمیمش با کارفرماست و در backlog ثبت شده.
 *
 * @package CraneYadakHeadless
 */

defined( 'ABSPATH' ) || exit;

const CYH_QUESTION_CPT = 'cyh_question';

/* =========================================================================
   ۱) ثبت CPT
   ========================================================================= */
/**
 * عنوان نوشته = پرسش. بدنه = پاسخ کارشناس.
 *
 * ⚠️ این نگاشت عمدی است و جایگزینِ ساختنِ دو فیلد سفارشی می‌شود: گردش کار
 * تعدیلِ خودِ وردپرس (در انتظار بررسی → منتشرشده) دقیقاً همان چیزی است که
 * لازم داریم، و رایگان به دست می‌آید. پرسشِ بی‌پاسخ = پیش‌نویس؛ پرسشِ
 * پاسخ‌داده‌شده = منتشرشده.
 */
function cyh_register_question_cpt() {
	register_post_type(
		CYH_QUESTION_CPT,
		[
			'labels'             => [
				'name'               => 'پرسش‌های دسته',
				'singular_name'      => 'پرسش',
				'add_new_item'       => 'افزودن پرسش',
				'edit_item'          => 'پاسخ به پرسش',
				'search_items'       => 'جستجوی پرسش‌ها',
				'not_found'          => 'هنوز پرسشی ثبت نشده است.',
				'not_found_in_trash' => 'پرسشی در زباله‌دان نیست.',
			],
			'public'              => false,
			'publicly_queryable'  => false,
			'show_ui'             => true,
			'show_in_menu'        => true,
			'menu_position'       => 27,
			'menu_icon'           => 'dashicons-format-chat',
			// 'editor' = پاسخ. 'title' = خود پرسش.
			'supports'            => [ 'title', 'editor' ],
			'has_archive'         => false,
			'rewrite'             => false,
			'show_in_rest'        => true,
			'show_in_graphql'     => true,
			'graphql_single_name' => 'craneQuestion',
			'graphql_plural_name' => 'craneQuestions',
			// نویسنده‌ی پرسش کاربر ناشناس است؛ «ایجاد» از پنل هم بی‌معنا
			// نیست (کارشناس می‌تواند پرسش پرتکرار را خودش وارد کند).
			'capability_type'     => 'post',
			'map_meta_cap'        => true,
		]
	);

	/* ⚠️ همان تاکسونومی `crane_category`، نه یک تاکسونومی تازه. اگر برای
	   پرسش‌ها دسته‌بندی جدا می‌ساختیم، دو درخت دسته می‌داشتیم که باید
	   دستی هم‌گام می‌ماندند — همان اشتباهی که با دو فهرست ریدایرکت شد. */
	register_taxonomy_for_object_type( 'crane_category', CYH_QUESTION_CPT );
}
add_action( 'init', 'cyh_register_question_cpt', 5 );

/* =========================================================================
   ۲) فیلدهای متا — و نمایششان در گراف‌کیوال
   ========================================================================= */
/**
 * ⚠️ `show_in_graphql` روی متا کافی نیست؛ WPGraphQL فیلدهای متای دلخواه
 * را خودکار expose نمی‌کند. ثبت صریح با `register_graphql_field` لازم است،
 * وگرنه کوئری فرانت‌اند با «Cannot query field» می‌افتد — و نردبان کوئری
 * آن را به پله‌ی پایین‌تر می‌برد و نام پرسشگر بی‌صدا حذف می‌شود.
 */
function cyh_question_register_meta() {
	foreach ( [ 'cyh_asker', 'cyh_crane_model', 'cyh_entity_type' ] as $key ) {
		register_post_meta( CYH_QUESTION_CPT, $key, [
			'type'         => 'string',
			'single'       => true,
			'show_in_rest' => true,
			// ایمیل و IP عمداً اینجا نیستند: متای عمومی نباید داده‌ی تماس
			// را قابل خواندن کند.
			'auth_callback' => static function () {
				return current_user_can( 'edit_posts' );
			},
		] );
	}
}
add_action( 'init', 'cyh_question_register_meta', 6 );

function cyh_question_graphql_fields() {
	if ( ! function_exists( 'register_graphql_field' ) ) {
		return;
	}

	register_graphql_field( 'CraneQuestion', 'askerName', [
		'type'        => 'String',
		'description' => 'نام کوچکِ پرسشگر — برای نمایش کنار پرسش.',
		'resolve'     => static function ( $post ) {
			return get_post_meta( $post->ID, 'cyh_asker', true ) ?: null;
		},
	] );

	register_graphql_field( 'CraneQuestion', 'craneModel', [
		'type'        => 'String',
		'description' => 'مدل جرثقیلی که پرسش درباره‌ی آن است، اگر گفته شده باشد.',
		'resolve'     => static function ( $post ) {
			return get_post_meta( $post->ID, 'cyh_crane_model', true ) ?: null;
		},
	] );
}
add_action( 'graphql_register_types', 'cyh_question_graphql_fields' );

/* =========================================================================
   ۳) ستون‌های پنل — تعدیل باید در یک نگاه ممکن باشد
   ========================================================================= */
function cyh_question_columns( $cols ) {
	$out = [];
	foreach ( $cols as $key => $label ) {
		$out[ $key ] = 'title' === $key ? 'پرسش' : $label;
		if ( 'title' === $key ) {
			$out['cyh_cat']    = 'دسته';
			$out['cyh_answer'] = 'پاسخ';
			$out['cyh_asker']  = 'پرسشگر';
		}
	}
	return $out;
}
add_filter( 'manage_' . CYH_QUESTION_CPT . '_posts_columns', 'cyh_question_columns' );

function cyh_question_column_body( $col, $post_id ) {
	if ( 'cyh_cat' === $col ) {
		$terms = get_the_terms( $post_id, 'crane_category' );
		echo $terms && ! is_wp_error( $terms )
			? esc_html( implode( '، ', wp_list_pluck( $terms, 'name' ) ) )
			: '<span style="color:#b32d2e">— بدون دسته —</span>';
		return;
	}

	if ( 'cyh_answer' === $col ) {
		$has = '' !== trim( (string) get_post_field( 'post_content', $post_id ) );
		/* پرسشِ منتشرشده‌ی بی‌پاسخ بدترین حالت است: هم روی سایت می‌آید، هم
		   وارد اسکیمای FAQ/QAPage می‌شود. گوگل پاسخِ خالی را نقض راهنما
		   می‌داند. پس در همین ستون فریاد می‌زند. */
		$live = 'publish' === get_post_status( $post_id );
		if ( $has ) {
			echo '<span style="color:#00713c">✓ دارد</span>';
		} elseif ( $live ) {
			echo '<strong style="color:#b32d2e">⚠ منتشر شده ولی بی‌پاسخ</strong>';
		} else {
			echo '<span style="color:#996800">در انتظار پاسخ</span>';
		}
		return;
	}

	if ( 'cyh_asker' === $col ) {
		echo esc_html( get_post_meta( $post_id, 'cyh_asker', true ) ?: '—' );
	}
}
add_action( 'manage_' . CYH_QUESTION_CPT . '_posts_custom_column', 'cyh_question_column_body', 10, 2 );

/* =========================================================================
   ۴) اندپوینت REST
   ========================================================================= */
function cyh_register_question_routes() {
	register_rest_route(
		'crane-yadak/v1',
		'/category-question',
		[
			'methods'             => 'POST',
			'permission_callback' => '__return_true', // عمومی؛ دفاع پایین‌تر اعمال می‌شود
			'callback'            => 'cyh_rest_submit_category_question',
		]
	);
}
add_action( 'rest_api_init', 'cyh_register_question_routes' );

/**
 * ⚠️ اعتبارسنجی از `class-community.php` قرض گرفته می‌شود و اینجا کپی
 * **نمی‌شود**. سه لایه‌ی دفاعی (هانی‌پات، محدودیت نرخ، پاک‌سازی) باید یک
 * پیاده‌سازی داشته باشند؛ دو نسخه یعنی روزی یکی وصله می‌شود و آن یکی نه.
 */
function cyh_rest_submit_category_question( $request ) {
	if ( ! function_exists( 'cyh_validate_submission' ) ) {
		return new WP_Error( 'cyh_no_validator', 'سرویس در دسترس نیست.', [ 'status' => 500 ] );
	}

	// `false` یعنی «نوشته‌ی مقصد لازم نیست» — مقصد اینجا یک ترم است.
	$data = cyh_validate_submission( $request, false );
	if ( is_wp_error( $data ) ) {
		return $data;
	}

	$slug = sanitize_title( (string) $request->get_param( 'category_slug' ) );
	$term = $slug ? get_term_by( 'slug', $slug, 'crane_category' ) : null;
	if ( ! $term || is_wp_error( $term ) ) {
		return new WP_Error( 'cyh_bad_category', 'دسته‌ی مورد نظر پیدا نشد.', [ 'status' => 404 ] );
	}

	/* عنوان = پرسش. علامت سوال اگر نبود اضافه می‌شود: عنوانِ پرسشی هم در
	   پنل خواناتر است و هم در `QAPage` طبیعی‌تر می‌نشیند. */
	$title = trim( $data['body'] );
	if ( ! preg_match( '/[؟?]\s*$/u', $title ) ) {
		$title .= '؟';
	}

	$post_id = wp_insert_post(
		[
			'post_type'    => CYH_QUESTION_CPT,
			'post_title'   => wp_trim_words( $title, 40, '…؟' ),
			'post_content' => '', // پاسخ بعداً در پنل نوشته می‌شود
			'post_status'  => 'pending', // ⚠️ هرگز publish — تعدیل اجباری است
		],
		true
	);

	if ( is_wp_error( $post_id ) || ! $post_id ) {
		return new WP_Error( 'cyh_insert_failed', 'ثبت انجام نشد. دوباره تلاش کنید.', [ 'status' => 500 ] );
	}

	wp_set_object_terms( $post_id, (int) $term->term_id, 'crane_category' );

	update_post_meta( $post_id, 'cyh_entity_type', 'category' );
	update_post_meta( $post_id, 'cyh_asker', $data['name'] );
	if ( '' !== $data['email'] ) {
		update_post_meta( $post_id, 'cyh_asker_email', $data['email'] );
	}
	if ( '' !== $data['ip'] ) {
		update_post_meta( $post_id, 'cyh_ip', $data['ip'] );
	}
	$model = sanitize_text_field( (string) $request->get_param( 'crane_model' ) );
	if ( '' !== $model ) {
		update_post_meta( $post_id, 'cyh_crane_model', $model );
	}

	return rest_ensure_response(
		[
			'ok'      => true,
			'message' => 'پرسش شما ثبت شد. پس از پاسخ کارشناس فنی، روی همین صفحه منتشر می‌شود.',
		]
	);
}

/* =========================================================================
   ۵) نگهبان انتشار — پرسشِ بی‌پاسخ نباید منتشر شود
   ========================================================================= */
/**
 * ⚠️ این فیلتر از یک خطای واقعیِ سئویی جلوگیری می‌کند، نه از یک بی‌نظمی.
 *
 * پرسشِ منتشرشده‌ی بی‌پاسخ روی سایت می‌آید و وارد `QAPage` می‌شود.
 * راهنمای داده‌ی ساختاریافته‌ی گوگل، پاسخِ خالی را نقض می‌داند و
 * می‌تواند rich result کل صفحه را بردارد. کلیکِ اشتباهِ «انتشار» در یک
 * فهرست شلوغ، اتفاق کاملاً عادی‌ای است — پس کد جلویش را می‌گیرد.
 */
function cyh_question_block_empty_publish( $data, $postarr ) {
	if ( CYH_QUESTION_CPT !== ( $data['post_type'] ?? '' ) ) {
		return $data;
	}
	if ( 'publish' !== ( $data['post_status'] ?? '' ) ) {
		return $data;
	}
	if ( '' === trim( wp_strip_all_tags( (string) ( $data['post_content'] ?? '' ) ) ) ) {
		$data['post_status'] = 'pending';
		set_transient( 'cyh_question_notice_' . get_current_user_id(), 1, 60 );
	}
	return $data;
}
add_filter( 'wp_insert_post_data', 'cyh_question_block_empty_publish', 10, 2 );

function cyh_question_admin_notice() {
	$key = 'cyh_question_notice_' . get_current_user_id();
	if ( ! get_transient( $key ) ) {
		return;
	}
	delete_transient( $key );
	echo '<div class="notice notice-warning is-dismissible"><p>'
		. '<strong>پرسش منتشر نشد.</strong> پاسخ خالی است و پرسشِ بی‌پاسخ '
		. 'هم روی صفحه بی‌فایده است و هم داده‌ی ساختاریافته‌ی صفحه را نقض '
		. 'می‌کند. پاسخ را بنویسید و دوباره منتشر کنید — تا آن‌موقع در '
		. '«در انتظار بررسی» می‌ماند.'
		. '</p></div>';
}
add_action( 'admin_notices', 'cyh_question_admin_notice' );
