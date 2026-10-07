# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Three audiences at once, confirmed by the owner:
- **People buying hardware in Argentina** (mostly PC builders/upgraders) who know the component they want — "RTX 5060", "Ryzen 5 7600" — and need the lowest price across local stores without opening six tabs.
- **General public buying technology**: the site may launch publicly with real traffic and possible monetization later.
- **Recruiters and clients of Sync Solutions**: the project is also a portfolio piece, so it must work flawlessly and show craft.

Used equally on desktop (calm comparison, many tabs open while building a PC) and phone (quick price check).

## Product Purpose
Search a product once and see live prices from Mercado Libre, Compra Gamer, FullH4rd, Venex, Mexx and Gezatek side by side, with the cheapest highlighted and a minimum-price-per-store summary. Success: the user finds the cheapest real offer in seconds and clicks through to the store.

## Positioning
Queries each Argentine hardware store live and in parallel; each store streams in independently, so the first to answer shows first and a failing store never blocks the rest. Prices are read from the stores' own public sites, not a stale database.

## Operating Context
- One search box drives everything; `?q=` in the URL makes searches shareable.
- Per-store status (loading / count / error / disabled) doubles as a filter toggle.
- Views: all results sorted by price, or grouped by store. Sort asc/desc.
- Prices in ARS, formatted `es-AR`. Spanish (rioplatense, voseo) copy.
- Server cache 10 min; Compra Gamer catalog cached 15 min. `DEMO_MODE=1` serves example prices.

## Capabilities and Constraints
- Next.js 16 App Router, React 19, Tailwind 4, Geist available via `geist` package. Cheerio scrapers in `src/lib/stores/`.
- Product data: title, price, optional list price, URL, optional image (often missing or on white backgrounds), brand, stock, short badge.
- Stores can fail (Cloudflare, 403s); errors must degrade per store.
- Prices change; the UI must tell users to verify the final price at the store.
- Product name: Pesito. Monetization not defined.

## Brand Commitments
- Keep the credit to **Sync Solutions** (link: https://instagram.com/sync.tuc).
- Keep each store's identifying color as defined in `src/lib/stores/meta.ts`.
- Everything else visual is free to replace.

## Evidence on Hand
- Real live prices from six stores; demo dataset in `src/lib/stores/demo.ts`.
- No testimonials, user numbers, or partnerships exist — do not fabricate them.

## Product Principles
1. The cheapest real price is the answer; everything else supports finding and trusting it.
2. Honest about freshness and failure: show which stores answered, how fast, and which failed.
3. Fast to scan on any device; zero friction between query and store link.
4. Neutral between stores; no store gets favored treatment beyond its price.

## Accessibility & Inclusion
WCAG 2.1 AA baseline; store identity must never rely on color alone (always paired with the store name).
