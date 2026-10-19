# Frontend v2 — rebuilding the buying experience

Status: **proposal, waiting for the client's agreement** (27 Mehr 1405). The handover prompt for the implementation session is written
only after this document is agreed. The implementation session must read this file, `CLAUDE.md` and `docs/backlog.md` first.

## 0. Why this is not a "redesign"

A redesign changes how pages look. The current site's problem is how it *works* for the person buying: pages are long, information is
repeated two or three times, the first mobile screen shows a dark band with breadcrumbs instead of the part, the price and the main action
sit far below the fold, and the home page sells a 31-category catalogue that is mostly empty. The visual weakness (template-like Tailwind
look, one card style everywhere, orange on everything) is a symptom of having no model of the buyer.

Frontend v2 = **a new presentation and interaction layer built around B2B buying jobs**, on top of the data, SEO and commerce layers that
already work and stay untouched (section 7).

## 1. Who buys, and what each one is trying to do

Industrial spare parts in Iran are bought by a *chain*, not a person. One order usually passes through two or three of these people.

| Person | Situation | What they need from the site | Device |
|---|---|---|---|
| **Maintenance technician / supervisor** (نیروی فنی، سرپرست نگهداری) | A crane is down or will be. Holds a broken part, a nameplate, or a part number | "Is this the right part? Do you have it? How fast? Who do I call?" Identify the part with certainty | Phone, on the factory floor, weak signal, often sends photos on WhatsApp |
| **Purchasing officer** (کارشناس خرید / تدارکات) | Received a request from maintenance; must get a proforma, often three quotes, internal approval | Proforma (پیش‌فاکتور) with validity date, official invoice with VAT, clear price states, printable specs | Desktop, prints, emails PDFs |
| **Plant / production manager** | Downtime costs more than the part | Speed and trust: a real company, real phone, real address, a guarantee in writing | Phone, calls |
| **Repair contractor** (پیمانکار تعمیرات) | Services many plants, orders repeatedly | Lists of parts at once, reorder, order history, saved delivery and invoice details | Both |

Jobs to be done, in order of value:
1. **Identify** the exact part (part number, nameplate photo, equipment brand/model, or "looks like this").
2. **Confirm** fit and authenticity (specs, equivalents, real photos including the label, warranty terms).
3. **Get a price that purchasing can use** (proforma with validity, official invoice, VAT rule) — or pay online when it is simple.
4. **Know the time** (stock state; delivery wording only as approved).
5. **Come back** (reorder, saved lists, tracking).

## 2. B2B UX principles for this site

1. **Search is the front door, and it speaks part numbers.** Tolerant to dashes, spaces, case, Persian vs Latin digits; shows the part code
   in a monospace face; a zero-result search always offers "send a photo / call" instead of a dead end.
2. **Three ways in, always visible:** "I have a code" (search) · "I have a photo/nameplate" (WhatsApp/upload) · "I have a list" (paste many
   codes). The current site already has all three; v2 makes them the primary layout, not sections far down the home page.
3. **Certainty before price.** On the product page the order is: what it is (photo, name, code, brand) → does it fit (key specs,
   equivalents) → can I trust it (authenticity, warranty) → price and action. Every claim is real and specific.
4. **The quote is the main conversion, the cart is the second.** Many industrial buyers cannot pay by card; they need a proforma for
   approval. Both paths are first-class and clearly different (the two-basket model already exists).
5. **Say each thing once.** One spec table, one trust block, one title. Repetition makes pages long and hides the action.
6. **Honest catalogue.** Show only categories and brands that have products; empty ones are reachable only through search or the full list,
   with an honest "being added" state (decision D).
7. **Mobile first, thumb first.** A persistent bottom bar (price state + primary action + WhatsApp/call) on product pages; 44px touch
   targets; no hover-only information.
8. **Procurement artifacts are features.** Printable spec sheet, proforma, official invoice, order tracking by code + phone (exists).
9. **Fast on bad networks.** The page must be readable before any JavaScript runs; JavaScript only for search, filters, baskets and
   account.

## 3. What is wrong today (observed on the live site, 19–27 Mehr 1405)

Product page on a phone (390px):
- The first screen is a graphite band with a three-line breadcrumb and the title; the image starts below ~400px and is an empty placeholder.
- The title appears twice; key specs appear three times (key specs, full table, description); trust items appear three times (badges,
  warranty, assurance list).
- Four actions of equal weight (cart, WhatsApp photo, proforma, wishlist); price is far below the fold.
- Title digits mix systems ("SAGA1-L12 L۱۲").
- Unverified marketing claims ("same-day shipping", "best market price, direct importer") — **removed 27 Mehr** (rule 2); the about page
  still mentions central warehouses 🔶 (needs confirmation).

Home page:
- Promises "31 categories from 19 brands" while 27 categories are empty; another section says 18 brands.
- Many sections compete (search, groups, bulk list, emergency, coverage numbers, assurance, featured products, wear parts, all categories,
  why us); none leads.

Visual:
- Dark hero bands on every page, one rounded-card style for everything, orange used for decoration as well as actions, weak typographic
  hierarchy (sizes and weights too close), generic icons.

## 4. Information architecture v2

**Header (graphite chrome):** logo · part-number search (always visible, also on mobile as a full-width field under the logo) ·
categories (only non-empty) · brands (only with products) · quote basket / cart · account. Utility line: phone with working hours,
WhatsApp.

**Home:** one job — get the buyer to the right part or to a person.
1. Search hero with the three ways in (code / photo / list) and the working-hours phone.
2. Categories that actually have products (cards with real product counts).
3. Featured real products (when they exist).
4. One trust strip (verified items only) + Enamad.
5. Short "how ordering works" (quote → proforma → payment/invoice → delivery) — answers the purchasing officer.

**Category page:** title + one-paragraph guide (from WordPress content blocks) · filters (existing facets) · **list/table view by default**
for spec-heavy categories (code · name · brand · key spec · stock · price state) with a grid toggle · content blocks below the list.

**Product page (mobile order, top to bottom):**
1. One-line scrollable breadcrumb.
2. Gallery: compositor hero (light plate) first, anatomy image, unretouched label close-up last.
3. Name; part code in monospace with copy; brand + origin; authenticity label.
4. Stock state + price block (payable / inquiry / expired, with validity date) + **one** primary action; secondary actions as text links
   (WhatsApp photo, proforma, wishlist).
5. Four key spec chips → "full specs" anchor.
6. Fitment and equivalents.
7. Warranty (per category, exists) — once.
8. Full spec table — once. 9. Description and content blocks. 10. Questions. 11. Related parts.
Sticky bottom bar: price state + primary action + WhatsApp.

**Quote / checkout / account:** keep logic, restyle: a clear 3-step indicator, saved company/invoice profile (exists), printable proforma
view.

## 5. Visual language

- **Surfaces:** light reading surface (`steel-50`/white) for content; graphite (`steel-900/950`) only for header, footer and image plates.
  (Decision A.)
- **Colour:** orange (`accent`) is reserved for primary actions, focus and active states; `accent-ink` for links and orange text on
  light. No orange decoration. (Decision B.)
- **Type:** Vazirmatn stays (self-hosted). A strict scale (12/14/16/20/24/32/40) and three weights (400/700/900). Part codes and model
  numbers in a self-hosted **monospace subset** (Latin letters, digits, `-/._`; e.g. JetBrains Mono or IBM Plex Mono; ≤ 20 KB woff2,
  `font-display: optional`). (Decision C.) Tabular figures for prices.
- **Structure over boxes:** 8px grid, 1px hairline dividers (`steel-300`), cards only for things you can click. Generous white space
  around the action, dense tables for specs.
- **Components to build:** part-code chip (mono + copy), stock pill, price block with validity, spec table (zebra rows, sticky header on
  desktop), fitment table, list/grid product row, three-ways-in search block, bottom action bar, step indicator, honest empty state,
  printable spec sheet.
- **Icons:** one outline set at 1.5px stroke (current Heroicons-style), no emoji, no decorative icons.
- **Images:** the compositor plates (light theme, `docs/visual-identity-guide.md` §8) — the same corner brackets and graphite footer link
  images and pages into one system. Fixed aspect ratios (CLS 0).
- **Motion:** state transitions ≤ 150ms; nothing else; `prefers-reduced-motion` respected.

## 6. Performance budget (the Lighthouse gate stays)

| Item | Budget |
|---|---|
| Lighthouse (mobile and desktop) | performance ≥ 0.9, accessibility ≥ 0.9, SEO ≥ 0.95 on indexable pages, CLS ≤ 0.05, TBT ≤ 200ms, LCP ≤ 2.5s (existing `lighthouserc.*.json`) |
| JavaScript per page | ≤ 30 KB gzip, islands only (search, filters, baskets, account). Today all JS in `dist/_astro` is ~42 KB raw |
| Fonts | Vazirmatn variable (111 KB today — subset to Persian + Latin, target ≤ 70 KB) + mono subset ≤ 20 KB |
| HTML | product page today ~200 KB raw / home ~280 KB raw (inline CSS + repeated content). Target: product ≤ 120 KB raw by removing repetition |
| LCP image | ≤ 120 KB AVIF, explicit width/height |

## 7. What must not change (the contract)

- Static Astro + headless WordPress; all data at build time; no runtime dependency on WordPress for reading pages.
- `src/lib/**` (JSON-LD, SEO meta, indexability, URLs, pricing, checkout logic), the WordPress plugin, `taxonomy.generated.ts`.
- SEO output: canonical with trailing slash, 301 list (`src/data/legacy-redirects.mjs`), one H1 per page, breadcrumbs + BreadcrumbList,
  silo URLs, the automatic `noindex` rules, sitemap pruning.
- The `data-*` attributes and IDs read by scripts and guards (`data-authenticity`, `data-warranty`, `data-guard-until`, basket/checkout
  hooks, storage keys).
- Tokens live in `src/styles/global.css` (the compositor reads them); accent / accent-ink contrast rule.
- Rules from `CLAUDE.md`: no invented data or claims, no official-dealer claim, AI images labelled «تصویرسازی», no WooCommerce.
- Guards: `npm run check`, `npm run build`, `npm run lighthouse` must stay green; `check-build-audit` must pass.

## 8. Phases and acceptance

Work in a **git worktree on a separate branch**; nothing reaches `main` without the client's approval of screenshots.

| Phase | Scope | Done when |
|---|---|---|
| 0 | Tokens, type scale, mono font, components on a `noindex` style-guide page | Client approves the style guide |
| 1 | Product page (+ bottom action bar) | Before/after screenshots at 390 / 768 / 1280px; no repeated blocks; price + primary action in the first mobile screen |
| 2 | Category page (list/table view) and search (part-number tolerant, zero-result fallback) | Search finds `saga1l12`, `SAGA1 L12`, `ساگا` |
| 3 | Header, navigation (non-empty only), home | No empty category in nav/home; home has one leading block |
| 4 | Quote, checkout, account restyle | Purchase and quote flows tested end-to-end on sandbox |
| 5 | Content blocks, blog, legal pages | Reading width ≤ 70ch, tables readable on mobile |

Every phase: `npm run check` + `npm run build` + `npm run lighthouse` green, screenshots attached, backlog updated, commit messages in Persian.

## 9. Open questions for the client

1. Analytics: there is no visitor analytics today, so "is v2 better?" cannot be measured. Accept a privacy-friendly, self-hostable or
   Iranian-accessible tool? (Without it, success = Search Console + quote/WhatsApp counts from WordPress.)
2. Manufacturer logos (Demag, Telecrane…) on brand pages: trademark use is allowed only as identification, never to imply dealership.
   OK to show them that way?
3. "Central warehouses" on the about page — true?
4. Order of phases: product page first (recommended — it is where buying happens), or home first?
