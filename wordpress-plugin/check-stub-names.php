<?php
/**
 * پیش‌بررسی نام stubها — پیش از اجرای هارنس.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * چرا این فایل جدا از هارنس است
 * ═══════════════════════════════════════════════════════════════════════════
 * هارنس یک stub برای `is_uploaded_file()` داشت. آن تابع جزو **هسته‌ی خود
 * PHP** است، نه وردپرس. نتیجه:
 *
 *     PHP Fatal error: Cannot redeclare function is_uploaded_file()
 *
 * و نکته‌ی مهم این است که آن خطا در زمان **کامپایل** رخ می‌دهد — پیش از
 * اجرای حتی یک خط از خود هارنس. یعنی هارنس نمی‌تواند خودش را از این خطا
 * محافظت کند؛ تا وقتی فایل کامپایل شود، کار از کار گذشته است.
 *
 * پس بررسی باید در یک فرایند **جداگانه** انجام شود که هارنس را فقط به
 * چشم *متن* می‌بیند، نه کد.
 *
 * اجرا:  php wordpress-plugin/check-stub-names.php
 */

$file = __DIR__ . '/wp-stub-harness.php';

if ( ! is_readable( $file ) ) {
	fwrite( STDERR, "❌ هارنس پیدا نشد: $file\n" );
	exit( 1 );
}

$src = file_get_contents( $file );

// فقط تعریف‌های سطح بالا — نه متدهای داخل کلاس (که تورفتگی بیشتری دارند
// و به هر حال با توابع سراسری تداخل نمی‌کنند).
preg_match_all( '/^function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/m', $src, $m, PREG_OFFSET_CAPTURE );

// شماره‌ی خط هر تعریف — برای گزارشی که بشود مستقیم رفت سراغش.
$lines = [];
foreach ( $m[1] as list( $name, $offset ) ) {
	$lines[ $name ][] = substr_count( $src, "\n", 0, $offset ) + 1;
}

/*
 * ⚠️ دو نوع تصادم وجود دارد و نسخه‌ی اول این اسکریپت فقط یکی را می‌دید.
 *
 * نسخه‌ی اول `array_unique()` می‌زد و بعد دنبال تابع درونی PHP می‌گشت.
 * اما `array_unique` دقیقاً همان چیزی را پاک می‌کرد که باید پیدا می‌شد:
 * دو تعریف از `sanitize_textarea_field()` در خطوط ۸۵ و ۲۲۱. اسکریپت
 * گفت «هر ۱۱۲ نام آزاد است» و بلافاصله بعدش هارنس با
 * `Cannot redeclare` مرد.
 *
 * یعنی ابزاری که برای گرفتن `Cannot redeclare` ساخته شده بود، یک
 * `Cannot redeclare` را از دست داد — چون سیگنال را قبل از بررسی حذف
 * می‌کرد. حالا هر دو نوع بررسی می‌شود:
 *
 *   ۱) تعریف تکراری *داخل* خود هارنس
 *   ۲) تصادم با تابع درونی PHP
 */
$dupes = array_filter( $lines, fn( $l ) => count( $l ) > 1 );

if ( $dupes ) {
	fwrite( STDERR, '❌ هارنس ' . count( $dupes ) . " تابع را دوبار تعریف می‌کند:\n" );
	foreach ( $dupes as $name => $where ) {
		fwrite( STDERR, "   • $name()  خطوط: " . implode( '، ', $where ) . "\n" );
	}
	fwrite( STDERR, "\n   یکی از هر جفت را حذف کنید.\n" );
	exit( 1 );
}

$declared = array_keys( $lines );
$clashes  = [];

foreach ( $declared as $name ) {
	if ( ! function_exists( $name ) ) {
		continue; // هنوز وجود ندارد → امن است.
	}

	// `function_exists` برای توابع تعریف‌شده در همین فرایند هم true است،
	// پس باید مشخص کنیم که آیا تابع *درونیِ* PHP است یا نه.
	try {
		if ( ( new ReflectionFunction( $name ) )->isInternal() ) {
			$clashes[] = $name;
		}
	} catch ( ReflectionException $e ) {
		// قابل بازتاب نبود — نادیده بگیر.
	}
}

if ( $clashes ) {
	fwrite( STDERR, "❌ هارنس می‌خواهد " . count( $clashes ) . " تابع درونی PHP را دوباره تعریف کند:\n" );
	foreach ( $clashes as $name ) {
		fwrite( STDERR, "   • $name()  ← مال PHP است، نه وردپرس. stub آن را حذف کنید.\n" );
	}
	fwrite( STDERR, "\n   این خطا در زمان کامپایل رخ می‌دهد و کل هارنس را پیش از\n" );
	fwrite( STDERR, "   اجرای هر آزمونی می‌کشد.\n" );
	exit( 1 );
}

/*
 * سومین مسیر تصادم: stub هارنس هم‌نام با تابع *خود افزونه*.
 *
 * دو مسیر اول هرکدام یک بار هارنس را کشتند. این یکی هنوز اتفاق نیفتاده،
 * ولی دقیقاً از همان جنس است و روزی که یک تابع کمکی جدید به افزونه اضافه
 * شود که اتفاقاً هم‌نام یک stub باشد، خواهد افتاد. سه خط کد، در برابر
 * یک عصر دیباگ.
 */
$plugin_fns = [];
$dir        = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( __DIR__ . '/crane-yadak-headless' ) );

foreach ( $dir as $f ) {
	if ( ! $f->isFile() || 'php' !== strtolower( $f->getExtension() ) ) {
		continue;
	}
	preg_match_all( '/^function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/m', file_get_contents( $f->getPathname() ), $pm );
	foreach ( $pm[1] as $n ) {
		$plugin_fns[ $n ] = $f->getFilename();
	}
}

$overlap = array_intersect( $declared, array_keys( $plugin_fns ) );

if ( $overlap ) {
	fwrite( STDERR, '❌ ' . count( $overlap ) . " نام هم در هارنس stub شده و هم در افزونه تعریف شده:\n" );
	foreach ( $overlap as $n ) {
		fwrite( STDERR, "   • $n()  ← افزونه: {$plugin_fns[$n]}\n" );
	}
	fwrite( STDERR, "\n   هارنس نباید توابع خود افزونه را stub کند.\n" );
	exit( 1 );
}

printf(
	"✅ %d نام stub بررسی شد — نه تکراری، نه تابع درونی PHP، نه هم‌نام با %d تابع افزونه.\n",
	count( $declared ),
	count( $plugin_fns )
);
