// .claude/hooks/hooks.test.mjs — node .claude/hooks/hooks.test.mjs
// ورودی خراب شناخته‌شده عمداً هست: هوکی که «سبز» شود در حالی که مانع نیست، بدتر از نبودنش است.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isGitCommit, hasSkipFlag, protectedReason } from './hook-logic.mjs';

let failed = 0;
const t = (name, ok, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${ok ? '' : `  → ${extra}`}`);
  if (!ok) failed++;
};
const dir = fileURLToPath(new URL('.', import.meta.url));
const hook = (script, input, env = {}) =>
  spawnSync('node', [`${dir}${script}`], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...env } });

console.log('── isGitCommit / hasSkipFlag');
for (const c of ['git commit -m x', 'git add -A && git commit -m "x"', 'cd a; git commit', 'git -c user.name=a commit -m x', 'git commit --amend'])
  t(`commit: ${c}`, isGitCommit(c));
for (const c of ['git status', 'git log --oneline', 'git commit-tree abc', 'npm run check', 'git diff --stat'])
  t(`نه: ${c}`, !isGitCommit(c));
t('SKIP flag', hasSkipFlag('SKIP_PRECOMMIT_CHECK=1 git commit -m x'));
t('بدون SKIP flag', !hasSkipFlag('git commit -m "SKIP_PRECOMMIT_CHECK=0"'));

console.log('── protectedReason');
const R = '/proj';
for (const f of ['src/data/taxonomy.generated.ts', '/proj/src/data/taxonomy.generated.ts', 'dist/index.html', '/proj/dist/x/y.html', 'public/_redirects', '.env', '/proj/.env.local', '.git/config'])
  t(`مسدود: ${f}`, protectedReason(f, R) !== null);
for (const f of ['src/data/taxonomy.ts', 'src/pages/index.astro', '.env.example', 'distribution/x.md', 'docs/backlog.md', 'public/robots.txt', 'scripts/generate-htaccess.mjs'])
  t(`مجاز: ${f}`, protectedReason(f, R) === null, protectedReason(f, R) ?? '');

console.log('── هوک pre-commit (اجرای واقعی)');
const commit = { tool_name: 'Bash', tool_input: { command: 'git add -A && git commit -m x' } };
let r = hook('pre-commit-check.mjs', commit, { CYH_HOOK_CHECK_CMD: 'exit 1', CYH_HOOK_PLUGIN_CHANGED: '' });
t('check قرمز → exit 2 و پیام', r.status === 2 && r.stderr.includes('کامیت مسدود شد'), `${r.status} ${r.stderr}`);
r = hook('pre-commit-check.mjs', commit, { CYH_HOOK_CHECK_CMD: 'exit 0', CYH_HOOK_PLUGIN_CHANGED: '' });
t('check سبز → exit 0', r.status === 0, `${r.status} ${r.stderr}`);
r = hook('pre-commit-check.mjs', commit, { CYH_HOOK_CHECK_CMD: 'exit 0', CYH_HOOK_PLUGIN_CHANGED: 'M wordpress-plugin/x', CYH_HOOK_PLUGIN_CMD: 'exit 1' });
t('افزونه تغییر کرده و check:plugin قرمز → exit 2', r.status === 2 && r.stderr.includes('check:plugin'), `${r.status} ${r.stderr}`);
r = hook('pre-commit-check.mjs', commit, { CYH_HOOK_CHECK_CMD: 'exit 0', CYH_HOOK_PLUGIN_CHANGED: '', CYH_HOOK_PLUGIN_CMD: 'exit 1' });
t('افزونه دست‌نخورده → check:plugin اجرا نمی‌شود', r.status === 0, `${r.status}`);
r = hook('pre-commit-check.mjs', { tool_name: 'Bash', tool_input: { command: 'git status' } }, { CYH_HOOK_CHECK_CMD: 'exit 1' });
t('دستور غیرکامیت دست‌نخورده', r.status === 0, `${r.status}`);
r = hook('pre-commit-check.mjs', { tool_name: 'Bash', tool_input: { command: 'SKIP_PRECOMMIT_CHECK=1 git commit -m x' } }, { CYH_HOOK_CHECK_CMD: 'exit 1' });
t('SKIP_PRECOMMIT_CHECK=1 عبور می‌دهد و هشدار می‌دهد', r.status === 0 && r.stderr.includes('رد شد'), `${r.status}`);
r = spawnSync('node', [`${dir}pre-commit-check.mjs`], { input: 'not json', encoding: 'utf8' });
t('ورودی خراب = مسدود نمی‌کند', r.status === 0, `${r.status}`);

console.log('── هوک protect-files (اجرای واقعی)');
r = hook('protect-files.mjs', { tool_name: 'Edit', tool_input: { file_path: '/proj/dist/index.html' } }, { CLAUDE_PROJECT_DIR: '/proj' });
t('dist → exit 2', r.status === 2 && r.stderr.includes('مسدود شد'), `${r.status}`);
r = hook('protect-files.mjs', { tool_name: 'Write', tool_input: { file_path: '/proj/src/pages/index.astro' } }, { CLAUDE_PROJECT_DIR: '/proj' });
t('فایل عادی → exit 0', r.status === 0, `${r.status}`);
r = hook('protect-files.mjs', { tool_name: 'Edit', tool_input: {} }, { CLAUDE_PROJECT_DIR: '/proj' });
t('بدون مسیر → exit 0', r.status === 0, `${r.status}`);

if (failed) {
  console.error(`\n❌ ${failed} مورد ناموفق`);
  process.exit(1);
}
console.log('\nهمه‌ی آزمون‌های هوک گذشت.');
