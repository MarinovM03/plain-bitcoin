# Elon report — Session 1

Date: 2026-10-25
Repo: MarinovM03/plain-bitcoin
Commit: pending Martin commit

## Done

- CLAUDE.md is now committed, so every new chat inherits it; this report is committed too.
- Home in the "Ledger" layout: a full-bleed hero band on phones with the headline and a reserved slot for the live number, then ruled tool rows with a one-line preview each. The first row is visible without scrolling on a 390x844 phone.
- All six routes work by tap and keyboard; unknown links go home with one quiet note; back and forward work.
- One shared tool page frame: question, inputs, a big result block, share buttons (disabled until Session 2), source line and privacy line. On phones the result and Share sit at the bottom of the screen, under the thumb.
- Shared inputs: amount field with live thousands separators that never jumps the cursor, segmented control, select, month picker.
- Hero mount is final size and ready for the 3D scene: it loads after first paint and pauses when off screen or in a background tab.

## Decisions

- Picked layout A (Ledger) over B (Receipt): results update as you type, so no calculate button, and Share stays in thumb reach.
- Month picker uses two native dropdowns, because the built-in month input is missing on desktop Safari and Firefox.
- The hero shows "Not counted yet" rather than any placeholder number.
- Page transitions are a 120 ms fade, none for users who turn motion off.

## Budgets

- JS 5.54 kB gzip (limit 30), CSS 3.00 kB gzip (limit 15), HTML 1.41 kB gzip, fonts 33 kB (limit 80).
- Lighthouse mobile: home and purchasing power page both 100 performance, 100 accessibility, 100 best practices, 100 SEO; FCP 1.1 s, LCP 1.2 s, CLS 0.

## Open / blocked

- Tools show their inputs but do not calculate yet (Sessions 2, 4, 5).
- Hero is an empty gradient band until Session 3.
- Desktop tool pages look sparse on the right until real results exist.
- Nothing blocked.

## Needs from Martin

- Commit this session in GitHub Desktop.

## Next session

- Session 2 (purchasing power + first share card)
