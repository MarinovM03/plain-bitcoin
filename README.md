# Plain Bitcoin

Plain Bitcoin is a set of small Bitcoin machines that run on the real chain, right in the browser. It lives at [plainbitcoin.org](https://plainbitcoin.org).

## Bitcoin right now

The home page opens with five live numbers, each a link into the machine it comes from: the newest block and how long ago it was found, the price, what a usual payment costs to send in the next block, the blocks to the next halving and the bitcoin still to be mined. A sixth cell is your own stack, if you chose to keep it on this device, with how far it moved since your last visit. Share today's card prints the strip as one postcard, from live readings only. Below the strip every machine has a tile.

## The machines

| Machine              | What it answers                                                             | Address    |
| -------------------- | --------------------------------------------------------------------------- | ---------- |
| Be a miner           | Hash a real block header on your own device and see how close you get       | `/miner`   |
| Bitcoin left         | How much is mined, how much is still to come, zoomed from 21M to one coin   | `/left`    |
| Halving clock        | When the block reward halves next, and every era before and after           | `/halving` |
| Follow a transaction | Where one transaction waits in line for a block, by its fee rate            | `/tx`      |
| Send now?            | What a payment costs to send right now, for every wait, in sats and dollars | `/fees`    |
| Inflation melt       | What old dollars or pounds buy today, next to the same money in bitcoin     | `/power`   |
| Sats converter       | Sats, bitcoin, dollars, euros and pounds, both ways                         | `/convert` |
| Stack weekly         | What buying a little every week since a date would be worth today           | `/dca`     |
| My stack             | What the bitcoin you hold is worth now, and since your last visit           | `/stack`   |
| Address check        | What kind of address it is, whether it is typed right, and its balance      | `/address` |

The machines you play with are drawn in 3D from real data: the miner's well fills with your own hashes, the 21M block is lit up to the coins issued so far, the halving rings count down, the waiting line shows the next blocks and the ones just mined, and the converter rolls its drums as you type. The machines you read have a large flat chart instead: what each wait costs, cash next to bitcoin, the plan's worth day by day, the address in cells. Every page has its plain name, the inputs, a big answer that updates as you type, and its source and as-of time. Old `#/` links still open their page.

One static site. No backend, no accounts, no cookies. The one thing it can keep is My stack, in this browser's local storage, and only after you tap Keep on this device. The site never asks for keys, seeds or signatures.

The scenes draw into one canvas with one WebGL context, each into its own box, and only while the tab is visible. Nothing in a scene is a link or a button, and nothing in it is invented: no fake transactions, fees or activity. With reduced motion each scene is one still frame; without WebGL2 or a real GPU the page shows its flat fallback and the 3D library is never downloaded.

## Postcards

Every answer makes a postcard. Share postcard slides the real postcard up into a tray: one big number, exactly as the page shows it, one plain sentence, a small flat drawing made from the same numbers, the source and as-of time, and a quiet Plain Bitcoin · plainbitcoin.org · @PlainBTC rail. Wide is 1200 x 628 (exported at 2400 x 1256), which shows uncropped in an X timeline; Square is 1080 x 1080 (2160 x 2160).

From the tray: Copy image, Download, Share (where the phone supports sharing files) and Post on X, which copies the image and opens a post with the sentence, a link back to the tool and "via @PlainBTC". X does not let a link attach an image, so the tray says when the image is on the clipboard and the post is yours to finish.

Postcards are drawn in your browser on a canvas with the site's own fonts. Nothing is uploaded and no request is made while making, copying or downloading one. A typed address is never printed in full, only its type, its checksum result and its first and last four characters; the sample addresses print in full.

## Privacy: what leaves your browser, and when

| Request                        | When                                                                                                                                                                                                      | Where                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Latest block height and blocks | On the live pages (home, Be a miner, Bitcoin left, Halving clock, Follow a transaction, Send now?, Sats converter, My stack) while the tab is visible: the height every 45 s, the blocks again only when it changes | mempool.space, or blockstream.info if it fails |
| Bitcoin price                  | On the same live pages, while the tab is visible, at most once a minute                                                                                                                                   | mempool.space, or CoinGecko if it fails        |
| Newest block header            | On Be a miner, to hash a real block                                                                                                                                                                       | mempool.space                                  |
| Recommended fee rates          | On the home page and Send now?: on load, every 30 s on Send now? while visible, and with each new block                                                                                                   | mempool.space                                  |
| The waiting line               | On the home page and Follow a transaction, every 30 s on that page while visible                                                                                                                          | mempool.space                                  |
| One transaction                | Only when you tap Follow or Pick a live one                                                                                                                                                               | mempool.space                                  |
| One address balance            | Only when you tap Look up on the address page, after a note that names the service                                                                                                                        | mempool.space                                  |

The status line shares the height and price requests with the page; there is one of each, never two. On Inflation melt, Stack weekly and Address check it fetches nothing: it shows the last value from this visit with its time, or the estimated height and the bundled last close, labelled as such. Nothing else is sent. Inflation melt and Stack weekly work from bundled files and make no requests. Nothing you type is logged or put in the URL, and nothing is stored except the amount on My stack after you tap Keep on this device: it stays in local storage in this browser, is never sent, and Forget it removes it. No analytics, trackers, third-party scripts, fonts or CDNs. The Content Security Policy allows connections to exactly those three origins.

If a seed phrase, private key (WIF), extended private key or a descriptor holding one is pasted into the address field, the page clears the field at once and says why. It looks through numbering, labels, punctuation, other wordlists and invisible characters, and nothing about it is sent or kept. Extended public keys are refused too, because they reveal a whole wallet.

## Real or estimated

- **Real**: block height (live API), fee rates (mempool.space's own estimates, shown as estimates), supply figures (computed from the height and the issuance schedule), checksums and address types (computed from the BIPs), the live price in the status line and on the converter, the bundled CPI and daily closes.
- **Estimated, and labelled on screen**: the block height before the first answer or when offline (one block per 10 minutes after a recorded anchor block), the next halving date (10-minute blocks), and the price when offline or on a page that does not fetch it (the last bundled close).
- Past results are history, not a forecast.

## Sources

| Data                               | Source                                                                 | Licence                      |
| ---------------------------------- | ---------------------------------------------------------------------- | ---------------------------- |
| UK CPI (D7BT)                      | Office for National Statistics                                         | Open Government Licence v3.0 |
| US CPI-U (CPIAUCNS)                | US Bureau of Labor Statistics via FRED                                 | Public domain                |
| Bitcoin daily and month-end closes | Coin Metrics Community Data (PriceUSD)                                 | CC BY-NC 4.0                 |
| USD per GBP (DEXUSUK)              | Federal Reserve H.10 via FRED                                          | Public domain                |
| Blocks, fees, price, transactions  | mempool.space public API (blockstream.info and CoinGecko as fallbacks) | Keyless public APIs          |

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
| `npm run og`                | Re-render `public/og.png` and each page's `public/og/<page>.png` card   |

`VITE_SITE_URL` sets the canonical URL, the Open Graph and Twitter tags and the address on the postcards at build time (default `https://plainbitcoin.org/`).

Size budgets (gzip): first-load JS under 35 kB, CSS under 15 kB, fonts under 80 kB, the scenes with their 3D library (three.js, the only runtime dependency) under 260 kB, loaded after first paint and only where it can run, and the postcard renderer under 20 kB, loaded only on the first sign of sharing.

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

- **Portrait**: on every page the name, the first input and the answer are on the first screen at 360 px wide, with no sideways scroll; the chart on Stack weekly is fully visible.
- **Keyboard up**: typing in a field keeps the answer visible above the keyboard.
- **Landscape**: calculator on the left, picture on the right, nothing pinned.
- **One-handed reach**: amount fields, presets, Share postcard, Paste and Look up are reachable with a thumb.
- **Scenes**: draw smoothly, follow a drag, never trap scrolling; nothing draws in a background tab.
- **Keypads**: amount fields open the number keypad; the address field does not autocorrect or capitalise.
- **Share tray**: Share postcard slides the postcard up; Share opens the system share sheet with the PNG and the sentence (iOS Safari, Android Chrome); Copy image and Post on X put the image on the clipboard and open X with the sentence.
- **Paste**: the Paste button on the address page fills the field (iOS shows its own Paste prompt).
- **Offline**: with flight mode on after the first load, the status line and Bitcoin left say the height is estimated, the converter uses the last close, and Send now? says it cannot reach mempool.space, all labelled.
- **Safari**: Web Inspector, Network: each font file downloads once; no console errors.
- **Save-Data / Low Data Mode**: the scenes show their flat fallback instead.
- **Reduced motion**: with Reduce Motion on, every scene is one still frame and postcards appear without sliding.

## Layout

```
src/app      path router, with old #/ links redirected
src/chain    a block hash as bits, for the barcode under the top bar
src/hero     one canvas, one renderer, one scene per machine (the only code that may use WebGL or three.js)
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
