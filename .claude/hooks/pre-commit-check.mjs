#!/usr/bin/env node
// .claude/hooks/pre-commit-check.mjs — PreToolUse (matcher: Bash)
// قبل از `git commit`، `npm run check` (و اگر افزونه تغییر کرده `npm run check:plugin`) را اجرا
// می‌کند؛ شکست = exit 2 = کامیت انجام نمی‌شود. ورودی: JSON هوک روی stdin.
// اضطراری: SKIP_PRECOMMIT_CHECK=1 git commit … (در خودِ دستور، پس در گفتگو دیده می‌شود).
// آزمون: CYH_HOOK_CHECK_CMD / CYH_HOOK_PLUGIN_CMD دستورها را جایگزین می‌کنند.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { isGitCommit, hasSkipFlag } from './hook-logic.mjs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0); // ورودی ناخوانا = مسدود نکن؛ هوک ابزار امنیتی نیست، مانع اشتباه است
}
const command = String(input?.tool_input?.command ?? '');
if (input?.tool_name !== 'Bash' || !isGitCommit(command)) process.exit(0);
if (hasSkipFlag(command)) {
  console.error('⚠️ SKIP_PRECOMMIT_CHECK=1 — بررسی پیش از کامیت عمداً رد شد.');
  process.exit(0);
}

const cwd = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const run = (cmd) => spawnSync(cmd, { cwd, shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const steps = [['npm run check', process.env.CYH_HOOK_CHECK_CMD || 'npm run check']];
const changedPlugin = (process.env.CYH_HOOK_PLUGIN_CHANGED ?? run('git status --porcelain -- wordpress-plugin').stdout ?? '').trim() !== '';
if (changedPlugin) steps.push(['npm run check:plugin', process.env.CYH_HOOK_PLUGIN_CMD || 'npm run check:plugin']);

for (const [label, cmd] of steps) {
  const r = run(cmd);
  if (r.status !== 0) {
    const tail = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.trim().split('\n').slice(-25).join('\n');
    console.error(`⛔ کامیت مسدود شد: «${label}» قرمز است (کد ${r.status}). اول اصلاحش کنید.\n${tail}`);
    process.exit(2);
  }
}
process.exit(0);
