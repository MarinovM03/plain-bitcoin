# Status

HUB_BASELINE = `df56ceed2cfa35a813677c3a1e6de632393c7eac` (last commit of the old hub; read old files with `git show HUB_BASELINE:<path>`).

| Session | Scope                                                         | State |
| ------- | ------------------------------------------------------------- | ----- |
| 0       | Wipe old hub, scaffold, tokens, phone-first shell             | Done  |
| 1       | Home and shell polish, routes                                 | Next  |
| 2       | Purchasing power (bundled CPI), first share card              |       |
| 3       | Bitcoin-left Three.js hero                                    |       |
| 4       | Converter and DCA                                             |       |
| 5       | Address lookup                                                |       |
| 6       | Polish, phone perf, share-card system, lab-audit, deploy path |       |

## Now

- Shell, hash routes and placeholder tool pages are live; no tool logic yet.
- Budgets: JS 1.81 kB gzip, CSS 1.84 kB gzip, fonts 33 kB. Lighthouse mobile: performance 100, FCP 0.96 s, CLS 0.
- External requests at runtime: none.

## Blocked on Martin

- Domain and hosting for https://plainbitcoin.org (needed for the deploy path in Session 6).

Latest note: [sessions/00-recreate.md](sessions/00-recreate.md)
