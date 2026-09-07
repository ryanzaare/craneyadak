# Claude Context Briefing — Crane Yadak

This file exists so any Claude session can catch up instantly without re-deriving
everything. **Read this first.** Last updated: **2026-09-02**, plugin v1.4.0.

Always-loaded context: the `craneyadak-project-state`, `seo-audit-checklist`,
`principal-review-loop`, and `working-agreement` skills. Those are the enforced
standards; this file is the narrative — *how we got here and what hurts.*

> ⚠️ Update this file whenever facts change. Stale documentation in this project
> has caused real time loss. If something here disagrees with the code, **the
> code is right and this file is a bug.**

## Goal

#1 Google ranking for crane spare-part search terms (B2B, Persian/RTL, Iran).
Maximum site speed. The user has full authority to rebuild anything.

## Architecture

Astro static frontend + headless WordPress (ACF Pro + WPGraphQL).
All data fetched at **build time only** — visitors never touch WordPress.
Details: `docs/backend-integration.md`. Taxonomy: `docs/taxonomy-ssot.md`.

**WordPress is the source of truth for the category structure.** `crane_category`
is hierarchical and two-level: no parent = silo, one parent = category. Adding a
category requires zero code. `src/data/taxonomy.generated.ts` is a build artifact
regenerated from WordPress on every build — never edit it by hand.

## Current state

- Frontend builds clean. Lighthouse on production preview: **Perf 99,
  A11y 97, Best Practices 100, SEO 100** (dev-server scores are meaningless).
- Backend plugin v1.4.0 — 4 CPTs (`product`, `brand`, `inquiry`, `cyh_quote`),
  1 taxonomy, 5 ACF groups, 6 REST endpoints.
- **WooCommerce bridge landed.** `product` is shared with Woo: when Woo is
  active we skip our registration and inject GraphQL args onto its. No data
  migration, no frontend rewrite. Price/stock come from `craneCommerce`,
  single-source. Verified in both modes by the stub harness.
- **Catalog is nearly empty**: the user deleted every product except
  `saga1-l12`. This is deliberate — the others were not written to L12 standard.
- Category SEO content written for `crane-coupling` and `rope-guide`, staged in
  `content-imports/category-content-batch-01.md`, not yet entered in WordPress.

## Non-negotiable rules

- **Never fabricate** OEM part numbers, specs, dimensions, tolerances, prices,
  ratings, stock status, delivery times, or business capabilities. Missing real
  data always beats invented data. Anything unverifiable gets flagged 🔶 for CEO
  confirmation, not guessed.
- No `Offer` without a real numeric price. `availability` is never assumed.
- No silent failure on the critical path — a quietly empty catalog deindexes
  real pages and nobody notices.
- Preserve `output: 'static'` and the zero-JS-by-default posture.
- No two ACF groups may share a `graphql_field_name`.

## Mistakes this project has actually made — do not repeat

These are documented because each one cost real time and at least one took the
site down.

1. **Validating where the bug cannot appear.** A Persian regex was tested in
   Python (where `\b` is Unicode-aware, unlike JS). Brand grouping was tested
   with pre-populated values, hiding a default that collapsed all 19 brands.
   *Test in the environment where the failure would occur.*
2. **A checker that reports false results.** An import checker anchored `export`
   to column 0, missed an indented one, and gave a false pass. Later a hook
   linter emitted 25 false positives, burying one real error.
   *A broken verification tool is worse than none.*
3. **Shipping unverifiable code.** Plugin v1.3.0 registered `pre_term_slug` with
   3 required params; WordPress passes 2 → `ArgumentCountError` → **white screen
   on the whole site**. It shipped because there was no PHP binary in the
   sandbox and it was shipped anyway.
   *If it cannot be executed, say so before shipping — not after.*
4. **A test harness that silently tested nothing.** `wp-stub-harness.php` had a
   hardcoded list of 6 files while the plugin had grown to 14, and discarded
   `accepted_args` entirely. It would have passed a plugin it never loaded.
   Now it globs, stubs 103 functions, and checks hook signatures via Reflection.
5. **Bulk edits across many files.** Appending to 9 files' frontmatter created
   TDZ errors; a careless slice truncated `site-options.ts` and destroyed
   `getContact`, breaking 10 files. This is why the taxonomy refactor used a
   build-time generator instead of converting 18 files to async.
6. **Zip built from inside the plugin folder** → no root directory → WordPress
   created a second copy → `Cannot redeclare cyh_activate()`.
   *Always `zip -r file.zip crane-yadak-headless` from the parent.*

## Safety nets that now exist

| Command | Catches |
|---|---|
| `npm run check` | broken/missing imports, duplicate exports, bad WP hook signatures |
| `npm run test:taxonomy` | 24 tests on the taxonomy generator |
| `php wordpress-plugin/wp-stub-harness.php` | real PHP execution of the plugin |
| build-time URL diff | any category URL that changed or disappeared |

## Blocked on real-world input

- **Real NAP**: phone, address, postal code, geo lat/lng.
- **Payment gateway**: needs eNamad + bank merchant account + SMS provider.
- **eNamad badge**, once genuinely issued.
- **Real product photos and specs** for the remaining catalog.
- **Commerce stack decided**: WooCommerce for the `cart` half, Astro stays
  static for catalog and guides. Checkout leaves the static site.

## Open / not started

- Real keyword research and competitor analysis.
- Deploy pipeline / rebuild webhook (WP publish → static rebuild).
- Search Console verification.
- Host-level items code cannot control: security headers, real 404 status,
  HTTP/2-3, cache headers.
- Lighthouse re-measure once the catalog is repopulated with real photos.

## Known unresolved

- ~~Ghost menu «قطعات جرثقیل»~~ — identified as post type `crane-part`,
  registered outside our plugin. Now unregistered by
  `includes/class-legacy-cleanup.php` (hides, never deletes; warns if it holds
  records). Re-enable with `define( 'CYH_KEEP_LEGACY_CRANE_PART', true );`.
