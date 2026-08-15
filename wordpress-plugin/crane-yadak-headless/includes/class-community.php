<?php
/**
 * انجمن: پرسش‌وپاسخ فنی، نظر خریداران، و گزارش نصب.
 *
 * ---------------------------------------------------------------------------
 * تصمیم معماری: چرا «پرسش‌وپاسخ» مقدم بر «نظر» است
 *
 * در فروش B2B صنعتی، الگوی «امتیاز ۵ ستاره» تقریباً بی‌معناست. کسی درباره‌ی
 * یک لنت ترمز نظر احساسی نمی‌نویسد. سوال واقعی خریدار همیشه یکی است:
 * «آیا این قطعه روی دستگاه من می‌خورد؟»
 *
 * بنابراین سه نوع محتوای کاربر با اولویت متفاوت پیاده شده است:
 *
 *   ۱) پرسش فنی (اصلی) — خریدار می‌پرسد، کارشناس *ما* پاسخ می‌دهد.
 *      هر پرسش یک عبارت جستجوی طولانی واقعی است؛ این بهترین منبع
 *      long-tail برای این صنعت است.
 *   ۲) گزارش نصب (ابتکاری) — خریدار می‌گوید این قطعه روی چه دستگاهی
 *      نصب شده و چقدر کار کرده. برای خریدار بعدی از هر امتیازی معتبرتر
 *      است و دقیقاً همان سوال سازگاری را جواب می‌دهد.
 *   ۳) نظر و امتیاز (فرعی) — پشتیبانی می‌شود اما ستون اصلی نیست.
 *
 * هر سه روی سیستم «دیدگاه» وردپرس سوارند، نه یک جدول سفارشی. دلیل:
 * تعدیل (moderation)، ضداسپم، اعلان ایمیلی و مدیریت کاربر از قبل ساخته
 * شده‌اند و امتحان پس داده‌اند. ساختن جدول سفارشی یعنی بازنویسی همه‌ی
 * این‌ها با کیفیت کمتر.
 *
 * ⚠️ همه‌ی ورودی‌های کاربر پیش‌فرض «در انتظار تایید» هستند. هیچ محتوای
 * کاربری بدون تایید انسانی روی سایت نمی‌رود.
 * ---------------------------------------------------------------------------
 *
 * @package CraneYadakHeadless
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const CYH_CT_QUESTION = 'cyh_question';
const CYH_CT_ANSWER   = 'cyh_answer';
const CYH_CT_FITMENT  = 'cyh_fitment';
const CYH_CT_REVIEW   = 'cyh_review';

/* =========================================================================
   ۱) نقش‌های سازمانی
   =========================================================================
   تا پیش از این هیچ نقشی تعریف نشده بود و همه با نقش پیش‌فرض وردپرس کار
   می‌کردند. نتیجه: یا همه ادمین بودند (ریسک امنیتی) یا هیچ‌کس نمی‌توانست
   پاسخ فنی ثبت کند.

   سه نقش، بر اساس کاری که واقعاً در این کسب‌وکار انجام می‌شود:
   ========================================================================= */
function cyh_register_roles() {
	// کارشناس فنی — پاسخ‌گوی پرسش‌های مهندسی. مهم‌ترین نقش برای E-E-A-T:
	// نامش زیر پاسخ‌ها و در اسکیمای Person می‌آید.
	add_role(
		'crane_expert',
		'کارشناس فنی کرین یدک',
		[
			'read'                  => true,
			'edit_posts'            => true,
			'edit_published_posts'  => true,
			'delete_posts'          => false,
			'publish_posts'         => false, // پیش‌نویس می‌نویسد، منتشر نمی‌کند
			'upload_files'          => true,
			'moderate_comments'     => true,  // برای پاسخ به پرسش‌ها
			'cyh_answer_questions'  => true,
		]
	);

	// سردبیر محتوا — متن دسته‌ها و مقالات را می‌نویسد و منتشر می‌کند.
	add_role(
		'crane_editor',
		'سردبیر محتوا',
		[
			'read'                   => true,
			'edit_posts'             => true,
			'edit_others_posts'      => true,
			'edit_published_posts'   => true,
			'publish_posts'          => true,
			'delete_posts'           => true,
			'upload_files'           => true,
			'moderate_comments'      => true,
			'manage_categories'      => true,
		]
	);

	// کارشناس فروش — قیمت و موجودی را به‌روز می‌کند، به محتوا کاری ندارد.
	add_role(
		'crane_sales',
		'کارشناس فروش',
		[
			'read'                 => true,
			'edit_posts'           => true,
			'edit_published_posts' => true,
			'publish_posts'        => false,
			'upload_files'         => false,
		]
	);

	// مدیر کل هم باید بتواند پاسخ فنی ثبت کند.
	$admin = get_role( 'administrator' );
	if ( $admin ) {
		$admin->add_cap( 'cyh_answer_questions' );
	}
}

/* =========================================================================
   ۲) فعال‌کردن دیدگاه روی محصولات
   ========================================================================= */
function cyh_enable_product_comments() {
	add_post_type_support( 'product', 'comments' );
}
add_action( 'init', 'cyh_enable_product_comments', 20 );

/**
 * دیدگاه‌های ما هرگز نباید در فید یا شمارش عمومی وردپرس ظاهر شوند مگر
 * از نوع درست. این تابع نوع دیدگاه را در همان لحظه‌ی درج تثبیت می‌کند.
 */
function cyh_default_comment_pending( $approved, $commentdata ) {
	$ours = [ CYH_CT_QUESTION, CYH_CT_FITMENT, CYH_CT_REVIEW ];
	if ( isset( $commentdata['comment_type'] ) && in_array( $commentdata['comment_type'], $ours, true ) ) {
		return 0; // همیشه در انتظار تایید
	}
	return $approved;
}
add_filter( 'pre_comment_approved', 'cyh_default_comment_pending', 20, 2 );

/* =========================================================================
   ۳) اندپوینت‌های REST
   ========================================================================= */
function cyh_register_community_routes() {
	$common = [
		'methods'             => 'POST',
		'permission_callback' => '__return_true', // عمومی؛ امنیت پایین‌تر اعمال می‌شود
	];

	register_rest_route( 'crane-yadak/v1', '/question', array_merge( $common, [ 'callback' => 'cyh_rest_submit_question' ] ) );
	register_rest_route( 'crane-yadak/v1', '/fitment', array_merge( $common, [ 'callback' => 'cyh_rest_submit_fitment' ] ) );
	register_rest_route( 'crane-yadak/v1', '/review', array_merge( $common, [ 'callback' => 'cyh_rest_submit_review' ] ) );
}
add_action( 'rest_api_init', 'cyh_register_community_routes' );

/**
 * اعتبارسنجی مشترک همه‌ی ارسال‌های کاربر.
 *
 * سه لایه‌ی دفاعی، به همان ترتیبی که در فرم تماس هم استفاده شده:
 *   الف) هانی‌پات — ربات ساده آن را پر می‌کند
 *   ب) محدودیت نرخ بر اساس IP
 *   ج) پاک‌سازی سخت‌گیرانه‌ی همه‌ی فیلدها
 */
function cyh_validate_submission( $request ) {
	// الف) هانی‌پات
	if ( '' !== trim( (string) $request->get_param( 'website' ) ) ) {
		return new WP_Error( 'cyh_spam', 'ارسال نامعتبر.', [ 'status' => 400 ] );
	}

	// ب) محدودیت نرخ — از همان تابع فرم تماس استفاده می‌شود اگر موجود بود.
	$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
	if ( $ip && function_exists( 'cyh_is_rate_limited' ) && cyh_is_rate_limited( $ip ) ) {
		return new WP_Error( 'cyh_rate', 'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.', [ 'status' => 429 ] );
	}

	$post_id = (int) $request->get_param( 'post_id' );
	if ( $post_id < 1 || ! get_post( $post_id ) ) {
		return new WP_Error( 'cyh_bad_post', 'محصول مورد نظر پیدا نشد.', [ 'status' => 404 ] );
	}

	$name = sanitize_text_field( (string) $request->get_param( 'name' ) );
	$body = sanitize_textarea_field( (string) $request->get_param( 'body' ) );

	if ( mb_strlen( $name ) < 2 ) {
		return new WP_Error( 'cyh_bad_name', 'نام را وارد کنید.', [ 'status' => 400 ] );
	}
	if ( mb_strlen( $body ) < 10 ) {
		return new WP_Error( 'cyh_bad_body', 'متن باید حداقل ۱۰ کاراکتر باشد.', [ 'status' => 400 ] );
	}

	// ایمیل اختیاری است اما اگر داده شد باید معتبر باشد.
	$email = sanitize_email( (string) $request->get_param( 'email' ) );
	if ( '' !== (string) $request->get_param( 'email' ) && ! is_email( $email ) ) {
		return new WP_Error( 'cyh_bad_email', 'ایمیل معتبر نیست.', [ 'status' => 400 ] );
	}

	return [
		'post_id' => $post_id,
		'name'    => $name,
		'email'   => $email,
		'body'    => $body,
		'ip'      => $ip,
	];
}

/** درج دیدگاه با نوع مشخص. */
function cyh_insert_community_comment( $data, $type, $meta = [] ) {
	$comment_id = wp_insert_comment(
		[
			'comment_post_ID'      => $data['post_id'],
			'comment_author'       => $data['name'],
			'comment_author_email' => $data['email'],
			'comment_content'      => $data['body'],
			'comment_type'         => $type,
			'comment_approved'     => 0,
			'comment_author_IP'    => $data['ip'],
		]
	);

	if ( ! $comment_id ) {
		return new WP_Error( 'cyh_insert_failed', 'ثبت انجام نشد. دوباره تلاش کنید.', [ 'status' => 500 ] );
	}

	foreach ( $meta as $key => $value ) {
		if ( '' !== $value ) {
			add_comment_meta( $comment_id, $key, $value );
		}
	}

	return $comment_id;
}

function cyh_rest_submit_question( $request ) {
	$data = cyh_validate_submission( $request );
	if ( is_wp_error( $data ) ) {
		return $data;
	}

	$result = cyh_insert_community_comment( $data, CYH_CT_QUESTION, [
		'cyh_crane_model' => sanitize_text_field( (string) $request->get_param( 'crane_model' ) ),
	] );

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	return rest_ensure_response( [
		'ok'      => true,
		'message' => 'پرسش شما ثبت شد. پس از پاسخ کارشناس فنی، روی همین صفحه منتشر می‌شود.',
	] );
}

function cyh_rest_submit_fitment( $request ) {
	$data = cyh_validate_submission( $request );
	if ( is_wp_error( $data ) ) {
		return $data;
	}

	// گزارش نصب بدون مدل دستگاه بی‌ارزش است — کل هدفش همین است.
	$model = sanitize_text_field( (string) $request->get_param( 'crane_model' ) );
	if ( mb_strlen( $model ) < 2 ) {
		return new WP_Error( 'cyh_no_model', 'مدل یا برند جرثقیل را وارد کنید.', [ 'status' => 400 ] );
	}

	$result = cyh_insert_community_comment( $data, CYH_CT_FITMENT, [
		'cyh_crane_model'    => $model,
		'cyh_service_months' => (string) max( 0, (int) $request->get_param( 'service_months' ) ),
	] );

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	return rest_ensure_response( [
		'ok'      => true,
		'message' => 'گزارش نصب شما ثبت شد و پس از بررسی منتشر می‌شود. ممنون — این اطلاعات برای خریدار بعدی بسیار ارزشمند است.',
	] );
}

function cyh_rest_submit_review( $request ) {
	$data = cyh_validate_submission( $request );
	if ( is_wp_error( $data ) ) {
		return $data;
	}

	$rating = (int) $request->get_param( 'rating' );
	if ( $rating < 1 || $rating > 5 ) {
		return new WP_Error( 'cyh_bad_rating', 'امتیاز باید بین ۱ تا ۵ باشد.', [ 'status' => 400 ] );
	}

	$result = cyh_insert_community_comment( $data, CYH_CT_REVIEW, [
		'cyh_rating' => (string) $rating,
	] );

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	return rest_ensure_response( [
		'ok'      => true,
		'message' => 'نظر شما ثبت شد و پس از تایید منتشر می‌شود.',
	] );
}

/* =========================================================================
   ۴) نمایش در WPGraphQL
   ========================================================================= */
function cyh_register_community_graphql() {
	if ( ! function_exists( 'register_graphql_field' ) ) {
		return;
	}

	register_graphql_object_type( 'CraneCommunityEntry', [
		'description' => 'یک ورودی کاربر: پرسش، گزارش نصب یا نظر.',
		'fields'      => [
			'id'            => [ 'type' => 'Int' ],
			'type'          => [ 'type' => 'String' ],
			'author'        => [ 'type' => 'String' ],
			'content'       => [ 'type' => 'String' ],
			'date'          => [ 'type' => 'String' ],
			'craneModel'    => [ 'type' => 'String' ],
			'serviceMonths' => [ 'type' => 'Int' ],
			'rating'        => [ 'type' => 'Int' ],
			'answer'        => [ 'type' => 'String' ],
			'answerAuthor'  => [ 'type' => 'String' ],
			'answerDate'    => [ 'type' => 'String' ],
		],
	] );

	register_graphql_field( 'CraneProduct', 'community', [
		'type'        => [ 'list_of' => 'CraneCommunityEntry' ],
		'description' => 'پرسش‌ها، گزارش‌های نصب و نظرهای تاییدشده.',
		'resolve'     => function ( $post ) {
			$comments = get_comments( [
				'post_id' => $post->ID,
				'status'  => 'approve',
				'type__in' => [ CYH_CT_QUESTION, CYH_CT_FITMENT, CYH_CT_REVIEW ],
				'parent'  => 0,
				'order'   => 'ASC',
			] );

			$out = [];
			foreach ( $comments as $c ) {
				// پاسخ کارشناس = اولین ریپلای تاییدشده.
				$replies = get_comments( [
					'parent' => $c->comment_ID,
					'status' => 'approve',
					'number' => 1,
				] );
				$reply = ! empty( $replies ) ? $replies[0] : null;

				$out[] = [
					'id'            => (int) $c->comment_ID,
					'type'          => $c->comment_type,
					'author'        => $c->comment_author,
					'content'       => $c->comment_content,
					'date'          => $c->comment_date_gmt,
					'craneModel'    => (string) get_comment_meta( $c->comment_ID, 'cyh_crane_model', true ),
					'serviceMonths' => (int) get_comment_meta( $c->comment_ID, 'cyh_service_months', true ),
					'rating'        => (int) get_comment_meta( $c->comment_ID, 'cyh_rating', true ),
					'answer'        => $reply ? $reply->comment_content : null,
					'answerAuthor'  => $reply ? $reply->comment_author : null,
					'answerDate'    => $reply ? $reply->comment_date_gmt : null,
				];
			}

			return $out;
		},
	] );
}
add_action( 'graphql_register_types', 'cyh_register_community_graphql' );

/* =========================================================================
   ۵) پنل مدیریت — ستون نوع و فیلتر
   ========================================================================= */
function cyh_comment_type_column( $columns ) {
	$columns['cyh_type'] = 'نوع';
	return $columns;
}
add_filter( 'manage_edit-comments_columns', 'cyh_comment_type_column' );

function cyh_comment_type_column_content( $column, $comment_id ) {
	if ( 'cyh_type' !== $column ) {
		return;
	}

	$comment = get_comment( $comment_id );
	$labels  = [
		CYH_CT_QUESTION => [ 'پرسش فنی', '#2271b1' ],
		CYH_CT_FITMENT  => [ 'گزارش نصب', '#00a32a' ],
		CYH_CT_REVIEW   => [ 'نظر خریدار', '#dba617' ],
	];

	if ( isset( $labels[ $comment->comment_type ] ) ) {
		list( $label, $color ) = $labels[ $comment->comment_type ];
		printf(
			'<span style="background:%s;color:#fff;padding:2px 8px;border-radius:3px;font-size:11px">%s</span>',
			esc_attr( $color ),
			esc_html( $label )
		);

		$model = get_comment_meta( $comment_id, 'cyh_crane_model', true );
		if ( $model ) {
			printf( '<br><small>دستگاه: %s</small>', esc_html( $model ) );
		}
	} else {
		echo '<small>دیدگاه عادی</small>';
	}
}
add_action( 'manage_comments_custom_column', 'cyh_comment_type_column_content', 10, 2 );
