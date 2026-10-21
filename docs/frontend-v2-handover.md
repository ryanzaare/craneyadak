# Frontend v2 — implementation handover (Phase 0 and Phase 1)

Paste the block below as the first message of the new Claude Code session, opened in this repository.

```text
You are implementing Frontend v2 of craneyadak.com (Persian RTL, B2B crane spare parts; static Astro + headless WordPress).
The plan is approved. Your job now: Phase 0, then Phase 1. Nothing else.

READ FIRST, IN THIS ORDER (do not skip):
1. CLAUDE.md                      — project rules (SEO first, never invent data, no dealer claims, autonomous testing, no WooCommerce)
2. docs/backlog.md                — open items; record every decision and leftover there before you finish
3. docs/frontend-v2.md            — the approved plan: buyers, B2B UX principles, verified findings (§4b), visual language (§5),
                                     performance budget (§6), the contract you must not break (§7), phases (§8), client decisions (§10)
4. docs/frontend-v2-handover.md   — this file

WORKSPACE (before touching any UI file):
- Create a dedicated branch and worktree:  git worktree add ../craneyadak-frontend-v2 -b frontend-v2
- Work only inside that worktree. Never commit to main, never merge, never deploy. The client merges after approving screenshots.
- You may push the branch `frontend-v2` for review. Commit messages in Persian, explaining *why*.
- An auditor (Gemini) checks every commit and every claim against the files on disk. Never report a result you did not see.

TOOLING AND DESIGN DISCIPLINE:
- Load the `frontend-design` skill before designing (if available in the session).
- Strict type scale (12/14/16/20/24/32/40), weights 400/700/900 only, 8px spacing grid, RTL logical properties.
- Measure only on the production build: `npm run build && npm run preview` (read the port from the output). Never on `astro dev`.
- Automated viewport screenshots of the production build at 390×812, 768×1024 and 1280×800, BEFORE you change a page and AFTER,
  for every page you touch (home, a category page, the product page /products/saga-saga1-l12/, the style guide). Use Playwright or
  puppeteer-core with the locally installed Chrome; save under .astro/screens/<phase>/<before|after>/ (not committed) and show them to
  the client at the end of each phase.

PHASE 0 — foundations (done = client approves the style guide):
1. Tokens in src/styles/global.css only (single source). Orange (`accent`) only for primary actions, focus and active states;
   `accent-ink` for orange text and links on light surfaces.
2. Type scale; self-hosted monospace subset for part codes (Latin letters, digits, - / . _ ; ≤ 20 KB woff2, font-display: optional).
3. Radius and border rules: 4px for chips and tables, 6–8px for cards, buttons and inputs; 1px `steel-300` hairlines instead of
   heavy shadows. Remove every `rounded-2xl` / `rounded-3xl`.
4. Migrate every legacy `gray-*` and `crane-*` class to `steel-*` / `accent*` (about 537 occurrences in src/ at hand-over).
5. NEW BUILD GUARD scripts/check-design-tokens.mjs wired into `npm run check`: fails on any `gray-*`, `crane-*`, `rounded-2xl` or
   `rounded-3xl` in src/. Write its unit test with known-bad input first (it must go red), then green it by the migration.
6. A `noindex` style-guide page showing every component of §5 (part-code chip with copy, stock pill, price block with validity,
   spec table, two-tab container, list/table product row with quick add, buy box with one primary action, bottom action bar,
   honest empty state).

PHASE 1 — product page + header search (done = criteria below, client approves screenshots):
1. Mobile order (docs/frontend-v2.md §4): one-line breadcrumb → compact identity header (name ≤ 2 lines, monospace part code with
   copy, brand, authenticity + stock pills) → gallery with capped height (≈ 4:3) in a neutral `steel-50`/white frame, fixed aspect
   ratio → stock + price block + ONE primary action, secondary actions as text links → key spec chips → fitment → warranty (once).
2. Exactly two tabs: «مشخصات فنی» and «محصولات مرتبط/سازگار». No empty third tab.
3. Inquiry-priced («استعلامی») items: primary action = WhatsApp link with a pre-filled message containing the exact product name
   and SKU (name + page URL when there is no SKU); «+ استعلام» quote basket stays as the secondary action. Number from WordPress
   site options (`whatsappHref` in src/lib/site-options.ts), never hard-coded.
4. One trust strip only (verified items from src/data/trust.ts); remove the triple repetition in the buy box.
5. Bottom action bar visible on load whenever the primary button is off-screen; merged with the site-wide contact bar on this page.
6. Header search on every page, mobile included.
Done when: code, image, price and primary action are all inside the first 390×812 screen; no block is repeated; screenshots at the
three viewports, before and after.

NON-NEGOTIABLE GATES (every commit on the branch):
- `npm run check`, `npm run build` (includes check:plugin and the post-build audits) and `npm run lighthouse` all green.
- Lighthouse on mobile AND desktop: performance ≥ 0.90, SEO ≥ 0.95 on indexable pages (thresholds in lighthouserc.json; do not
  lower them), accessibility ≥ 0.90, CLS ≤ 0.05.
- Do not change src/lib/** logic, the WordPress plugin, JSON-LD output, canonical/trailing-slash/301 rules, the automatic noindex
  rules, or the data-* attributes and IDs that scripts read (docs/frontend-v2.md §7). If a design needs one of these changed, stop
  and ask the client.
- Never invent a claim, number, delivery time, stock state or specification (CLAUDE.md rule 2). Uncertain → 🔶 and ask.

END OF EACH PHASE: update docs/backlog.md (what was done, what was deferred, what was not tested), commit, push the branch, show the
screenshots, list numbered steps for the client.
```

## Why each gate exists (for the reviewer)

| Gate | Reason |
|---|---|
| Worktree + branch, no merge | The live site deploys from `main`; a half-finished redesign must never reach it |
| Screenshots on the production build | `astro dev` serves unbundled modules; its layout and timings differ from production (CLAUDE.md) |
| Design-token guard with a failing test first | Every guard in this project that was not tested on bad input turned out blind at least once (rule 6) |
| Lighthouse thresholds unchanged | The gate before every upload; SEO is priority one |
| Contract of §7 | SEO output and the commerce logic already work and are covered by tests; the redesign is a presentation layer |
