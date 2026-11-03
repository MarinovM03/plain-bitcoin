import { expect, type Page } from '@playwright/test';

export interface SceneState {
    scene: string | undefined;
    rev: string | undefined;
    settled: string | undefined;
    live: boolean;
    pending: boolean;
    summary: string | undefined;
}

export async function frames(page: Page): Promise<number> {
    return Number((await page.locator('#stage').getAttribute('data-frames')) ?? '0');
}

export async function sceneState(page: Page): Promise<SceneState> {
    return page.evaluate(() => {
        const scene = document.querySelector<HTMLElement>('.scene');
        return {
            scene: scene?.dataset.scene,
            rev: scene?.dataset.rev,
            settled: scene?.dataset.settled,
            live: scene?.dataset.live !== undefined,
            pending: scene?.dataset.pending !== undefined,
            summary: scene?.dataset.summary,
        };
    });
}

/** Waits until the layer on screen shows the newest payload the tool sent. */
export async function settled(page: Page, live = false): Promise<SceneState> {
    await expect
        .poll(
            async () => {
                const state = await sceneState(page);
                return (
                    !state.pending && state.rev !== undefined && state.settled === state.rev && (!live || state.live)
                );
            },
            { timeout: 15_000 },
        )
        .toBe(true);
    return sceneState(page);
}

export async function waitForStage(page: Page): Promise<void> {
    await expect(page.locator('#stage canvas.is-ready')).toHaveCount(1, { timeout: 20_000 });
}

/** Lets a test hide and show the page as a background tab would, through the same event the stage listens to. */
export async function controlVisibility(page: Page): Promise<void> {
    await page.addInitScript(() => {
        let hidden = false;
        Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true });
        Object.defineProperty(document, 'visibilityState', {
            get: () => (hidden ? 'hidden' : 'visible'),
            configurable: true,
        });
        (window as unknown as { setHidden(next: boolean): void }).setHidden = (next: boolean) => {
            hidden = next;
            document.dispatchEvent(new Event('visibilitychange'));
        };
    });
}

export async function setHidden(page: Page, hidden: boolean): Promise<void> {
    await page.evaluate((next) => (window as unknown as { setHidden(next: boolean): void }).setHidden(next), hidden);
}
