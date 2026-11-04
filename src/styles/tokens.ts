/**
 * Two families that never mix. The weather (the body behind the plates) uses `void`, `smoke`, `isobar` and
 * `isobarIndex` only, and never rises above WEATHER_CEILING in relative luminance outside a real block pulse.
 * The readout (gauges, graphs, postcards) uses solid ink on opaque plates: `ink`, `inkDim`, `inkCool` and `btc`.
 */
export const TOKENS = {
    void: '#05070a',
    smoke: '#13212f',
    isobar: '#3d4f61',
    isobarIndex: '#4d6377',
    plate: '#0c1016',
    well: '#151b23',
    edge: '#2a3441',
    ink: '#eef2f6',
    inkDim: '#9ba6b3',
    inkCool: '#86bde8',
    btc: '#f7931a',

    fontBody: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontDisplay: '"Fraunces", Georgia, "Times New Roman", serif',
    fontMono: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',

    stepTiny: '0.75rem',
    stepSmall: '0.875rem',
    stepBody: '1rem',
    stepLead: '1.125rem',
    stepTitle: 'clamp(1.375rem, 1.15rem + 1vw, 1.75rem)',
    stepHeading: 'clamp(1.5rem, 1.3rem + 1vw, 2rem)',
    stepDisplay: 'clamp(2.25rem, 1.5rem + 3.6vw, 4.25rem)',
    stepAnswer: 'clamp(2.125rem, 1.45rem + 3.4vw, 3.75rem)',

    gutter: '1rem',
    measure: '46rem',
    measureWide: '80rem',
    tap: '2.75rem',
    radius: '8px',
    radiusControl: '6px',
    spaceS: '0.75rem',
    spaceM: '1.25rem',
    spaceL: '2rem',
    spaceXl: '3.5rem',
    duration: '160ms',
    flip: '320ms',
    ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

export type TokenName = keyof typeof TOKENS;

/** The weather never gets brighter than this, outside a real block pulse: it can never compete with a readout. */
export const WEATHER_CEILING = 0.12;
