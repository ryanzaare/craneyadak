#!/usr/bin/env node
// scripts/plugin-release.mjs <نسخه>   مثال: node scripts/plugin-release.mjs 3.25.0
// ---------------------------------------------------------------------------
// بخش مکانیکی انتشار افزونه (فرمان /plugin-release بقیه را انجام می‌دهد): شماره‌ی نسخه را در
// هدر و ثابت CYH_VERSION عوض می‌کند، zip تازه می‌سازد، zipهای قبلی را پاک می‌کند (قاعده‌ی ۴
// CLAUDE.md) و محتوای zip را با پوشه‌ی منبع `diff -r` می‌کند.
// ⚠️ تست‌ها را اجرا نمی‌کند و چیزی گزارش «آزموده‌شده» نمی‌کند؛ آن‌ها با فرمان است.
// ---------------------------------------------------------------------------
import { readFileSync, writeFileSync, readdirSync, rmSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const parseVersion = (v) => {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};
export const isNewer = (a, b) => {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};
/** هدر و ثابت باید *هر دو* عوض شوند؛ اگر هرکدام پیدا نشد null (به‌جای نسخه‌ی نیمه‌کاره). */
export function bumpSource(src, next) {
  const header = /^(\s*\*\s*Version:\s+)(\d+\.\d+\.\d+)/m;
  const constant = /(define\(\s*'CYH_VERSION',\s*')(\d+\.\d+\.\d+)('\s*\))/;
  const h = header.exec(src), c = constant.exec(src);
  if (!h || !c || h[2] !== c[2]) return null;
  return { current: h[2], out: src.replace(header, `$1${next}`).replace(constant, `$1${next}$3`) };
}

function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} → ${r.stderr || r.stdout}`);
  return r.stdout;
}

function main() {
  const next = process.argv[2];
  if (!parseVersion(next)) {
    console.error('❌ نسخه به شکل N.N.N لازم است. مثال: node scripts/plugin-release.mjs 3.25.0');
    process.exit(1);
  }
  const plugin = 'wordpress-plugin';
  const mainFile = `${plugin}/crane-yadak-headless/crane-yadak-headless.php`;
  const bumped = bumpSource(readFileSync(mainFile, 'utf8'), next);
  if (!bumped) {
    console.error('❌ هدر Version و ثابت CYH_VERSION پیدا نشد یا با هم فرق دارند — دستی بررسی کنید.');
    process.exit(1);
  }
  if (!isNewer(next, bumped.current)) {
    console.error(`❌ نسخه‌ی ${next} باید از نسخه‌ی فعلی (${bumped.current}) بزرگ‌تر باشد.`);
    process.exit(1);
  }
  writeFileSync(mainFile, bumped.out);

  const zip = `crane-yadak-headless-${next}.zip`;
  for (const f of readdirSync(plugin)) if (/^crane-yadak-headless-.*\.zip$/.test(f)) rmSync(path.join(plugin, f));
  sh('zip', ['-qr', zip, 'crane-yadak-headless', '-x', '*.DS_Store'], plugin);

  const tmp = mkdtempSync(path.join(tmpdir(), 'cyh-zip-'));
  try {
    sh('unzip', ['-q', path.join(plugin, zip), '-d', tmp], '.');
    const d = spawnSync('diff', ['-r', path.join(tmp, 'crane-yadak-headless'), path.join(plugin, 'crane-yadak-headless')], { encoding: 'utf8' });
    if (d.status !== 0) throw new Error(`محتوای zip با منبع یکی نیست:\n${d.stdout}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`✅ ${bumped.current} → ${next}؛ ${plugin}/${zip} ساخته و با منبع یکسان تأیید شد؛ zipهای قبلی حذف شدند.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (e) {
    console.error(`❌ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}
