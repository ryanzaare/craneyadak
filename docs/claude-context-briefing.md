# Claude Context Briefing — Crane Yadak

This file exists so any Claude session (this chat, the Cowork Project, or a future one) can catch up instantly without re-deriving everything from scratch. Read this first. It's a snapshot as of the audit conversation on 2026-08-07 — update it as facts change.

Related, always-loaded context: the `craneyadak-project-state`, `seo-audit-checklist`, and `principal-review-loop` skills (saved to the user's account, available in every session/project automatically). This file has more narrative detail and history than those skills carry; the skills are the enforced standards, this file is the "how we got here."

## Goal
#1 Google ranking for crane spare parts search terms (B2B, Persian/RTL, Iran market), maximum site speed. User has full authority to change/rebuild anything needed to hit that goal — but the recommendation on record is to evolve the existing Astro + headless WordPress foundation, not rewrite from scratch (see "Decisions" below).

## Two local folders — what each one is
- **`crane yadak`** (173MB, includes `node_modules`) — the version currently live on GitHub (`github.com/ryanzaare/craneyadak`). Astro frontend only, no backend. Confirmed bugs: `public/` is missing the fonts/OG-image/logo/manifest assets that `Layout.astro` references (real 404s in production), and `categories/[slug].astro` + `brands/[slug].astro` inject a hardcoded `mockProducts` array (fake names/SKUs) directly into Product/ItemList JSON-LD.
- **`craneyadak 5`** (2MB, no `node_modules` — normal, just needs `npm install`) — WIP version built by a prior Claude session on a different device/account. Fixes the missing-asset problem (fonts/OG image/logo/manifest all present and correctly wired). Adds a complete headless WordPress plugin at `wordpress-plugin/crane-yadak-headless/` (custom post types, ACF Pro field groups as local JSON, rate-limited REST contact endpoint, CORS). Still has the same `mockProducts` fake-data problem — **top priority fix, since this may already be indexed on the live site**. Also has a known, self-documented issue: `src/pages/api/contact.ts` is a static-build-incompatible placeholder (Astro `output: 'static'`, no server adapter, so this route is stripped in production builds) — comment in the file and `docs/backend-integration.md` §6 both flag it and prescribe the fix (client-side `fetch()` to a WP REST/GraphQL mutation, not a server adapter).

## Git state — the actual reason pushes weren't working
`craneyadak 5/.git` is a real clone of the GitHub repo with `origin` correctly configured, but `.git/logs/HEAD` shows only the initial clone entry — zero commits were ever made here, so there was never anything to push. There's also an active `.git/index.lock` plus stale `.old`/`.old2`/`.old3` lock files, which will block every git command until removed. Not a GitHub auth problem. Fix sequence when we resume: remove the lock file(s) → confirm `git status` runs clean → stage/commit/push normally.

## Gemini's audit — verified against the actual code
A second AI (Gemini) audited `craneyadak 5` and raised 4 points. Verified findings:
1. **Mock/fake product data in JSON-LD — TRUE**, and worse than reported: present in *both* folders, including the live GitHub version. Highest-priority fix on the whole project.
2. **Missing assets causing 404s — FALSE for craneyadak 5** (assets all exist there and are wired correctly) — **TRUE for the live `crane yadak` folder**, which Gemini likely conflated or was pointed at instead.
3. **Frontend disconnected from the WP backend — TRUE**, but it's a deliberate, fully documented staging decision (see `docs/backend-integration.md`), not an oversight — the plugin and migration path both already exist, they just haven't been wired together yet.
4. **`api/contact.ts` breaks in production build — TRUE**, but already flagged in-code and in docs as a known placeholder, not hidden debt.

## Decisions made in this conversation
- **Keep headless WordPress (ACF Pro + WPGraphQL)** as the backend. Do not switch to Django or any custom backend. Reasoning: Astro fetches from WPGraphQL only at *build time* (`getStaticPaths()`), so there's zero runtime backend dependency for visitors — full CMS convenience for content editors with no runtime performance cost. Confirmed relevant facts: user already has ACF Pro + WPGraphQL installed and active, hosting already exists, and content will be managed by the user **plus other non-technical people** — which is why a real CMS admin UI is required (ruled out a git-based/no-CMS content approach).
- **Don't rewrite the site from scratch.** The existing architecture (static Astro output, sitemap, JSON-LD scaffolding, mobile-network-aware prefetch tuning, breadcrumb/internal-linking patterns) is genuinely solid. The real gaps are missing real data and unfinished wiring, not bad architecture.
- **Non-negotiable rule going forward:** never inject fake/placeholder product data, prices, ratings, or reviews into structured data or visible content. Missing real data is always better than fake data.

## Known placeholders to replace with real values before launch
Phone (`021-12345678`), address, and eNamad trust badge (pending real registration per `docs/backend-integration.md`).

## Not yet done (open items for when implementation starts)
- Fix git lock files, get first real commit + push working.
- Replace all mock product data with real data (likely via a spreadsheet import into WP once populated — `xlsx` skill is earmarked for this).
- Wire up WPGraphQL fetches in `getStaticPaths()` for categories/brands/products, replacing `src/data/site.ts` and `src/data/content.ts` mock sources per the mapping in `docs/backend-integration.md`.
- Fix the contact form (client-side fetch to WP REST endpoint, remove the dead static API route).
- Real keyword research and competitor analysis — not done yet, needed before finalizing page titles/copy.
- Confirm deploy pipeline / rebuild webhook (WP publish → static rebuild) once hosting details are provided.
- Decide when to retire/archive the old `crane yadak` folder once `craneyadak 5` is verified as the source of truth.
- Full SEO pass against the `seo-audit-checklist` skill, page by page, using the `principal-review-loop` process (SEO loop + debugging loop, both to 100 or an honestly-reported blocker).

## Standing process
Every file written or edited on this project should go through the `principal-review-loop` skill before being called done, using `seo-audit-checklist` as the SEO scoring rubric.
