# Status

HUB_BASELINE = `df56ceed2cfa35a813677c3a1e6de632393c7eac` (last commit of the old hub; read old files with `git show HUB_BASELINE:<path>`).

| Session | Scope                                                         | State |
| ------- | ------------------------------------------------------------- | ----- |
| 0       | Wipe old hub, scaffold, tokens, phone-first shell             | Done  |
| 1       | Home and shell polish, routes                                 | Done  |
| 2       | Purchasing power (bundled CPI), first share card              | Next  |
| 3       | Bitcoin-left Three.js hero                                    |       |
| 4       | Converter and DCA                                             |       |
| 5       | Address lookup                                                |       |
| 6       | Polish, phone perf, share-card system, lab-audit, deploy path |       |

## Now

- Ledger layout: full-bleed hero band with a reserved figure slot, ruled tool rows with preview lines, shared tool frame with a docked result and share bar on phones.
- All six routes wired; shared input primitives built and tested; no tool math yet.
- Hero lifecycle ready: Session 3 only fills `createScene` in `src/hero/scene.ts`.
- Budgets: JS 5.54 kB gzip, CSS 3.00 kB gzip, fonts 33 kB. Lighthouse mobile: performance 100 and accessibility 100 on home and `#/power`.
- External requests at runtime: none.

## Domain and hosting

- The domain plainbitcoin.org is bought.
- Hosting and the deploy path wait for Session 6. Nothing is blocked on Martin today.

Latest note: [sessions/01-home-shell.md](sessions/01-home-shell.md)
