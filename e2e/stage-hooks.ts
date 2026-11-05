import { expect, type Page } from '@playwright/test';

export interface SceneState {
    scene: string | undefined;
    rev: string | undefined;
    settled: string | undefined;
    pending: boolean;
    summary: string | undefined;
    /** The 3D scene's own account, when the stage draws one. */
    gl: boolean;
    glSettled: string | undefined;
    glSummary: string | undefined;
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
            pending: scene?.dataset.pending !== undefined,
            summary: scene?.dataset.summary,
            gl: scene?.dataset.gl !== undefined,
            glSettled: scene?.dataset.glSettled,
            glSummary: scene?.dataset.glSummary,
        };
    });
}

/** Waits until the scene on screen shows the newest payload the tool sent: the SVG readout, and the 3D scene too. */
export async function settled(page: Page): Promise<SceneState> {
    await expect
        .poll(
            async () => {
                const state = await sceneState(page);
                const svg = !state.pending && state.rev !== undefined && state.settled === state.rev;
                return svg && (!state.gl || state.glSettled === state.rev);
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
