# Status

HUB_BASELINE = `df56ceed2cfa35a813677c3a1e6de632393c7eac` (last commit of the old hub; read old files with `git show HUB_BASELINE:<path>`).

| Session | Scope                                                         | State |
| ------- | ------------------------------------------------------------- | ----- |
| 0       | Wipe old hub, scaffold, tokens, phone-first shell             | Done  |
| 1       | Home and shell polish, routes                                 | Done  |
| 2       | Purchasing power (bundled CPI), first share card              | Done  |
| 3       | Bitcoin-left Three.js hero                                    | Next  |
| 4       | Converter and DCA                                             |       |
| 5       | Address lookup                                                |       |
| 6       | Polish, phone perf, share-card system, lab-audit, deploy path |       |

## Now

- Purchasing power works end to end on `#/power`: bundled UK and US CPI and BTC month-end closes (July 2010 to September 2026), presets including the computed worst month to start, cash and bitcoin bars, the path with its worst fall, sources with as-of months.
- First Plain Bitcoin share card: wide 1200x675 and tall 1080x1350 PNGs drawn with the 2D canvas; Share (Web Share with the file), Download, Copy text.
- Data refresh: `node scripts/update-cpi.mjs` and `node scripts/update-prices.mjs` by hand each month (README).
- Budgets: initial JS 8.18 kB gzip, power route chunk 11.43 kB, CSS 3.55 kB, fonts 33 kB. Lighthouse not re-measured this session.
- External requests at runtime: none.

## Domain and hosting

- The domain plainbitcoin.org is bought.
- Hosting and the deploy path wait for Session 6. Nothing is blocked on Martin today.
- The bitcoin price source (Coin Metrics community data) is licensed for non-commercial use; revisit if the site ever earns money.

Latest note: [sessions/02-purchasing-power.md](sessions/02-purchasing-power.md)
