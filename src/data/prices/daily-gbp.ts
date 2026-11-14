import daily from './daily-gbp.json' with { type: 'json' };

// A module of its own so the big file can be loaded on demand: a dev server cannot serve JSON to a dynamic import.
export default daily;
