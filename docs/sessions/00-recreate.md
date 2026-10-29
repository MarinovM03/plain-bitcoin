# Session 0: recreate

## What shipped

- The old hub (client/, server/, its CI, CONTRIBUTING, README, configs) is removed from the working tree. Git history is intact; HUB_BASELINE = `df56ceed2cfa35a813677c3a1e6de632393c7eac`.
- New stack at the repo root: Vite 8, TypeScript 7 strict, Biome, Vitest, Playwright, plain DOM. No runtime dependencies at all.
- Design tokens in `src/styles/tokens.css` and `src/styles/tokens.ts`, kept identical by a unit test.
- Phone-first shell: wordmark top bar, home with a reserved hero mount, a one-line promise and a five-row tool list; placeholder pages for the five tool routes; a privacy footer.
- Hash router (`#/`, `#/left`, `#/power`, `#/convert`, `#/dca`, `#/address`); unknown hashes fall back to home. Focus moves to the page heading and a polite live region announces the page title on every route change.
- Home is prerendered into `index.html` at build from the same view functions the client uses, so first paint needs no JavaScript and the no-JS fallback is the real page plus a one-line note.
- `mountHero(el)` is called after first paint through `requestIdleCallback` (timeout fallback) and does nothing yet.
- CSP meta at build; CI workflow for the new stack.

## Decisions and why

- **Prerendered home.** It is the cheapest way to hold FCP under 1.5 s on slow 4G, and it makes the no-JS fallback the same markup rather than a second copy.
- **Escaping `html` tag for views.** Views are strings so the build can prerender them; every interpolation is escaped, so a later copy change cannot inject markup. User input will use DOM nodes.
- **Fonts: Fraunces 600 + IBM Plex Mono 500.** A warm serif reads as print and plain, not SaaS; Plex Mono gives tabular numbers with a ledger feel. Neither is used by the labs. One Latin-subset woff2 each, 33 kB total. Only Fraunces is preloaded because the mono is not on screen yet (preloading an unused font logs a console warning).
- **Colours.** Warm ink and paper; bitcoin orange against a cool sky blue, which stay apart under deuteranopia and protanopia (ΔE about 104 and 97). All text 7:1 or better on ink.
- **Hero ratio.** 4:5 on phones, 16:9 from 640 px, 12:5 on short landscape screens so the tool list stays within reach.
- **Reduced motion** sets `--duration: 0ms` instead of `!important` overrides, so every transition built on the token obeys it.
- **`.ts` import extensions.** Vite 8 warns about extensionless imports in the config chain, and its native config loader will require them; Biome now enforces them.
- **Playwright pinned to 1.63.0** to match the browsers already installed for the labs (no 180 MB download). CI installs its own.
- `src/app/state.ts` was not created: there is no state yet. `src/model`, `src/data` and `scripts` hold a one-line README until code lands.

## Budgets (production build, measured)

| Budget                               | Limit        | Actual                              |
| ------------------------------------ | ------------ | ----------------------------------- |
| Initial JS                           | < 30 kB gzip | 1.81 kB                             |
| CSS                                  | < 15 kB gzip | 1.84 kB                             |
| HTML                                 |              | 1.27 kB gzip                        |
| Fonts                                | < 80 kB      | 32.98 kB (only 18.1 kB loads today) |
| Lighthouse mobile performance        | 95+          | 100                                 |
| First contentful paint               | < 1.5 s      | 0.96 s                              |
| Largest contentful paint             |              | 1.06 s                              |
| CLS                                  | < 0.05       | 0                                   |
| Total blocking time                  |              | 0 ms                                |
| Accessibility / best practices / SEO |              | 100 / 100 / 100                     |

Lighthouse 12, mobile form factor, simulated throttling, headless Chromium, against `vite preview`.

## Checks

- `npm run typecheck`, `npm run lint`, `npm test` (16 tests: format, routes, html/home, token parity), `npm run build`: pass.
- `npm run test:e2e`: 5 passed, 1 skipped by design (the keyboard test runs on desktop only). Covers shell content, the hero box not moving after load, tap targets >= 44 px, route focus, the announcer, the title, browser back, unknown routes, no console errors or warnings, no request to any host but localhost, no horizontal overflow, and a 2 px focus ring on every link reached by Tab.
- No horizontal overflow at 360x740, 390x844, 844x390 and 1440x900.
- Reduced motion: row transition 0.16 s by default, 0 s under `prefers-reduced-motion: reduce`.
- three.js is not in package.json, and no React, Express, Mongoose or JWT either.

## Screenshots (docs/sessions/00/)

`390x844-home.png`, `360x740-home.png`, `390x844-tool-route.png`, `844x390-home.png`, `1440x900-home.png`, `390x844-focus-ring.png`.
Judgement: calm and quick on a phone, with the list in thumb reach below the hero. The empty hero box is the weakest frame until Session 3 fills it. Fixed during review: the footer rule ran wider than the content column, and the row focus ring now sits inside the row.

## Open issues

- The hero is a placeholder box with a dot grid until Session 3.
- The list's bottom rule and the footer rule sit close together on long pages; revisit in Session 1 polish.
- Open Graph tags, the share image, the web manifest and iPhone WebKit e2e are planned for Session 6.
- `robots.txt` was added so Lighthouse SEO passes; no sitemap yet.
