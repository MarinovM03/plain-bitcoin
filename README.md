# Plain Bitcoin

A few honest Bitcoin tools, fast and plain, at [plainbitcoin.org](https://plainbitcoin.org).

- **Bitcoin left to mine**: coins issued and still to come, from the real block height and the subsidy schedule.
- **Purchasing power**: what an old amount of money is worth today, and what it would be in bitcoin.
- **Converter**: sats, BTC, GBP and USD at the live price, with whole-sat math.
- **Buying on a schedule**: weekly, fortnightly or monthly buys since any month from July 2010, compared with one lump sum.
- **Address lookup**: tells the address type, checks the Base58Check, Bech32 or Bech32m checksum and points at a likely typo, all offline. The public balance comes from mempool.space only after a clear note and a tap.

Every result exports as a Plain Bitcoin card (1200x675 or 1080x1350 PNG) with its source and as-of time, through the phone's share sheet where it can, otherwise as a download, plus copy text and a plain "Post on X" link.

One static site. No backend, no accounts, no cookies. The site never asks for keys, seeds or signatures.

## Privacy: what leaves your browser, and when

| Request             | When                                                                                                      | Where                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Latest block height | On the home page, Bitcoin left to mine and the converter, while the tab is visible, every 45 s            | mempool.space, or blockstream.info if it fails |
| Bitcoin price       | On the home page, Bitcoin left to mine and the converter, while the tab is visible, at most once a minute | mempool.space, or CoinGecko if it fails        |
| One address balance | Only when you tap Look up on the address page, after a note that names the service                        | mempool.space                                  |

The block and price line under the top bar shares those two requests with the tool on the same page; there is one of each, never two. On purchasing power, buying on a schedule and address lookup it fetches nothing: it shows the last value from this visit with its time, or the estimated height and the bundled last close, labelled as such. Nothing else is sent. Purchasing power and buying on a schedule work from bundled files and make no requests. Nothing you type is stored, logged or put in the URL. No analytics, trackers, third-party scripts, fonts or CDNs. The Content Security Policy allows connections to exactly those three origins.

If a seed phrase, private key (WIF), extended private key or a descriptor holding one is pasted into the address field, the page clears the field at once and says why. It looks through numbering, labels, punctuation, other wordlists and invisible characters, and nothing about it is sent or kept. Extended public keys are refused too, because they reveal a whole wallet.

## Real or estimated

- **Real**: block height (live API), supply figures (computed from the height and the issuance schedule), checksums and address types (computed from the BIPs), the live price in the status line and on the converter, the bundled CPI and daily closes.
- **Estimated, and labelled on screen**: the block height before the first answer or when offline (one block per 10 minutes after a recorded anchor block), the next halving date (10-minute blocks), and the price when offline or on a page that does not fetch it (the last bundled close).
- Past results are history, not a forecast.

## Sources

| Data                                 | Source                                                                 | Licence                      |
| ------------------------------------ | ---------------------------------------------------------------------- | ---------------------------- |
| UK CPI (D7BT)                        | Office for National Statistics                                         | Open Government Licence v3.0 |
| US CPI-U (CPIAUCNS)                  | US Bureau of Labor Statistics via FRED                                 | Public domain                |
| Bitcoin daily and month-end closes   | Coin Metrics Community Data (PriceUSD)                                 | CC BY-NC 4.0                 |
| USD per GBP (DEXUSUK)                | Federal Reserve H.10 via FRED                                          | Public domain                |
| Block height, price, address balance | mempool.space public API (blockstream.info and CoinGecko as fallbacks) | Keyless public APIs          |

Coin Metrics community data is licensed for non-commercial use only. If the site ever earns money, that source must be licensed or replaced.

Each bundled file in `src/data/` carries its source, URL, licence and as-of date, and the site shows the source next to every number.

## Develop

Requires Node 22.12 or later.

```
npm install
npm run dev
```

| Script                      | What it does                                                            |
| --------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`               | Vite dev server                                                         |
| `npm run build`             | Typecheck, then production build to `dist/`                             |
| `npm run preview`           | Serve `dist/` on port 4173                                              |
| `npm run typecheck`         | TypeScript, strict                                                      |
| `npm run lint`              | Biome lint and format check                                             |
| `npm test`                  | Vitest unit tests                                                       |
| `npm run budgets`           | Check `dist/` against the size budgets                                  |
| `npm run test:e2e`          | Playwright: Pixel 7 portrait and landscape, iPhone 14 (WebKit), desktop |
| `npm run test:e2e:chromium` | The Chromium projects only (what CI runs)                               |
| `npm run og`                | Re-render `public/og.png` from the card template                        |

`VITE_SITE_URL` sets the canonical URL, the Open Graph and Twitter tags and the address on the cards at build time (default `https://plainbitcoin.org/`).

Size budgets (gzip): first-load JS under 35 kB, CSS under 15 kB, fonts under 80 kB, the hero (three.js) under 170 kB and never loaded on calculator routes.

CI (GitHub Actions) runs lint, typecheck, unit tests, build, the budget check and the Chromium end-to-end tests on every push and pull request.

## Monthly data update

Once a month, after the CPI releases:

```
node scripts/update-cpi.mjs
node scripts/update-prices.mjs
node scripts/update-height.mjs
```

The first two refresh the CPI and price files; the third records a fresh anchor block for the offline height estimate, which drifts by a few blocks a day because real blocks are rarely exactly 10 minutes apart. Check the diff in `src/data/` (new months at the end, no surprise changes to old ones, any gap warnings explained), run `npm test` and `npm run test:e2e`, then commit.

## Deploy (Cloudflare Pages)

The build is a static folder. `dist/_headers` is generated by the build and sets the Content Security Policy (with `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, a `Permissions-Policy` with every feature off except clipboard and Web Share (left at its default, this site only), HSTS and long caching for hashed assets and fonts.

1. Cloudflare dashboard: Workers & Pages, Create, Pages, Connect to Git, pick this repository, production branch `main`.
2. Build settings: framework preset None, build command `npm run build`, output directory `dist`.
3. Environment variables (production): `VITE_SITE_URL` = `https://plainbitcoin.org`, `NODE_VERSION` = the version in `.node-version`.
4. Save and deploy, then open the `*.pages.dev` address and check the home page, one tool and a card download.
5. Custom domains: add `plainbitcoin.org` (and `www.plainbitcoin.org` with a redirect to the apex). With the domain on Cloudflare DNS the records are created for you; otherwise add the CNAME it shows.
6. After the domain is active: check the response headers (`curl -I https://plainbitcoin.org/`) match `dist/_headers`, open the site with the browser console showing (no errors), and paste the URL into a post composer on X to see the card preview.

To check a build locally first: `VITE_SITE_URL=https://plainbitcoin.org npm run build`, then `npm run preview` and look for `plainbitcoin.org` in the canonical link, the `og:url` and `og:image` tags and the footer line of a downloaded card.

## Real-device checks

Run these on real phones before each launch. The automated tests cover the same ground in emulators, but not the share sheet, real keypads or Safari's own behaviour.

- **Portrait**: every page fits at 360 px wide with no sideways scroll; the answer and share buttons stay reachable at the bottom.
- **Landscape**: the hero and every tool still fit; the answer bar does not cover the inputs.
- **One-handed reach**: amount fields, presets, Share card and Look up are reachable with a thumb; nothing important sits only at the top.
- **Keypads**: amount fields open the number keypad; the address field does not autocorrect or capitalise.
- **Share sheet**: Share card opens the system share sheet with the PNG and the sentence (iOS Safari, Android Chrome); posting to X works; Post on X opens the X app or site with the sentence.
- **Paste**: the Paste button on the address page fills the field (iOS shows its own Paste prompt).
- **Hero scroll**: swiping over the hero scrolls the page and is never trapped; the hero pauses when scrolled away.
- **Offline**: with flight mode on after the first load, the counter says "estimated, offline" and the converter uses the last close, both labelled.
- **Safari**: Web Inspector, Network: each font file downloads once; no console errors.
- **Save-Data / Low Data Mode**: the hero shows the plain picture instead of WebGL.
- **Reduced motion**: with Reduce Motion on, the hero shows still states and pages do not animate.

## Layout

```
src/app      hash router
src/hero     the Bitcoin-left hero (the only code that may use WebGL; renders in a worker)
src/tools    one folder per tool
src/model    pure, unit-tested math
src/data     public API clients and bundled data snapshots
src/share    share-card text, rendering and actions
src/ui       shell, views and all user-facing copy
src/styles   design tokens and one stylesheet per UI part
src/util     formatting, motion and DOM helpers
scripts      data update, OG image and budget scripts, run by hand
```

## Licence

Code: [MIT](LICENSE). Fonts in `public/fonts` are under the SIL Open Font License; see the licence files next to them.
