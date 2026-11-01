export const TOKENS = {
    ink: '#06080b',
    raised: '#0f1319',
    line: '#26303b',
    paper: '#f2f5f8',
    muted: '#9aa4b1',
    btc: '#f7931a',
    fiat: '#7db7e8',
    glass: '86%',

    fontBody: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontDisplay: '"Fraunces", Georgia, "Times New Roman", serif',
    fontMono: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',

    stepTiny: '0.75rem',
    stepSmall: '0.875rem',
    stepBody: '1rem',
    stepLead: '1.125rem',
    stepTitle: 'clamp(1.375rem, 1.15rem + 1vw, 1.75rem)',
    stepHeading: 'clamp(1.5rem, 1.3rem + 1vw, 2rem)',
    stepDisplay: 'clamp(2.5rem, 1.6rem + 4.4vw, 5rem)',
    stepAnswer: 'clamp(2.125rem, 1.45rem + 3.4vw, 3.75rem)',

    gutter: '1rem',
    measure: '46rem',
    measureWide: '80rem',
    tap: '2.75rem',
    radius: '14px',
    spaceS: '0.75rem',
    spaceM: '1.25rem',
    spaceL: '2rem',
    spaceXl: '3.5rem',
    duration: '160ms',
    ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

export type TokenName = keyof typeof TOKENS;
