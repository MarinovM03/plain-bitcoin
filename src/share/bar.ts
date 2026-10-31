import { SHARE } from '../ui/copy.ts';
import { type CardFiles, copyText, downloadFile, shareFile } from './actions.ts';
import type { CardArt, ShareCard } from './index.ts';

const COPIED_MS = 2000;
const POST_INTENT = 'https://x.com/intent/post';

export function postUrl(text: string): string {
    return `${POST_INTENT}?text=${encodeURIComponent(text)}`;
}

export interface ShareBarOptions {
    files: CardFiles;
    card: () => ShareCard | null;
    art?: () => CardArt | undefined;
    onStatus: (message: string) => void;
}

export interface ShareBar {
    setEnabled(enabled: boolean): void;
    dispose(): void;
}

export function bindShareBar(root: ParentNode, options: ShareBarOptions): ShareBar {
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-share]')];
    const post = root.querySelector<HTMLAnchorElement>('[data-share-post]');
    let copiedTimer = 0;
    let enabled = false;

    function refreshPost(): void {
        if (!post) return;
        const card = enabled ? options.card() : null;
        post.href = card ? postUrl(card.copy) : POST_INTENT;
        if (card) post.removeAttribute('aria-disabled');
        else post.setAttribute('aria-disabled', 'true');
        post.tabIndex = card ? 0 : -1;
    }

    async function onShare(button: HTMLButtonElement): Promise<void> {
        const card = options.card();
        if (!card) return;
        if (button.dataset.share === 'copy') {
            button.textContent = (await copyText(card.copy)) ? SHARE.copied : SHARE.copyFailed;
            window.clearTimeout(copiedTimer);
            copiedTimer = window.setTimeout(() => {
                button.textContent = SHARE.copy;
            }, COPIED_MS);
            return;
        }
        const file = await options.files.get(card, options.art?.());
        if (button.dataset.share === 'card' && (await shareFile(file, card.copy)) !== 'unsupported') return;
        downloadFile(file);
        options.onStatus(SHARE.downloaded);
    }

    for (const button of buttons) {
        button.addEventListener('click', () => {
            onShare(button).catch(() => options.onStatus(SHARE.failed));
        });
    }

    post?.addEventListener('click', refreshPost);
    refreshPost();

    return {
        setEnabled(next) {
            enabled = next;
            for (const button of buttons) button.disabled = !next;
            refreshPost();
        },
        dispose() {
            window.clearTimeout(copiedTimer);
        },
    };
}
