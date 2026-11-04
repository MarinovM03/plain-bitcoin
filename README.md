# Plain Bitcoin

Plain Bitcoin is a living chain instrument that prints shareable postcards of plain Bitcoin truths. It lives at [plainbitcoin.org](https://plainbitcoin.org).

The site is one instrument: a bezel with the live meters (block height, price, and a dial of real time since the last block), five mode switches, and one gauge face mounted on a body that is always moving. Changing mode flips the face on its mount; the body keeps flowing underneath.

- **Left to mine**: the 21 million as one column, a band per halving era, issued in ink and still to mine in orange, with a ×10 loupe on the last two million. From the real block height and the subsidy schedule.
- **Purchasing power**: what an old amount of money is worth today, and what it would be in bitcoin, as two solid columns on one baseline (a labelled log scale when one is ten times the other).
- **Converter**: sats, BTC, GBP and USD at the live price, with whole-sat math, on a grid of 1,000 cells that zooms by ten.
- **Buying on a schedule**: weekly, fortnightly or monthly buys since any month from July 2010, compared with one lump sum: worth at each buy in orange, money put in in white, the lump sum dashed in steel.
- **Address lookup**: tells the address type, checks the Base58Check, Bech32 or Bech32m checksum and points at a likely typo, all offline, with each character in its own cell. The public balance comes from mempool.space only after a clear note and a tap.

One static site. No backend, no accounts, no cookies. The site never asks for keys, seeds or signatures.

## The instrument

Two visual families never mix. The **body** behind and around the plates is weather: drifting isobar contours over deep smoke, cool and dim, never brighter than a fixed ceiling. The **readouts** (gauges, graphs, postcards) are solid ink on opaque charcoal plates. The body never shows through a graph, a label or a line of text.

The body always moves while the page is visible. That motion is ambient, not live activity: it does not stand for transactions, a mempool, trades or anything else, and no number on the page comes from it. Its mood comes from real chain data only. The block height sets the pattern; the minutes since the last block slowly pack the isobars tighter and fold them harder (an estimated block time gives a neutral mood instead); and a real new block sends one orange front out from the block meter, then the body calms again. Nothing else is orange in the body. The isobars bend around the mounted plates and darken softly at their edges. On a desktop with a mouse they lean gently towards the pointer.

The body fetches nothing. It receives only the block height and block time from the page, plus where the plates sit. It loads after the page has painted; every answer and input works before it arrives. It draws in a worker at about 30 frames a second on a desktop and 20 on a phone, at a reduced internal resolution, and stops in a background tab. With reduced motion it draws one still frame from the current chain state and redraws only when that changes. On Save-Data, without WebGL or on slow hardware it steps down to fewer frames, then to still frames, then to a plain CSS version of the same isobars. The gauges are SVG in every case, so the buying-on-a-schedule chart is always a real chart that matches the answer.

## Postcards

Every answer can be printed. Print postcard feeds a postcard out of the gauge's printer into a tray: one big number, exactly as the page shows it, one plain sentence, a small drawing made from the same numbers, the source and as-of time, and a quiet Plain Bitcoin · plainbitcoin.org · @PlainBTC rail. Wide is 1200 x 628 (exported at 2400 x 1256), which shows uncropped in an X timeline; Square is 1080 x 1080 (2160 x 2160).

From the tray: Copy image, Download, Share (where the phone supports sharing files) and Post on X, which copies the image and opens a post with the sentence, a link back to the gauge and "via @PlainBTC". X does not let a link attach an image, so the tray says when the image is on the clipboard and the post is yours to finish.

Postcards are drawn in your browser on a canvas with the site's own fonts. Nothing is uploaded and no request is made while printing, copying or downloading. A typed address is never printed in full, only its type, its checksum result and its first and last four characters; the sample addresses print in full.

## Privacy: what leaves your browser, and when

| Request             | When                                                                                                      | Where                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Latest block height | On the home page, Bitcoin left to mine and the converter, while the tab is visible, every 45 s            | mempool.space, or blockstream.info if it fails |
| Bitcoin price       | On the home page, Bitcoin left to mine and the converter, while the tab is visible, at most once a minute | mempool.space, or CoinGecko if it fails        |
| One address balance | Only when you tap Look up on the address page, after a note that names the service                        | mempool.space                                  |

The meters in the bezel share those two requests with the tool on the same page; there is one of each, never two. On purchasing power, buying on a schedule and address lookup it fetches nothing: it shows the last value from this visit with its time, or the estimated height and the bundled last close, labelled as such. Nothing else is sent. Purchasing power and buying on a schedule work from bundled files and make no requests. Nothing you type is stored, logged or put in the URL. No analytics, trackers, third-party scripts, fonts or CDNs. The Content Security Policy allows connections to exactly those three origins.

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
| `npm run og`                | Re-render `public/og.png` as a postcard                                 |

`VITE_SITE_URL` sets the canonical URL, the Open Graph and Twitter tags and the address on the postcards at build time (default `https://plainbitcoin.org/`).

Size budgets (gzip): first-load JS under 35 kB, CSS under 15 kB, fonts under 80 kB, the body (its loader and worker) under 170 kB, loaded only after first paint, and the postcard printer, loaded only on the first sign of sharing, reported on its own.

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
4. Save and deploy, then open the `*.pages.dev` address and check the home page, one tool and a postcard download.
5. Custom domains: add `plainbitcoin.org` (and `www.plainbitcoin.org` with a redirect to the apex). With the domain on Cloudflare DNS the records are created for you; otherwise add the CNAME it shows.
6. After the domain is active: check the response headers (`curl -I https://plainbitcoin.org/`) match `dist/_headers`, open the site with the browser console showing (no errors), and paste the URL into a post composer on X to see the card preview.

To check a build locally first: `VITE_SITE_URL=https://plainbitcoin.org npm run build`, then `npm run preview` and look for `plainbitcoin.org` in the canonical link, the `og:url` and `og:image` tags and the brand rail of a downloaded postcard.

## Real-device checks

Run these on real phones before each launch. The automated tests cover the same ground in emulators, but not the share sheet, real keypads or Safari's own behaviour.

- **Portrait**: on every gauge the meters, the drawing, the first input and the answer are on the first screen at 360 px wide, with no sideways scroll.
- **Keyboard up**: typing in a field shrinks the picture so the answer stays visible; tapping a button after typing does not make it jump.
- **Landscape**: picture on the left, inputs and answer on the right, nothing pinned but the background.
- **One-handed reach**: amount fields, presets, Print postcard, Paste and Look up are reachable with a thumb; nothing important sits only at the top.
- **Keypads**: amount fields open the number keypad; the address field does not autocorrect or capitalise.
- **Print tray**: Print postcard feeds the postcard out; Share opens the system share sheet with the PNG and the sentence (iOS Safari, Android Chrome); Copy image and Post on X put the image on the clipboard and open X with the sentence.
- **Paste**: the Paste button on the address page fills the field (iOS shows its own Paste prompt).
- **Body**: scrolling is never trapped; the isobars visibly drift without touching anything, never show through a plate, and nothing draws in a background tab.
- **Offline**: with flight mode on after the first load, the counter says "estimated, offline" and the converter uses the last close, both labelled.
- **Safari**: Web Inspector, Network: each font file downloads once; no console errors.
- **Save-Data / Low Data Mode**: the body is the plain CSS isobars instead of WebGL; the gauges are unchanged.
- **Reduced motion**: with Reduce Motion on, the body is one still frame, gauges swap without flipping and postcards appear without feeding.

## Layout

```
src/app      hash router
src/hero     the body: stage bus, chain-weather mapping and the WebGL engine (the only code that may use WebGL; draws in a worker)
src/gauges   the five gauge faces: pure layouts in solid ink, and the SVG painter
src/postcard postcard words, layout, canvas renderer, print tray and share bar
src/tools    one folder per tool
src/model    pure, unit-tested math
src/data     public API clients and bundled data snapshots
src/ui       shell, views and all user-facing copy
src/styles   design tokens and one stylesheet per UI part
src/util     formatting, motion and DOM helpers
scripts      data update, OG image and budget scripts, run by hand
```

## Licence

Code: [MIT](LICENSE). Fonts in `public/fonts` are under the SIL Open Font License; see the licence files next to them.
