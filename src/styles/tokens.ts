export const TOKENS = {
    ink: '#0b0d10',
    raised: '#15181d',
    line: '#2a2f37',
    paper: '#f3f4f6',
    muted: '#9ba3ad',
    btc: '#f7931a',
    fiat: '#7db7e8',

    fontBody: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontDisplay: '"Fraunces", Georgia, "Times New Roman", serif',
    fontMono: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',

    stepTiny: '0.75rem',
    stepSmall: '0.875rem',
    stepBody: '1rem',
    stepLead: '1.125rem',
    stepTitle: 'clamp(1.25rem, 1.05rem + 0.9vw, 1.5rem)',
    stepHeading: 'clamp(1.75rem, 1.4rem + 1.6vw, 2.25rem)',
    stepFigure: 'clamp(2.5rem, 1.6rem + 4.5vw, 4.5rem)',
    stepAnswer: 'clamp(1.75rem, 1.15rem + 3vw, 3.25rem)',

    gutter: '1rem',
    measure: '46rem',
    measureWide: '72rem',
    tap: '2.75rem',
    radius: '8px',
    spaceS: '0.75rem',
    spaceM: '1.25rem',
    spaceL: '2rem',
    spaceXl: '3.5rem',
    duration: '160ms',
    ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

export type TokenName = keyof typeof TOKENS;
