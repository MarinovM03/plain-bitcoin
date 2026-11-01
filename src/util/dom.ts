export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing #${id}`);
    return element as T;
}

function afterLoad(task: () => void): void {
    if (document.readyState === 'complete') whenIdle(task);
    else window.addEventListener('load', () => whenIdle(task), { once: true });
}

export function find<T extends Element = HTMLElement>(root: ParentNode, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
}

export function link(text: string, href: string): HTMLAnchorElement {
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.textContent = text;
    anchor.rel = 'noopener noreferrer';
    return anchor;
}

export function afterFirstPaint(task: () => void): void {
    const painted = performance.getEntriesByName('first-contentful-paint').length > 0;
    if (painted || !PerformanceObserver.supportedEntryTypes?.includes('paint')) {
        afterLoad(task);
        return;
    }
    const observer = new PerformanceObserver((list) => {
        if (list.getEntriesByName('first-contentful-paint').length === 0) return;
        observer.disconnect();
        afterLoad(task);
    });
    observer.observe({ type: 'paint', buffered: true });
}

export function whenIdle(task: () => void): void {
    if ('requestIdleCallback' in window) {
        window.requestIdleCallback(task, { timeout: 2000 });
    } else {
        setTimeout(task, 200);
    }
}

export function watchHeight(element: HTMLElement, apply: (height: number) => void): () => void {
    let last = element.offsetHeight;
    let frame = 0;
    apply(last);
    const observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            const next = element.offsetHeight;
            if (next === last) return;
            last = next;
            apply(next);
        });
    });
    observer.observe(element);
    return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
    };
}
