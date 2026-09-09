---
name: "seo-audit-checklist"
description: "Comprehensive technical, on-page, structured-data, performance, cannibalization, and E-E-A-T SEO checklist covering major and minor ranking-relevant parameters. Use whenever writing, reviewing, auditing, or shipping any change to page templates, meta tags, schema markup, Core Web Vitals, internal linking, site architecture, or any public-facing page — especially for the Crane Yadak (craneyadak.com) Astro + headless WordPress project, but applicable to any SEO-sensitive site."
---

## SEO Master Checklist (Principal-level standard)

This is the standing checklist to run against every page, template, and content change on a site where the explicit goal is #1 ranking. Do not cherry-pick — check every relevant category below. Items marked (RTL/FA) apply specifically to Persian/RTL sites like Crane Yadak.

### 1. Crawlability & Indexing
- robots.txt exists, has no accidental `Disallow: /`, and correctly disallows only non-indexable paths.
- Never `Disallow` a path you also want de-indexed via `noindex` — a blocked path is never crawled, so the `noindex` is never seen. Pick one mechanism per URL.
- XML sitemap auto-generated on build, only includes indexable canonical URLs, referenced in robots.txt, submitted in Search Console.
- Every indexable page has a self-referencing canonical tag.
- No duplicate content across near-identical URLs (trailing slash, http/https, www/non-www — pick one canonical form and 301 the rest).
- No orphan pages (every real page reachable via internal links, not just the sitemap).
- 404s return real 404 status codes, not soft-404s. Note: static hosts often serve `/404.html` with a 200 — verify at the host level.
- Redirects use 301 for anything permanent. No redirect chains.
- hreflang correct if multiple languages exist; x-default set.
- Crawl budget sanity: pagination/faceted navigation must not explode the crawlable URL count with near-duplicates.

### 2. Keyword Cannibalization & Intent Mapping
**This is the most commonly missed category and the most damaging at scale. Check it on every new page or template.**
- **One page = one primary search intent.** Maintain an explicit keyword→URL map; every target keyword must have exactly one owning page.
- **Cannibalization is two pages competing for the same query — it is NOT caused by internal linking.** Linking to 8 of 27 categories from the homepage does not cannibalize anything. Diagnose the actual overlap before "fixing" a non-problem.
- Common real cannibalization patterns to check:
  - **Hub vs homepage**: a `/categories` or `/products` hub targeting the same head term as the homepage. Fix: homepage owns the head term (brand + primary term); the hub targets a navigational/comparative variant, or is deliberately de-emphasized.
  - **Parent vs child category**: in a silo, the parent must target the broader term and children the specific long-tail. If a child page's title/H1 could plausibly rank for the parent's term, they will fight.
  - **Near-synonym categories**: in Persian especially, several colloquial names may map to one intent. Do **not** create separate pages for synonyms — pick one canonical page, make the synonyms alternate labels/content within it, and 301 or avoid creating the others.
  - **Category vs brand pages**: a generic brand page that lists every part type will compete with category pages. Fix: brand pages target "brand + parts" entity queries; category pages target "part type" queries; and the **brand × category intersection** gets its own page for "part type + brand" — the highest-intent commercial query.
  - **Industry vs category pages**: industry pages must target industry-specific requirements (duty class, IP rating, temperature, EX rating), not restate the part catalog.
  - **Blog vs commercial page**: an informational article targeting the same query as a money page. Fix: article targets the question/how-to variant and links to the money page.
- Every programmatically generated page set (brand × category, city × service, etc.) must clear a **thin-content/doorway test**: does this page contain substantive, unique information that exists nowhere else on the site? If it would only exist to capture a keyword permutation, do not generate it. Generate intersection pages **only where real inventory/content exists**.
- Audit method once live: Search Console → Performance → filter by query → check if multiple URLs receive impressions for the same query. Also `site:domain.com "keyword"` to see which pages Google considers relevant.
- Titles and H1s across the site should be checked for near-duplicate phrasing before shipping a new template.

### 3. Core Web Vitals & Performance
- LCP under 2.5s on mobile (real field data, not just lab).
- INP under 200ms. CLS under 0.1 — images/ads/fonts need explicit dimensions reserved.
- Fonts: preloaded, `font-display: swap`, subset, self-hosted.
- Images: modern formats (AVIF/WebP), responsive `srcset`/`sizes`, lazy-loaded below the fold, explicit width/height.
- JS payload minimized; don't hydrate components that don't need interactivity.
- CSS: critical CSS inlined, unused CSS purged — verify in build output.
- No render-blocking resources in `<head>` that aren't essential.
- Caching headers + CDN for static assets (long cache + hashed filenames). HTTP/2 or HTTP/3 enabled.
- Third-party scripts audited — load async/deferred or after interaction.
- **Never report a performance score that hasn't been measured against a live URL.** Architectural reasoning is not a Lighthouse score.

### 4. On-Page / Content SEO
- Unique, keyword-intentional `<title>` per page (~50–60 chars, primary keyword near the front).
- Unique meta description written to earn clicks (~150–160 chars).
- Exactly one `<h1>` per page; real heading hierarchy below it.
- Primary keyword/intent addressed in the first ~100 words of visible content.
- Content genuinely unique and substantive per page — thin or templated-only content will not rank.
- Every meaningful image has descriptive alt text.
- URLs clean, lowercase, hyphenated, keyword-relevant, and stable (don't change slugs without 301s).
- Internal links use descriptive anchor text, not "click here."
- Related-content modules link to real, live pages only.

### 5. Structured Data (Schema.org / JSON-LD)
- Organization or LocalBusiness schema sitewide with accurate NAP.
- Product schema only includes fields that are actually true — never fabricate `price`, `aggregateRating`, `review`, or `availability`. An `Offer` without `price` is invalid.
- BreadcrumbList matches the visible breadcrumb exactly.
- FAQPage only on pages with real, visible FAQ content — and the answers must be factually true, since they ship as structured data.
- WebSite schema with SearchAction; ensure the search URL isn't blocked in robots.txt.
- Article/BlogPosting with correct `datePublished`/`dateModified`.
- Every schema block validated in Rich Results Test before shipping.

### 6. Site Architecture & Internal Linking
- Logical topical siloing. Parent/child relationships explicit and reflected in breadcrumbs, URLs, and internal links.
- Reasonable URL depth — important pages reachable within 3 clicks from home.
- Internal linking intentionally flows authority toward priority pages (money pages get more internal links than utility pages).
- Hub pages exist for each silo and link to every child; children link back to the parent.
- Faceted/filtered URLs noindexed or canonicalized.
- **Ask of every hub/listing page: does this page have real search demand, or is it purely navigational?** Navigational hubs are worth keeping for crawl and UX but should not be optimized as if they were landing pages, and should not be allowed to compete with the pages they link to.

### 7. Mobile & UX Signals
- Mobile-first responsive verified on real devices.
- Tap targets ≥44px with adequate spacing.
- Viewport meta correct, no `user-scalable=no`.
- PWA manifest present and valid if applicable.
- Accessibility basics: skip-to-content, visible focus states, sufficient contrast, semantic HTML.
- **Every interactive control must actually work.** A search/filter form whose parameters are ignored by the destination page is a conversion-killing bug and an E-E-A-T signal problem, not a cosmetic issue.

### 8. E-E-A-T (Experience, Expertise, Authoritativeness, Trust)
- Real, verifiable company information (flag placeholders like `021-12345678`).
- About page demonstrates genuine expertise, not generic boilerplate.
- Trust badges only once genuinely earned (e.g. eNamad). Reviews/ratings only once real customer data exists.
- Transparent contact, warranty, and return information.
- HTTPS everywhere, no mixed content.
- **Vanity metrics are an anti-signal.** Counting your own site's categories/FAQs/pages as an "achievement stat" ("8 categories", "8 FAQs answered") signals smallness and means nothing to a buyer. Trust strips should carry buyer-relevant, verifiable facts — or be removed.

### 9. Technical & Security Hygiene
- Valid SSL. Correct HTTP status codes throughout.
- Security headers (CSP, X-Content-Type-Options, etc.).
- Forms protected against spam server-side (rate limiting, honeypot).
- No exposed API keys, credentials, or debug endpoints.

### 10. Local / Language-Specific (RTL/FA)
- `dir="rtl"` and correct `lang` (e.g. `fa-IR`) at the document root.
- Persian typography uses a proper variable font with correct glyph shaping.
- Local business schema formatted for the target country's address conventions.
- Avoid CDNs/services that are slow or unreachable from the target region — validate real load times from the actual target market.
- Persian keyword research must account for synonym sprawl and transliteration variants (e.g. Latin brand name vs Persian spelling) — map these to one canonical page each, per §2.

### 11. Ongoing Monitoring (not one-time)
- Search Console verified and monitored for coverage errors, manual actions, CWV field data, and **cannibalization signals** (multiple URLs on one query).
- Rankings tracked for a defined target keyword list over time.
- Structured data errors monitored.
- Content freshness maintained.

### How to use this checklist
When reviewing or writing any page template, component, or content: go through every section above that's relevant (not just the obviously related ones) and note pass/fail per item before calling something "done." Do not claim a page is "fully SEO optimized" without having checked every category. Minor items compound at scale across a growing catalog — and §2 (cannibalization) compounds fastest of all.

