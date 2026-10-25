const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
    return window.matchMedia(REDUCED_MOTION).matches;
}

export function onReducedMotionChange(listener: (reduced: boolean) => void): () => void {
    const query = window.matchMedia(REDUCED_MOTION);
    const handle = (event: MediaQueryListEvent) => listener(event.matches);
    query.addEventListener('change', handle);
    return () => query.removeEventListener('change', handle);
}
