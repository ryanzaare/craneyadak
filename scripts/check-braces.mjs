// Brace scanner that understands strings, templates (with ${} nesting),
// comments AND regex literals — the thing my naive counter missed.
import { readFileSync } from 'node:fs';
function scan(src) {
  let i = 0, depth = 0, min = 0;
  const n = src.length;
  let prev = ''; // last significant char, to tell regex from division
  while (i < n) {
    const ch = src[i], two = src.slice(i, i + 2);
    if (two === '//') { while (i < n && src[i] !== '\n') i++; continue; }
    if (two === '/*') { i = src.indexOf('*/', i + 2); i = i < 0 ? n : i + 2; continue; }
    if (ch === '"' || ch === "'") {
      const q = ch; i++;
      while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++; prev = 'x'; continue;
    }
    if (ch === '`') {
      i++;
      while (i < n && src[i] !== '`') {
        if (src[i] === '\\') { i += 2; continue; }
        if (src.slice(i, i + 2) === '${') { // nested expression — count its braces
          i += 2; let d = 1;
          while (i < n && d > 0) {
            if (src[i] === '{') d++;
            else if (src[i] === '}') d--;
            else if (src[i] === '`') { // nested template
              i++; while (i < n && src[i] !== '`') { if (src[i] === '\\') i++; i++; }
            }
            i++;
          }
          continue;
        }
        i++;
      }
      i++; prev = 'x'; continue;
    }
    if (ch === '/' && !/[\w)\]]/.test(prev)) { // regex literal
      i++; let inClass = false;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) break;
        else if (src[i] === '\n') break;
        i++;
      }
      i++; while (i < n && /[gimsuy]/.test(src[i])) i++;
      prev = 'x'; continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth < min) min = depth; }
    if (!/\s/.test(ch)) prev = ch;
    i++;
  }
  return { depth, min };
}
for (const f of process.argv.slice(2)) {
  const r = scan(readFileSync(f, 'utf8'));
  const ok = r.depth === 0 && r.min === 0;
  console.log(`  ${ok ? '✅' : '❌'} ${f}  (final depth ${r.depth}, min ${r.min})`);
}
