/**
 * A black room where colour comes only from the machines. `plate` and `well` are the opaque surfaces text, inputs
 * and graphs sit on; `glass` is the plate's tint over a moving scene. Orange is the answer and the one accent.
 */
export const TOKENS = {
    void: '#060607',
    plate: '#0d0e10',
    well: '#16171a',
    edge: '#2b2e34',
    ink: '#f4f2ec',
    inkDim: '#9ea2a9',
    inkCool: '#8fbde6',
    inkWarm: '#e4dccb',
    btc: '#f7931a',
    good: '#7fd6a4',
    glass: 'rgb(10 10 12 / 0.86)',

    fontBody: '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontDisplay: '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", sans-serif',
    fontMono: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',

    stepTiny: '0.75rem',
    stepSmall: '0.875rem',
    stepBody: '1rem',
    stepLead: '1.125rem',
    stepTitle: 'clamp(1.375rem, 1.15rem + 1vw, 1.75rem)',
    stepHeading: 'clamp(1.5rem, 1.3rem + 1vw, 2rem)',
    stepDisplay: 'clamp(2.75rem, 1rem + 7vw, 7.5rem)',
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
