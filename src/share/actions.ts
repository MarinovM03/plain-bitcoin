import { type CardShape, renderCard } from './card.ts';
import type { CardArt, ShareCard } from './index.ts';

const PHONE_PORTRAIT = '(max-width: 40rem) and (orientation: portrait)';

export function preferredShape(): CardShape {
    return window.matchMedia(PHONE_PORTRAIT).matches ? 'tall' : 'wide';
}

export class CardFiles {
    private key = '';
    private file: Promise<File> | null = null;

    constructor(private readonly site: string) {}

    get(card: ShareCard, art?: CardArt): Promise<File> {
        const shape = preferredShape();
        const key = `${shape}|${card.fileName}|${card.headline}|${card.detail}|${card.source}`;
        if (key !== this.key || !this.file) {
            this.key = key;
            this.file = renderCard(card, shape, this.site, art).then(
                (blob) => new File([blob], card.fileName, { type: 'image/png' }),
            );
            this.file.catch(() => {
                if (this.key === key) this.file = null;
            });
        }
        return this.file;
    }
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported';

export async function shareFile(file: File, text: string): Promise<ShareOutcome> {
    const data: ShareData = { files: [file], text };
    if (typeof navigator.canShare !== 'function' || !navigator.canShare(data)) return 'unsupported';
    try {
        await navigator.share(data);
        return 'shared';
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
        throw error;
    }
}

export function downloadFile(file: File): void {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}
