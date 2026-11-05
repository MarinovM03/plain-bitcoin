/**
 * Two families that never mix. The weather (the moving background around the plates) is continuous tone in
 * `void` and the four `weather*` tokens only, and never rises above WEATHER_CEILING in relative luminance outside a
 * real block pulse. The readout (scenes, graphs, postcards) is solid ink and lit solid objects on opaque plates:
 * `ink`, `inkDim`, `inkCool`, `inkWarm` and `btc`.
 */
export const TOKENS = {
    void: '#05070a',
    weatherDeep: '#0b1622',
    weatherMass: '#1b3350',
    weatherTeal: '#163c40',
    weatherCrest: '#24465e',
    plate: '#0c1016',
    well: '#151b23',
    edge: '#2a3441',
    ink: '#eef2f6',
    inkDim: '#9ba6b3',
    inkCool: '#86bde8',
    inkWarm: '#e8dfcf',
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
    ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
} as const;

export type TokenName = keyof typeof TOKENS;

/** The weather never gets brighter than this, outside a real block pulse: it can never compete with a readout. */
export const WEATHER_CEILING = 0.1;

/** The weather family, in the order the shader blends it: ground, deep, two cool masses, the brightest crest. */
export const WEATHER = {
    void: TOKENS.void,
    deep: TOKENS.weatherDeep,
    mass: TOKENS.weatherMass,
    teal: TOKENS.weatherTeal,
    crest: TOKENS.weatherCrest,
} as const;
