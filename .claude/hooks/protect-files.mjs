#!/usr/bin/env node
// .claude/hooks/protect-files.mjs — PreToolUse (matcher: Edit|Write|NotebookEdit)
// ویرایش فایل‌های تولیدی/مرده را مسدود می‌کند (exit 2). منطق: hook-logic.mjs.
// ⚠️ محدودیت: فقط ابزارهای Edit/Write را می‌بیند؛ `sed -i` یا `>` در Bash را نه.
import { readFileSync } from 'node:fs';
import { protectedReason } from './hook-logic.mjs';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}
const target = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path ?? '';
const reason = target ? protectedReason(target, process.env.CLAUDE_PROJECT_DIR || input.cwd || '') : null;
if (reason) {
  console.error(`⛔ ویرایش مسدود شد (${target}): ${reason}`);
  process.exit(2);
}
process.exit(0);
