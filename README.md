# Plain Bitcoin

A few honest Bitcoin tools, fast and plain, at [plainbitcoin.org](https://plainbitcoin.org).

- **Bitcoin left to mine**: coins issued and still to come, from the real block height and the subsidy schedule.
- **Purchasing power**: what an old amount of money is worth today, and what it would be in bitcoin.
- **Converter**: sats, BTC, GBP and USD at the live price, with whole-sat math.
- **Buying on a schedule**: weekly, fortnightly or monthly buys since any month from July 2010, compared with one lump sum, from bundled daily closes.
- **Address lookup**: decode an address offline; anything sent to a public API only after a clear note and a tap.

Everything runs in your browser. The only live requests are the latest block height, from mempool.space (Esplora as fallback), and the bitcoin price while the converter is open, from mempool.space (CoinGecko as fallback, the last bundled close when offline). No accounts, no tracking, no cookies, no third-party scripts. The site never asks for keys, seeds or signatures.

## Status

Early build. Bitcoin left to mine, purchasing power, the converter and buying on a schedule work; address lookup is next.

## Develop

Requires Node 22.12 or later.

```
npm install
npm run dev
```

| Script              | What it does                                 |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Vite dev server                              |
| `npm run build`     | Typecheck, then production build to `dist/`  |
| `npm run preview`   | Serve `dist/` on port 4173                   |
| `npm run typecheck` | TypeScript, strict                           |
| `npm run lint`      | Biome lint and format check                  |
| `npm test`          | Vitest unit tests                            |
| `npm run test:e2e`  | Playwright on a phone and a desktop viewport |

`VITE_SITE_URL` sets the canonical URL at build time (default `https://plainbitcoin.org/`).

## Monthly data update

Purchasing power and buying on a schedule read bundled CPI and bitcoin price files (month-end and daily closes). Once a month, after the CPI releases:

```
node scripts/update-cpi.mjs
node scripts/update-prices.mjs
```

Check the diff in `src/data/` (new months at the end, no surprise changes to old ones, any gap warnings explained), run `npm test`, then commit. Each data file carries its source, URL, licence and as-of date, and the site shows the source next to every number.

## Layout

```
src/app      hash router
src/hero     the Bitcoin-left hero (the only code that may use WebGL; renders in a worker)
src/tools    one folder per tool
src/model    pure, unit-tested math
src/data     public API clients and bundled data snapshots
src/share    share-card export
src/ui       shell, views and all user-facing copy
src/styles   design tokens and one stylesheet per UI part
src/util     formatting, motion and DOM helpers
scripts      data update scripts, run by hand
```

## Licence

Code: [MIT](LICENSE). Fonts in `public/fonts` are under the SIL Open Font License; see the licence files next to them.
