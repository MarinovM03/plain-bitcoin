export interface Scene {
    start(): void;
    stop(): void;
    dispose(): void;
}

export interface Playback {
    readonly running: boolean;
    setOnScreen(onScreen: boolean): void;
    setPageVisible(visible: boolean): void;
    dispose(): void;
}

export function createPlayback(scene: Scene, pageVisible: boolean): Playback {
    let onScreen = false;
    let visible = pageVisible;
    let running = false;
    let disposed = false;

    const sync = () => {
        const shouldRun = !disposed && onScreen && visible;
        if (shouldRun === running) return;
        running = shouldRun;
        if (running) scene.start();
        else scene.stop();
    };

    return {
        get running() {
            return running;
        },
        setOnScreen(next) {
            onScreen = next;
            sync();
        },
        setPageVisible(next) {
            visible = next;
            sync();
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            sync();
            scene.dispose();
        },
    };
}
