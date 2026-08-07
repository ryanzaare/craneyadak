# Claude Context Briefing — Crane Yadak

This file exists so any Claude session (this chat, the Cowork Project, or a future one) can catch up instantly without re-deriving everything from scratch. Read this first. Last updated: **2026-08-07, after the first implementation pass** — update it as facts change.

Related, always-loaded context: the `craneyadak-project-state`, `seo-audit-checklist`, and `principal-review-loop` skills (saved to the user's account, available in every session/project automatically). This file has more narrative detail and history than those skills carry; the skills are the enforced standards, this file is the "how we got here."

## Goal
#1 Google ranking for crane spare parts search terms (B2B, Persian/RTL, Iran market), maximum site speed. User has full authority to change/rebuild anything needed to hit that goal — but the recommendation on record is to evolve the existing Astro + headless WordPress foundation, not rewrite from scratch (see "Decisions" below).

## Two local folders — what each one is
- **`crane yadak`** (173MB, includes `node_modules`) — the version currently live on GitHub (`github.com/ryanzaare/craneyadak`). Astro frontend only, no backend. Still has the original bugs: missing `public/` assets (fonts/OG image/logo/manifest → real 404s) and hardcoded `mockProducts` fake data in JSON-LD. **Not being worked on** — it is superseded by `craneyadak 5` and should be archived once the new build is verified.
- **`craneyadak 5`** — the source of truth. Astro frontend + a complete headless WordPress plugin at `wordpress-plugin/crane-yadak-headless/`. As of 2026-08-07 this folder has had its first real commit (`23ad6e0`) on top of the upstream `0a84ed4`.

## Git state — RESOLVED
The stale `.git/index.lock` (+ `.old`/`.old2`/`.old3` leftovers) that blocked every write command were removed. `git status` runs clean, `git add`/`commit` work, and the first real commit exists locally. It was never a GitHub auth problem. **`git push origin main` still needs to be run by the user from their own machine** (the assistant's sandbox has no outbound network).

## What was fixed in the 2026-08-07 implementation pass
1. **All fabricated data removed** (`mockProducts` in both dynamic templates, the invalid price-less `Offer`, the unfounded `availability: InStock`, `priceRange: '$$$'`, a false FAQ answer about published prices, six datasheet entries with hand-typed sizes pointing at non-existent PDFs, and an unconfirmed "max 2 working hours" SLA).
2. **`src/lib/wp.ts`** — build-time WPGraphQL data layer. Fetches the whole published catalog once per build with pagination, caches it in module scope, filters by category/brand in memory. Deliberately avoids `taxQuery`/`metaQuery` so it needs only WPGraphQL + WPGraphQL for ACF. `WP_GRAPHQL_URL` unset → empty catalog + honest empty state; set but unreachable → the build throws on purpose (no silent empty-catalog deploys).
3. **`src/lib/datasheets.ts`** — a document renders only if its file really exists in `public/`; size/extension read from disk. `/datasheets` is `noindex` and excluded from the sitemap until the first real PDF appears, then both flip back automatically.
4. **`src/components/ProductGrid.astro`** — shared real-product grid + honest empty state (RFQ CTA, phone/WhatsApp/Telegram).
5. **Contact form** — `src/pages/api/contact.ts` deleted (it never existed in a static build, so the no-JS path 404'd and lost leads silently). The form's `action` now points straight at the WP REST endpoint; the script is pure progressive enhancement. With `PUBLIC_WP_API_URL` unset the form is not rendered at all and direct contact channels are shown instead.
6. **robots.txt** rewritten to avoid the Disallow-vs-noindex contradiction; blocks only `/pagefind/`.
7. Footer copyright contrast raised to WCAG AA; category/brand pages gained real internal-linking silos.

## Backend decision (unchanged)
Keep headless WordPress (ACF Pro + WPGraphQL). Astro fetches from WPGraphQL only at *build* time (`getStaticPaths()`), so there is zero runtime backend dependency for visitors — full CMS convenience with no runtime performance cost. Content will be managed by the user **plus other non-technical people**, which is why a real CMS admin UI is required (this ruled out a git-based/no-CMS approach).

## Non-negotiable rules
- Never inject fake/placeholder product data, prices, ratings, reviews, file sizes, or SLAs into structured data or visible content. Missing real data is always better than fake data.
- Preserve Astro's static output and zero-JS-by-default posture — no server adapter or client-heavy framework without a specific justification.
- Every page/template goes through `principal-review-loop`, scored against `seo-audit-checklist`.

## Blocked on real-world input from the user
- **Real NAP data**: phone (`021-12345678` is a placeholder), street address, postal code, and `geo` lat/lng in `src/data/site.ts`. Currently the only remaining placeholders in the codebase.
- **WordPress endpoint URLs** for `.env` (`WP_GRAPHQL_URL`, `PUBLIC_WP_API_URL`).
- **Real product data** in WordPress (CPT `product` + `crane_category` terms matching the existing slugs, so no 301 map is needed).
- **Real PDFs** in `public/pdfs/` if the datasheet hub is to be published.
- **eNamad** trust badge, once genuinely issued.
- **Confirmed response-time SLA**, if the business wants to state one.
- **`npm install && npm run build`** on a machine with npm access — the assistant's sandbox has no registry access, so the full Astro build has not been executed yet.

## Still open (not started)
- Real keyword research and competitor analysis — needed before finalizing page titles/copy.
- Deploy pipeline / rebuild webhook (WP publish → static rebuild).
- Search Console verification + monitoring.
- Host-level items the code cannot control: security headers (CSP, X-Content-Type-Options), 404 status code for `/404.html`, HTTP/2-3, cache headers.
- Retire/archive the old `crane yadak` folder once `craneyadak 5` is verified live.
