export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing #${id}`);
    return element as T;
}

export function whenIdle(task: () => void): void {
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(task, { timeout: 2000 });
    } else {
        setTimeout(task, 200);
    }
}
