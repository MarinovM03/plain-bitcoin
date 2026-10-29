# Session 2: purchasing power and the first share card

## What shipped

- **Bundled data, no runtime fetch.** `scripts/update-cpi.mjs` and `scripts/update-prices.mjs` (run by hand, never at build, no keys) write four snapshots in `src/data/`: UK CPI (ONS D7BT), US CPI (BLS CPI-U via FRED CPIAUCNS), and BTC month-end closes in USD and GBP. Each file carries series, source, url, licence, asOf and `months`. Coverage: prices July 2010 to September 2026 (195 months), CPI to September 2026. US CPI has a real gap at October 2025 (BLS published none); the tool shows it as a gap.
- **Model** (`src/model/power.ts`, pure): what the amount needs to be today, what cash now buys, BTC bought at the start close, its value now in nominal and real terms, and the path after the start: biggest fall with its own peak and trough months, lowest month-end, months below the starting amount. `worstStart` finds the start month with the worst real bitcoin result. CPI later than the latest published month uses the latest month ("CPI to <month>"); a missing month is a gap, never interpolated. `src/model/scale.ts` holds the bar and sparkline math.
- **Page** (`#/power`): amount (default 1,000) and currency side by side, two-select month picker limited to the bundled months, presets "2015", "Five years ago", "A year ago", "The worst month to start" (per currency, shown pressed when they match). The answer sentence in big tabular mono, the bitcoin line under it, the result label reads "Answer · today = close, September 2026". Below: cash and bitcoin bars in today's money (log scale with decade ticks and a sentence saying so beyond 10x), the path line plus an inline SVG sparkline with a dashed line at the starting amount, the formula, "Past results don't tell you what happens next." once, sources with as-of months, privacy line.
- **Screen readers** get one settled sentence 700 ms after input stops, in a hidden polite live region; the visible figure is no longer a live region.
- **Share system** (`src/share/`): `cardText.ts` builds every sentence from model output so page and card match; `card.ts` draws the card with the 2D canvas from `tokens.ts` after `document.fonts` is ready (1200x675 and 1080x1350): wordmark with the orange dot, the answer sentence, one bitcoin line in orange that names the worst fall, source and as-of in small type, `@PlainBTC · plainbitcoin.org`. `actions.ts`: Share sends the PNG plus the text through `navigator.share` when `navigator.canShare` accepts files, otherwise downloads; Download saves the PNG; Copy text copies sentence + bitcoin line + site address. The card is pre-rendered when the answer settles so Share runs inside the tap's user activation on iOS.
- **Lazy route chunk**: `main.ts` imports `src/tools/power/index.ts` only when `#/power` opens, so data and card code never load on the home page.

## Decisions and why

- **Bitcoin price: Coin Metrics Community, PriceUSD.** Keyless, a named licence (CC BY-NC 4.0), a multi-exchange reference rate rather than one exchange's prints, and daily data from 18 July 2010. Checked first: Bitstamp BTC/USD starts August 2011 with no stated data licence; Coinbase and CoinGecko history is short or now keyed; FRED's Coinbase series is copyrighted.
- **GBP derived, not native.** No keyless source has a usable BTC/GBP history (Bitstamp GBP from May 2020, Coinbase GBP from April 2015 with 0.01 BTC trades). GBP close = USD close ÷ the last DEXUSUK rate published that month (Fed H.10, public domain). Said on screen.
- **UK CPI from the ONS directly.** FRED's UK CPI (OECD `GBRCPIALLMINMEI`) stops at March 2025, so it is not maintained. D7BT verified from the ONS CSV header ("CPI INDEX 00: ALL ITEMS 2015=100").
- **US CPI via FRED CPIAUCNS**, the mirror of BLS CUUR0000SA0; BLS's own download needs a contact header per request, FRED's CSV does not.
- **"Today" is the latest complete month-end close** (September 2026 on 29 October), not a partial month.
- **Fall and lowest point reported separately.** The first draft paired the 75% fall with the May 2015 low as if one event; now the fall names its own peak and trough months.
- **Card shape follows the device:** portrait phones get the tall card for Share and Download (full size in phone feeds), everything else gets the wide one.
- **Currency labels shortened to "£ GBP" / "$ USD"** so amount and currency share a row and the answer fits the first screen.
- **Months shown in full in the page**, short on the card source line ("Sept 2026", the en-GB short form).

## Hand check: £1,000 in January 2015 (GBP)

| Input                             | Raw file value  |
| --------------------------------- | --------------- |
| ONS D7BT, 2015 JAN / 2026 SEP     | 99.3 / 144.1    |
| Coin Metrics PriceUSD, 2015-01-31 | 217.332156      |
| Coin Metrics PriceUSD, 2026-09-30 | 83,579.674      |
| DEXUSUK, 2015-01-30 / 2026-09-30  | 1.5026 / 1.3267 |
- GBP close then 217.33216 ÷ 1.5026 = 144.6374; now 83,579.674 ÷ 1.3267 = 62,998.17 (both match `gbp.json`).
- Worth today 1,000 × 144.1 ÷ 99.3 = 1,451.16 → page "£1,451".
- Cash buys 1,000 × 99.3 ÷ 144.1 = 689.10 → "£689".
- BTC 1,000 ÷ 144.6374 (the stored close) = 6.9138411 → 691,384,110 sats → page "6.91384110 BTC".
- Value now 6.9138411 × 62,998.17 = 435,559.34 → "£435,559"; in January 2015 money × 99.3 ÷ 144.1 = 300,146 → "£300,146".

The files store closes to 8 significant digits; against the unrounded close the BTC figure moves by 0.00000009 BTC, under a penny at today's price.

## Budgets (production build)

| Budget                | Limit        | Actual                  |
| --------------------- | ------------ | ----------------------- |
| Initial JS            | < 30 kB gzip | 8.18 kB (21.56 kB raw)  |
| `#/power` route chunk |              | 11.43 kB (27.38 kB raw) |
| CSS                   | < 15 kB gzip | 3.55 kB (13.47 kB raw)  |
| HTML                  |              | 1.41 kB gzip            |
| Fonts                 | < 80 kB      | 32.98 kB (unchanged)    |

```
dist/index.html                  4.32 kB │ gzip:  1.41 kB
dist/assets/index-DFavX0c_.css  13.47 kB │ gzip:  3.55 kB
dist/assets/index-B90uD0Z9.js   21.56 kB │ gzip:  8.18 kB
dist/assets/power-Dfc3asZy.js   27.38 kB │ gzip: 11.43 kB
```

Initial JS grew 2.6 kB gzip: the power copy, inputs markup and month/format helpers sit in the main chunk because the frame renders before the route chunk loads. About half the route chunk is the bundled data.

Lighthouse: not measured this session (it is not installed locally and was not downloaded).

## Checks

- `npm run typecheck`, `npm run lint`, `npm test` (82 tests), `npm run build`: pass.
- `npm run test:e2e`: 33 passed, 1 skipped by design (keyboard test is desktop only). New `e2e/power.spec.ts`: default answer with no external or fetch requests and no console errors; currency switch keeps the month; worst month shows bitcoin below the cash put in; empty amount and the October 2025 US CPI gap clear the answer and disable sharing; Share falls back to a PNG download (1080x1350 on the phone project, 1200x675 on desktop); Share hands the PNG and sentence to Web Share when `canShare` accepts files; Copy text.
- Requests on `#/power`: the page, its CSS and JS, the route chunk and the two fonts, all same origin. No fetch or XHR. CSP unchanged (`connect-src 'self'`). No three.js, no WebGL; the only canvas is the share-card renderer.
- Recompute on input: median 0.6 ms, max 1.9 ms over 40 edits; the worst-month preset 1.3 ms on first use.
- At 390x844 the answer sentence and bitcoin line end at 741 px and the share bar at 799 px: no scrolling to see the answer.
- No horizontal overflow at 360x740, 390x844, 844x390 and 1440x900, on the default and the worst-month answers.
- Reduced motion: bar transitions 0 s.
- Real-device Web Share sheet not tried: no phone attached to this machine. The Web Share path is covered with a stubbed `navigator.share` in e2e, and desktop Chromium falls back to Download.

## Screenshots (docs/sessions/02/)

`390x844-default.png`, `390x844-2015.png` (same view as default, since default is January 2015, with the 2015 preset pressed), `390x844-worst.png`, `390x844-usd.png`, `390x844-reduced-motion.png`, `390x1500-default-full.png` (bars, path and sources), `1440x900-default.png`, `card-1200x675.png`, `card-1080x1350.png`.

## Open issues

- The Coin Metrics licence is non-commercial. Fine for a free site; if Plain Bitcoin ever earns money (tips included), the price source must change or be licensed.
- Real-phone Web Share (iOS Safari and Android Chrome) still needs a check on a device; iPhone WebKit e2e stays in Session 6.
- Lighthouse not re-measured; Session 6 runs it with the audit.
- Desktop left column is empty below the presets; acceptable, the answer column is full.
- OG image, web manifest and iPhone WebKit e2e remain in Session 6.
