# Session 1: home and shell polish

## What shipped

- Housekeeping: STATUS no longer lists the domain as blocked.
- Layout direction A, "Ledger", chosen by Martin.
- Router: all six routes. An unknown route goes home with one quiet note, announced once. On every change: scroll to top, focus the h1, set the title, announce. Back and forward work. Views fade in over 120 ms, 0 ms under reduced motion; the first paint never animates.
- Home: the hero is now the final reserved mount. It is a full-bleed band on phones (`clamp(20rem, 58svh, 34rem)`), 21:9 from 640 px, 62svh on short landscape screens. It holds the DOM headline, a figure slot showing "Not counted yet" (never a fake number) and a note. The tool list is ruled ledger rows in the agreed order, each with name, question and an orange mono preview line; on desktop the preview sits in a right column.
- Hero lifecycle: `mountHero` runs on idle, waits for `createScene`, then pauses the scene when it is off screen (IntersectionObserver) or the tab is hidden, and disposes on route change. The stage gets `role="img"` and its label only once a scene exists.
- `#/left`: the hero full width, the question, and an empty "The numbers" panel with a reserved height, plus share bar, source and privacy lines.
- Shared tool frame for the four calculators: heading and question, input form, a big tabular-mono result block, share bar (Share card, Download, Copy text, all disabled until Session 2), a source and as-of line and a per-tool privacy line. On phones the result and share bar dock to the bottom of the screen; from 832 px wide they sit in a sticky right column.
- Primitives: amount field (native input, `inputmode="decimal"`, real label, thousands grouping that keeps the caret on the typed digit and lets Backspace step over a comma), text field, segmented control (native radios), select, month picker (two native selects, months outside the range drop out), result block, source line, note line.
- Footer rule removed, so the list's bottom rule is the only rule before the footer.

## Decisions and why

- **Ledger over Receipt.** The headline on the scene gives Session 3 one frame to design for; the result updates as you type, so no button is needed and the docked result plus Share stays under the thumb.
- **No compute button.** All tool work is local and instant, so the primary action is Share, which sits in the dock.
- **Month picker as two selects.** `input type="month"` is missing on desktop Safari and Firefox; two native selects give the phone wheel everywhere.
- **Measure widened to 56rem.** Needed for the desktop ledger column and the two-column tool frame; phones are unchanged.
- **Hero stage is `aria-hidden` until a scene mounts.** Labelling an empty box as an image would be a lie to screen readers.
- **Disabled share buttons drop to outline style** instead of a faded orange, which read as muddy brown.
- **Month range** for the picker starts at July 2010 and ends at the current month for now; Session 2 sets it from the bundled data.

## Budgets (production build)

| Budget     | Limit        | Actual                 |
| ---------- | ------------ | ---------------------- |
| Initial JS | < 30 kB gzip | 5.54 kB (14.82 kB raw) |
| CSS        | < 15 kB gzip | 3.00 kB (10.97 kB raw) |
| HTML       |              | 1.41 kB gzip           |
| Fonts      | < 80 kB      | 32.98 kB (unchanged)   |

Build output:

```
dist/index.html                  4.32 kB │ gzip: 1.41 kB
dist/assets/index-BQr0Ff0d.css  10.97 kB │ gzip: 3.00 kB
dist/assets/index-CiHkRKB3.js   14.82 kB │ gzip: 5.54 kB
```

Lighthouse 12.8.2, mobile, simulated throttling, headless Chromium against `vite preview`:

| Page       | Perf | A11y | Best practices | SEO | FCP   | LCP   | CLS | TBT  |
| ---------- | ---- | ---- | -------------- | --- | ----- | ----- | --- | ---- |
| `/`        | 100  | 100  | 100            | 100 | 1.1 s | 1.2 s | 0   | 0 ms |
| `/#/power` | 100  | 100  | 100            | 100 | 1.1 s | 1.2 s | 0   | 0 ms |

The very first home run scored 76 with 1,250 ms TBT; two reruns gave 100 and 0 ms with the longest task at 58 ms, so that was a cold browser start, not the page.

## Checks

- `npm run typecheck`, `npm run lint`, `npm test` (40 tests), `npm run build`: pass.
- `npm run test:e2e`: 19 passed, 1 skipped by design (keyboard test is desktop only). Covers each route loading its frame, disabled share stubs, tap navigation with focus, title, announcer and scroll reset, back and forward, the unknown-route note, amount grouping and caret behaviour in a real browser, Tab and Enter into a tool, a 2 px focus ring on every link, no console errors or warnings, no external requests, no horizontal overflow.
- No horizontal overflow at 360x740, 390x844, 844x390 and 1440x900. No console errors or warnings on any captured page.
- View fade: 0.12 s normally, 0 s under `prefers-reduced-motion: reduce`.
- No three.js, canvas or WebGL anywhere. No network fetches.
- At 390x844 the first tool row starts at 682 px, inside the first screen; the tool dock starts at 596 px.

## Screenshots (docs/sessions/01/)

`390x844-home.png`, `390x844-left.png`, `390x844-power.png`, `390x844-convert.png`, `390x844-dca.png`, `390x844-address.png`, `360x740-home.png`, `844x390-power.png`, `1440x900-home.png`, `1440x900-power.png`, `390x844-focus-row.png`.

## Open issues

- Inputs are live but nothing computes yet; each frame says "This tool opens in a later session."
- On desktop the tool frame's right column is sparse until real results exist; revisit with the first share card in Session 2.
- The hero is still an empty gradient band until Session 3.
- Open Graph tags, share image, web manifest and iPhone WebKit e2e remain in Session 6.
