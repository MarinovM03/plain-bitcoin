# Plain Bitcoin

Plain Bitcoin is a living chain instrument: a handcrafted scene for every tool, and a shareable postcard for every plain Bitcoin truth. It lives at [plainbitcoin.org](https://plainbitcoin.org).

A slim top bar (the five tools, @PlainBTC and one status line: block height, price, minutes since the last block, with "est." wherever a value is an estimate) sits over five tool pages and a home page. Each page shows its answer in plain text beside a small model of the same truth that you can turn, point at and tap.

- **Left to mine: the 21 million ingot.** All 21 million bitcoin as one bar, cut into a slab per halving era. Each slab is exactly as long as the coins its era issues, so the volumes are the supply. Issued coin is bone, the unmined rest is orange, and a thinner bar in front magnifies the last 2 million 10.5 times, labelled as such. When a real block arrives, the next 3.125 BTC drops onto the issued side.
- **Purchasing power: the balance.** Cash kept as steel notes on one pan, the same money put into bitcoin as orange coins on the other, stacked on the same scale as the bars below the answer. The beam reads the ratio on a labelled log dial, 8° for each ×10, and stops at ×1000.
- **Converter: the sat cube.** One bitcoin as one block of exactly 100,000,000 sats (1,000 cells of 100,000 sats; each of those 1,000 cells of 100 sats; each of those a tray of 100 single sats). Your amount is the orange cells. Tap the next cell to focus into it, down to single sats.
- **Buying on a schedule: the ridge.** Seen front on, it is the honest chart, on the same axes as the SVG: worth at each buy in orange, money put in in white, the lump sum dashed in steel. Drag it and each buy turns out to be a solid step of a ridge.
- **Address lookup: the key cut.** What you type is cut into a key blade, one tooth per character. When the checksum proves the address, every pin seats and the plug turns; a character that cannot be in the address leaves its pin stuck up exactly where it fails. The public balance comes from mempool.space only after a clear note and a tap.
- **Home: the chain on the table.** The last blocks stacked on a table, the top one engraved with the real tip, with the five tools as small models around it. Point at one to light its tile, tap it to open the tool.

Every size, count and angle in a scene comes from the same numbers as the answer beside it, handed over on one typed bus. Drag turns a scene a little and it eases back; pointing at a part names it; the same parts are buttons for the keyboard. Without WebGL, on Save-Data or on slow hardware, each scene is the matching solid-ink SVG drawing instead.

One static site. No backend, no accounts, no cookies. The site never asks for keys, seeds or signatures.

## The living background

Two visual families never mix. The **background** around the plates is continuous tone only: soft, slowly folding masses of deep slate, ink blue and teal, never brighter than a fixed ceiling. No lines, contours, dots or cells. The **readouts** (the scenes, graphs and postcards) are lit solid objects and hard ink on opaque charcoal plates; the background never shows through a scene, a graph, a label or a line of text.

The background always moves while the page is visible. That motion is decoration, not live activity: it does not stand for transactions, a mempool, trades or anything else, and no number on the page comes from it. Its mood comes from real chain data only. The block height sets where the drift starts; the minutes since the last block slowly fold the field harder and speed it up (an estimated block time gives a neutral mood instead); and a real new block sends one soft orange bloom out from the block number in the status line, and reaches the scene on screen too, then the field calms again. Nothing else in the background is orange.

The stage fetches nothing. It receives only the block height and time from the page, plus where the plates and the scene window sit. It loads after the page has painted; every answer and input works before it arrives. One WebGL context draws the background and the scene of the page you are on, in a worker where the browser allows it, at about 24 frames a second on a desktop and 18 on a phone, faster only while a scene is being turned or is settling. It stops in a background tab. With reduced motion it draws one still frame from the current chain state and redraws only when something changes. On Save-Data, without WebGL or on slow hardware it steps down to fewer frames, then to still frames, then to a plain CSS version of the same soft masses and the SVG drawings.

## Postcards

Every answer makes a postcard. Share postcard slides the real postcard up into a tray: one big number, exactly as the page shows it, one plain sentence, a small drawing of the tool's scene made from the same numbers (the ingot's slabs, the balance, the sat grid, the ridge's lines, the key with its type on the bow), the source and as-of time, and a quiet Plain Bitcoin · plainbitcoin.org · @PlainBTC rail. Wide is 1200 x 628 (exported at 2400 x 1256), which shows uncropped in an X timeline; Square is 1080 x 1080 (2160 x 2160).

From the tray: Copy image, Download, Share (where the phone supports sharing files) and Post on X, which copies the image and opens a post with the sentence, a link back to the tool and "via @PlainBTC". X does not let a link attach an image, so the tray says when the image is on the clipboard and the post is yours to finish.

Postcards are drawn in your browser on a canvas with the site's own fonts. Nothing is uploaded and no request is made while making, copying or downloading one. A typed address is never printed in full, only its type, its checksum result and its first and last four characters; the sample addresses print in full.

## Privacy: what leaves your browser, and when

| Request             | When                                                                                                      | Where                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Latest block height | On the home page, Bitcoin left to mine and the converter, while the tab is visible, every 45 s            | mempool.space, or blockstream.info if it fails |
| Bitcoin price       | On the home page, Bitcoin left to mine and the converter, while the tab is visible, at most once a minute | mempool.space, or CoinGecko if it fails        |
| One address balance | Only when you tap Look up on the address page, after a note that names the service                        | mempool.space                                  |

The status line shares those two requests with the tool on the same page; there is one of each, never two. On purchasing power, buying on a schedule and address lookup it fetches nothing: it shows the last value from this visit with its time, or the estimated height and the bundled last close, labelled as such. Nothing else is sent. Purchasing power and buying on a schedule work from bundled files and make no requests. Nothing you type is stored, logged or put in the URL. No analytics, trackers, third-party scripts, fonts or CDNs. The Content Security Policy allows connections to exactly those three origins.

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

Size budgets (gzip): first-load JS under 35 kB, CSS under 15 kB, fonts under 80 kB, the stage (driver, worker, renderer, background and pointer mapping) under 170 kB, loaded only after first paint, each tool scene under 30 kB (home under 35 kB), loaded only on its own route, and the postcard renderer under 20 kB, loaded only on the first sign of sharing.

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

- **Portrait**: on every tool the status line, the scene, the first input and the answer are on the first screen at 360 px wide, with no sideways scroll.
- **Keyboard up**: typing in a field shrinks the picture so the answer stays visible; tapping a button after typing does not make it jump.
- **Landscape**: picture on the left, inputs and answer on the right, nothing pinned but the background.
- **One-handed reach**: amount fields, presets, Share postcard, Paste and Look up are reachable with a thumb; nothing important sits only at the top.
- **Scenes**: a sideways drag turns each model and it eases back; a vertical swipe on a scene still scrolls the page; a tap on a part names it, right under the finger.
- **Keypads**: amount fields open the number keypad; the address field does not autocorrect or capitalise.
- **Share tray**: Share postcard slides the postcard up; Share opens the system share sheet with the PNG and the sentence (iOS Safari, Android Chrome); Copy image and Post on X put the image on the clipboard and open X with the sentence.
- **Paste**: the Paste button on the address page fills the field (iOS shows its own Paste prompt).
- **Background**: scrolling is never trapped; the background visibly drifts without touching anything, never shows through a plate, and nothing draws in a background tab.
- **Offline**: with flight mode on after the first load, the counter says "estimated, offline" and the converter uses the last close, both labelled.
- **Safari**: Web Inspector, Network: each font file downloads once; no console errors.
- **Save-Data / Low Data Mode**: the background is plain CSS and each scene is its SVG drawing instead of WebGL.
- **Reduced motion**: with Reduce Motion on, the background is one still frame, scenes land on their answer at once and postcards appear without sliding.

## Layout

```
src/app      hash router
src/hero     the stage: bus, pointer mapping, chain-weather mapping, the WebGL renderer and one scene per route (the only code that may use WebGL; draws in a worker)
src/gauges   the SVG readouts: pure layouts in solid ink, drawn when WebGL is off
src/postcard postcard words, layout, canvas renderer, share tray and share bar
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
