import { SHARE } from '../ui/copy.ts';
import { type CardFiles, copyText, downloadFile, shareFile } from './actions.ts';
import type { CardArt, ShareCard } from './index.ts';

const COPIED_MS = 2000;

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
    let copiedTimer = 0;

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

    return {
        setEnabled(enabled) {
            for (const button of buttons) button.disabled = !enabled;
        },
        dispose() {
            window.clearTimeout(copiedTimer);
        },
    };
}
