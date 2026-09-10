<?php
/**
 * پوشش stubها — آیا هارنس هر تابع وردپرسی که افزونه صدا می‌زند را دارد؟
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * چرا این لازم شد
 * ═══════════════════════════════════════════════════════════════════════════
 * هارنس سه بار پشت سر هم مرد و هر بار به یک دلیل *متفاوت* از جنس یکسان:
 *
 *   ۱) stub یک تابع درونی PHP  → Cannot redeclare
 *   ۲) یک stub دوبار تعریف شده → Cannot redeclare
 *   ۳) `add_menu_page()` اصلاً stub نداشت → Call to undefined function
 *
 * هر سه‌تا را می‌شد **پیش از اجرا** و بدون هیچ حدسی پیدا کرد. مورد سوم
 * بدترینشان است، چون فقط وقتی دیده می‌شود که مسیر اجرا دقیقاً از آن خط
 * رد شود — یعنی یک تابع stub‌نشده می‌تواند ماه‌ها پنهان بماند و درست
 * وسط یک آزمون مهم بیرون بزند.
 *
 * این اسکریپت به‌جای انتظار برای رسیدن اجرا به آن خط، **متن** افزونه را
 * می‌خواند: هر چیزی که صدا زده می‌شود ولی نه تابع PHP است، نه تابع خود
 * افزونه، و نه stub دارد → یک شکست آینده که همین حالا نامش را می‌دانیم.
 *
 * اجرا:  php wordpress-plugin/check-stub-coverage.php
 */

$plugin_dir = __DIR__ . '/crane-yadak-headless';
$harness     = __DIR__ . '/wp-stub-harness.php';

/** کامنت‌ها و رشته‌ها را خنثی می‌کند تا متن داخلشان «کال» شمرده نشود. */
function cyh_blank( $src ) {
	$src = preg_replace( '#/\*[\s\S]*?\*/#', '', $src );
	$src = preg_replace( '#//[^\n]*#', '', $src );
	$src = preg_replace( '/"(?:[^"\\\\]|\\\\.)*"/', '""', $src );
	$src = preg_replace( "/'(?:[^'\\\\]|\\\\.)*'/", "''", $src );
	return $src;
}

// ── چه چیزی هارنس فراهم می‌کند ──────────────────────────────────────────
$provided = [];
$hsrc     = file_get_contents( $harness );
preg_match_all( '/^function\s+([a-zA-Z_]\w*)\s*\(/m', $hsrc, $hm );
foreach ( $hm[1] as $n ) {
	$provided[ strtolower( $n ) ] = true;
}
preg_match_all( '/^(?:final\s+|abstract\s+)?class\s+([A-Za-z_]\w*)/m', $hsrc, $hc );
foreach ( $hc[1] as $n ) {
	$provided[ strtolower( $n ) ] = true;
}

// ── افزونه چه چیزی تعریف و چه چیزی صدا می‌زند ────────────────────────────
$defined = [];
$called  = [];

$plugin_files = [];
$it = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $plugin_dir ) );
foreach ( $it as $f ) {
	if ( ! $f->isFile() || 'php' !== strtolower( $f->getExtension() ) ) {
		continue;
	}
	$plugin_files[] = $f->getPathname();
	$src = cyh_blank( file_get_contents( $f->getPathname() ) );

	preg_match_all( '/function\s+([a-zA-Z_]\w*)\s*\(/', $src, $dm );
	foreach ( $dm[1] as $n ) {
		$defined[ strtolower( $n ) ] = true;
	}

	// `->foo(` و `::foo(` و `$foo(` کال تابع سراسری نیستند.
	preg_match_all( '/(?<![>$:\w])([a-zA-Z_]\w*)\s*\(/', $src, $cm, PREG_OFFSET_CAPTURE );
	foreach ( $cm[1] as list( $n, $off ) ) {
		$key = strtolower( $n );
		if ( ! isset( $called[ $key ] ) ) {
			$called[ $key ] = $f->getFilename() . ':' . ( substr_count( $src, "\n", 0, $off ) + 1 );
		}
	}
}

// ساختارهای زبانی که شبیه تابع‌اند ولی نیستند.
$keywords = array_flip( [
	'if', 'elseif', 'else', 'for', 'foreach', 'while', 'switch', 'match', 'catch', 'fn', 'function',
	'return', 'echo', 'print', 'array', 'list', 'isset', 'unset', 'empty', 'exit', 'die', 'new',
	'use', 'and', 'or', 'xor', 'clone', 'yield', 'include', 'require', 'include_once', 'require_once',
	'static', 'global', 'declare', 'try', 'do', 'instanceof', 'endif', 'endforeach', 'endwhile', 'int', 'string', 'bool', 'float',
] );

$missing = [];
foreach ( $called as $name => $where ) {
	if ( isset( $keywords[ $name ] ) || isset( $defined[ $name ] ) || isset( $provided[ $name ] ) ) {
		continue;
	}
	// ✅ اینجاست که PHP کار را قطعی می‌کند: اگر خودش این تابع را دارد،
	//    stub لازم نیست. حدس زدن دربارهٔ «کدام نام مال PHP است» ممنوع.
	if ( function_exists( $name ) || class_exists( $name ) ) {
		continue;
	}
	$missing[ $name ] = $where;
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * متدها — نقطه‌ی کوری که این بررسی داشت
 * ═══════════════════════════════════════════════════════════════════════════
 * نسخه‌ی قبل فقط دنبال *تابع* می‌گشت. هارنس سه بار پشت سر هم روی
 * `Call to undefined method` مرد و این بررسی هر بار سبز بود — یعنی دقیقاً
 * همان اطمینان کاذبی که قرار بود از بین ببرد.
 *
 * چهار متد غایب پیدا شد و فقط یکی‌شان خودش را نشان داده بود:
 *   • WP_REST_Request::get_file_params  ← هارنس روی این مرد
 *   • WP_Error::get_error_message       ← فقط روی مسیر خطا صدا زده می‌شود
 *   • $wpdb->update                     ← فقط وقتی اسلاگ تکراری باشد
 *   • $role->add_cap                    ← فقط هنگام فعال‌سازی افزونه
 *
 * سه‌تای آخر «fatal خفته» بودند: مسیرهایی که تست به‌ندرت به آن‌ها می‌رسد و
 * کاربر واقعی حتماً می‌رسد.
 */
preg_match_all( '/^\s*(?:final\s+|abstract\s+)?class\s+(\w+)[^{]*\{/m', $hsrc, $cm, PREG_OFFSET_CAPTURE );

$methods = [];
foreach ( $cm[0] as $i => $hit ) {
	$start = $hit[1] + strlen( $hit[0] );
	$depth = 1;
	$j     = $start;
	$len   = strlen( $hsrc );
	while ( $j < $len && $depth > 0 ) {
		if ( '{' === $hsrc[ $j ] ) { $depth++; }
		elseif ( '}' === $hsrc[ $j ] ) { $depth--; }
		$j++;
	}
	preg_match_all( '/function\s+(\w+)/', substr( $hsrc, $start, $j - $start ), $mm );
	foreach ( $mm[1] as $name ) {
		$methods[ strtolower( $name ) ] = $cm[1][ $i ][0];
	}
}

// متدهایی که خودِ افزونه روی کلاس‌های خودش تعریف می‌کند هم مجازند.
preg_match_all( '/function\s+(\w+)\s*\(/', implode( "\n", array_map( 'cyh_blank', array_map( 'file_get_contents', $plugin_files ?? [] ) ) ), $own );

$missing_methods = [];
foreach ( $plugin_files ?? [] as $f ) {
	$src   = cyh_blank( file_get_contents( $f ) );
	$lines = explode( "\n", $src );
	foreach ( $lines as $n => $line ) {
		if ( ! preg_match_all( '/->\s*(\w+)\s*\(/', $line, $calls ) ) {
			continue;
		}
		foreach ( $calls[1] as $name ) {
			$key = strtolower( $name );
			if ( isset( $methods[ $key ] ) || isset( $defined[ $key ] ) ) {
				continue;
			}
			$missing_methods[ $name ] ??= basename( $f ) . ':' . ( $n + 1 );
		}
	}
}

if ( $missing_methods ) {
	ksort( $missing_methods );
	fwrite( STDERR, '❌ ' . count( $missing_methods ) . " متد بدون stub — هارنس روی این‌ها می‌افتد:\n\n" );
	foreach ( $missing_methods as $name => $where ) {
		fwrite( STDERR, sprintf( "   • ->%-30s %s\n", $name . '()', $where ) );
	}
	fwrite( STDERR, "\n   متد را به کلاس مربوطه در wp-stub-harness.php اضافه کنید.\n" );
	exit( 1 );
}

if ( $missing ) {
	ksort( $missing );
	fwrite( STDERR, '❌ ' . count( $missing ) . " تابع بدون stub — هارنس دیر یا زود روی این‌ها می‌افتد:\n\n" );
	foreach ( $missing as $name => $where ) {
		fwrite( STDERR, sprintf( "   • %-34s %s\n", $name . '()', $where ) );
	}
	fwrite( STDERR, "\n   هرکدام را در wp-stub-harness.php اضافه کنید.\n" );
	exit( 1 );
}

printf( "✅ هر تابع و متدی که افزونه صدا می‌زند stub دارد (%d کال، %d متد کلاس).\n", count( $called ), count( $methods ) );
