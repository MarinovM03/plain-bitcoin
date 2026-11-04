import { SHARE } from '../ui/copy.ts';
import type { Postcard } from './types.ts';
import { composeText } from './words.ts';

const POST_INTENT = 'https://x.com/intent/post';

type TrayModule = typeof import('./tray.ts');

let module: TrayModule | null = null;
let loading: Promise<TrayModule> | null = null;

/** The printer loads on the first sign of a share: a hover, a focus or a touch on the bar, never before. */
function load(): Promise<TrayModule> {
    loading ??= import('./tray.ts').then((loaded) => {
        module = loaded;
        return loaded;
    });
    return loading;
}

export interface ShareBarOptions {
    postcard: () => Postcard | null;
    site: string;
    onStatus: (message: string) => void;
}

export interface ShareBar {
    setEnabled(enabled: boolean): void;
    refresh(): void;
    dispose(): void;
}

export function bindShareBar(root: ParentNode, options: ShareBarOptions): ShareBar {
    const bar = root.querySelector<HTMLElement>('.share-bar');
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('.share-bar [data-share]')];
    const post = root.querySelector<HTMLAnchorElement>('.share-bar [data-share-post]');
    let enabled = false;

    function refresh(): void {
        const card = enabled ? options.postcard() : null;
        for (const button of buttons) button.disabled = card === null;
        if (!post) return;
        post.href = card ? `${POST_INTENT}?text=${encodeURIComponent(composeText(card, options.site))}` : POST_INTENT;
        if (card) post.removeAttribute('aria-disabled');
        else post.setAttribute('aria-disabled', 'true');
        post.tabIndex = card ? 0 : -1;
    }

    const intent = () => void load().catch(() => {});
    for (const kind of ['pointerenter', 'focusin', 'touchstart'] as const)
        bar?.addEventListener(kind, intent, { passive: true, once: true });

    async function onButton(button: HTMLButtonElement): Promise<void> {
        const card = options.postcard();
        if (!card) return;
        const tray = await load();
        if (button.dataset.share === 'print') {
            await tray.openTray(card, options.site);
            return;
        }
        await tray.downloadPostcard(card, options.site);
        options.onStatus(SHARE.downloaded);
    }

    for (const button of buttons) {
        button.addEventListener('click', () => {
            onButton(button).catch(() => options.onStatus(SHARE.failed));
        });
    }
    // The link opens X itself; the image is copied in the same tap, while this page still has focus.
    post?.addEventListener('click', () => {
        refresh();
        const card = options.postcard();
        if (!card) return;
        const copied = module
            ? module.copyImage(module.postcardBlob(card, 'wide', options.site))
            : load().then((loaded) => loaded.copyImage(loaded.postcardBlob(card, 'wide', options.site)));
        void copied.then((ok) => options.onStatus(ok ? SHARE.postCopied : SHARE.postNoImage));
    });
    refresh();

    return {
        setEnabled(next) {
            enabled = next;
            refresh();
        },
        refresh,
        dispose() {
            for (const kind of ['pointerenter', 'focusin', 'touchstart'] as const)
                bar?.removeEventListener(kind, intent);
            module?.closeTray();
        },
    };
}
