# Plain Bitcoin

Plain Bitcoin is five plain Bitcoin calculators around one living picture of the chain, drawn from real blocks. It lives at [plainbitcoin.org](https://plainbitcoin.org).

## The five tools

| Tool                      | What it answers                                                    | Address     |
| ------------------------- | ------------------------------------------------------------------ | ----------- |
| How much bitcoin is left  | Mined so far, still to come, and the next halving                  | `#/left`    |
| What old money buys today | Pounds or dollars from any year, in today's money and as bitcoin   | `#/power`   |
| Sats to pounds converter  | Sats, bitcoin, pounds and dollars, both ways                       | `#/convert` |
| Buying a little at a time | If you had put in a fixed amount every week since a date           | `#/dca`     |
| Check a Bitcoin address   | What kind it is, whether it is typed right, and its public balance | `#/address` |

Every tool is a plain page: its name, the inputs, a big answer that updates as you type, and a flat drawing of the same numbers. Tools open from ordinary links: the rows on the home page, the Tools menu in the top bar and the footer. Each answer can be shared as a postcard.

One static site. No backend, no accounts, no cookies. The site never asks for keys, seeds or signatures.

## The living chain

The picture on the home page is the chain itself: the last eight real blocks from mempool.space, standing as stone tablets in the order they were found, newest at the front.

- **The face is the hash.** Each tablet's face is that block's own hash, one cell per bit, read like text. A block hash starts with a long run of zeros (the proof of work), so the top rows of every face are blank.
- **The size is the block.** The face grows with the block's size in bytes and the depth with its number of transactions, both clamped.
- **The gaps are the minutes.** The space between two tablets is the time between those blocks; the space in front of the newest one is the time since it was found.
- **The stone is the hash too.** The last bytes of the hash pick one of five minerals and its shade. The same hash always gives the same stone.
- **The next block.** In front of the chain, dust gathers on the outline of the block being found. It is decoration, not a forecast: it stops at 85% however long the wait and only a real new block completes it. When one arrives, the outline turns solid with that block's real face and the chain steps back one place.

Nothing in the picture is a link or a button, and nothing in it is invented: no fake transactions, fees or activity. The same facts are written on the home page in plain text and as a table. The thin line under the top bar on every page is the newest block's hash as 256 marks.

The chain is not a picture on the page; it stands behind every page. The home page is the wide shot, and scrolling it walks the camera down the chain. Each tool has its own place along the chain and the camera glides there when the tool opens. A page that fetches nothing stands in front of a saved set of real blocks. The small squares in the air are the 256 bits of the newest block's hash, set bits in orange; they are decoration. Text sits on panels: opaque plates at first, frosted glass once the lit scene is running, with a tint dark enough to keep every text colour at AA contrast. Inputs and graphs stay opaque.

The scene draws only while the tab is visible, and at half the frame rate behind a tool. With reduced motion turned on it is one still frame per page that changes only when a real block arrives. Without WebGL2, on Save-Data or without a real GPU it is a flat drawing made from the same blocks, and the 3D library is never downloaded. On slow hardware it first draws fewer pixels, then drops the glow and the shadows, then gives way to the flat drawing. If mempool.space cannot be reached it shows the last blocks it saw with the time, or a saved set with its date.

## Postcards

Every answer makes a postcard. Share postcard slides the real postcard up into a tray: one big number, exactly as the page shows it, one plain sentence, a small flat drawing made from the same numbers (the supply bar, the cash and bitcoin columns, the sat grid, the chart's lines, the address in cells), the source and as-of time, and a quiet Plain Bitcoin · plainbitcoin.org · @PlainBTC rail. Wide is 1200 x 628 (exported at 2400 x 1256), which shows uncropped in an X timeline; Square is 1080 x 1080 (2160 x 2160).

From the tray: Copy image, Download, Share (where the phone supports sharing files) and Post on X, which copies the image and opens a post with the sentence, a link back to the tool and "via @PlainBTC". X does not let a link attach an image, so the tray says when the image is on the clipboard and the post is yours to finish.

Postcards are drawn in your browser on a canvas with the site's own fonts. Nothing is uploaded and no request is made while making, copying or downloading one. A typed address is never printed in full, only its type, its checksum result and its first and last four characters; the sample addresses print in full.

## Privacy: what leaves your browser, and when

| Request                                   | When                                                                                                                                                                              | Where                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Latest block height and the newest blocks | On the home page, How much bitcoin is left and the converter, while the tab is visible: the height every 45 s, the block list once on load and again only when the height changes | mempool.space, or blockstream.info if it fails |
| Bitcoin price                             | On the home page, How much bitcoin is left and the converter, while the tab is visible, at most once a minute                                                                     | mempool.space, or CoinGecko if it fails        |
| One address balance                       | Only when you tap Look up on the address page, after a note that names the service                                                                                                | mempool.space                                  |

The status line shares those two requests with the tool on the same page; there is one of each, never two. On What old money buys today, Buying a little at a time and Check a Bitcoin address it fetches nothing: it shows the last value from this visit with its time, or the estimated height and the bundled last close, labelled as such. Nothing else is sent. What old money buys today and Buying a little at a time work from bundled files and make no requests. Nothing you type is stored, logged or put in the URL. No analytics, trackers, third-party scripts, fonts or CDNs. The Content Security Policy allows connections to exactly those three origins.

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

Size budgets (gzip): first-load JS under 35 kB, CSS under 15 kB, fonts under 80 kB, the chain scene with its 3D library (three.js, the only runtime dependency) under 260 kB, loaded after first paint and only where it can run, and the postcard renderer under 20 kB, loaded only on the first sign of sharing.

CI (GitHub Actions) runs lint, typecheck, unit tests, build, the budget check and the Chromium end-to-end tests on every push and pull request.

## Monthly data update

Once a month, after the CPI releases:

```
node scripts/update-cpi.mjs
node scripts/update-prices.mjs
node scripts/update-height.mjs
node scripts/update-blocks.mjs
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

- **Portrait**: on every tool the name, the first input and the answer are on the first screen at 360 px wide, with no sideways scroll; the chart on Buying a little at a time is fully visible.
- **Keyboard up**: typing in a field keeps the answer visible above the keyboard.
- **Landscape**: calculator on the left, picture on the right, nothing pinned.
- **One-handed reach**: amount fields, presets, Share postcard, Paste and Look up are reachable with a thumb.
- **Tools menu**: opens under the bar, lists all five tools by name, closes on a tap outside.
- **The chain**: draws smoothly, never responds to taps, and scrolling over it is never trapped; nothing draws in a background tab.
- **Keypads**: amount fields open the number keypad; the address field does not autocorrect or capitalise.
- **Share tray**: Share postcard slides the postcard up; Share opens the system share sheet with the PNG and the sentence (iOS Safari, Android Chrome); Copy image and Post on X put the image on the clipboard and open X with the sentence.
- **Paste**: the Paste button on the address page fills the field (iOS shows its own Paste prompt).
- **Offline**: with flight mode on after the first load, the chain says when it last saw its blocks, the counter says "estimated, offline" and the converter uses the last close, all labelled.
- **Safari**: Web Inspector, Network: each font file downloads once; no console errors.
- **Save-Data / Low Data Mode**: the chain is the flat drawing instead of the lit scene.
- **Reduced motion**: with Reduce Motion on, the chain is one still frame and postcards appear without sliding.

## Layout

```
src/app      hash router
src/chain    pure rules that turn a block into a tablet: size, stone, face, gaps, the new-block steps, the flat drawing
src/hero     the lit chain scene behind every page (the only code that may use WebGL or three.js)
src/gauges   each tool's flat SVG picture, drawn from the same numbers as its answer
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
