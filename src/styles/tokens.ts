/**
 * One dark room. `void` is the page and the dark the chain fades into; `plate` and `well` are the opaque surfaces
 * text, inputs and graphs sit on; `glass` is the plate's tint over the lit world; the inks are solid. Orange is
 * the answer and the one accent.
 */
export const TOKENS = {
    void: '#0a0b0d',
    plate: '#111317',
    well: '#191c21',
    edge: '#2c3139',
    ink: '#f1efe9',
    inkDim: '#a4a8af',
    inkCool: '#8fbde6',
    inkWarm: '#e4dccb',
    btc: '#f7931a',
    glass: 'rgb(17 19 23 / 0.84)',

    fontBody: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontDisplay: '"Fraunces", Georgia, "Times New Roman", serif',
    fontMono: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',

    stepTiny: '0.75rem',
    stepSmall: '0.875rem',
    stepBody: '1rem',
    stepLead: '1.125rem',
    stepTitle: 'clamp(1.375rem, 1.15rem + 1vw, 1.75rem)',
    stepHeading: 'clamp(1.5rem, 1.3rem + 1vw, 2rem)',
    stepDisplay: 'clamp(2.5rem, 1.4rem + 5.2vw, 5.5rem)',
    stepAnswer: 'clamp(2.125rem, 1.45rem + 3.4vw, 3.75rem)',

    gutter: '1rem',
    measure: '46rem',
    measureWide: '80rem',
    tap: '2.75rem',
    radius: '10px',
    radiusControl: '6px',
    spaceS: '0.75rem',
    spaceM: '1.25rem',
    spaceL: '2rem',
    spaceXl: '3.5rem',
    duration: '160ms',
    ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

export type TokenName = keyof typeof TOKENS;
