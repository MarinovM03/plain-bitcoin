import { SHARE } from '../ui/copy.ts';
import { html } from '../ui/html.ts';
import { prefersReducedMotion } from '../util/motion.ts';
import { canvasBlob, renderPostcard } from './render.ts';
import type { Postcard, PostcardFormat } from './types.ts';
import { composeText, postcardFileName } from './words.ts';

export const POST_INTENT = 'https://x.com/intent/post';

export function postUrl(card: Postcard, site: string): string {
    return `${POST_INTENT}?text=${encodeURIComponent(composeText(card, site))}`;
}

export function canCopyImage(): boolean {
    return typeof ClipboardItem === 'function' && typeof navigator.clipboard?.write === 'function';
}

/** Starts the copy inside the tap itself, so the browser counts it as the person's own action. */
export function copyImage(blob: Promise<Blob>): Promise<boolean> {
    if (!canCopyImage()) return Promise.resolve(false);
    try {
        return navigator.clipboard
            .write([new ClipboardItem({ 'image/png': blob })])
            .then(() => true)
            .catch(() => false);
    } catch {
        return Promise.resolve(false);
    }
}

export async function postcardBlob(card: Postcard, format: PostcardFormat, site: string): Promise<Blob> {
    return canvasBlob((await renderPostcard(card, format, site)).canvas);
}

export function saveBlob(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function fileOf(blob: Blob, card: Postcard): File {
    return new File([blob], postcardFileName(card.tool, Date.now()), { type: 'image/png' });
}

interface Tray {
    dialog: HTMLDialogElement;
    canvas: HTMLCanvasElement;
    paper: HTMLElement;
    status: HTMLElement;
    post: HTMLAnchorElement;
    share: HTMLButtonElement;
    formats: HTMLInputElement[];
    card: Postcard | null;
    site: string;
    format: PostcardFormat;
    printing: number;
}

let tray: Tray | null = null;

function trayMarkup(): string {
    return html`<div class="tray__plate">
    <div class="tray__head">
        <p class="tray__title">${SHARE.tray}</p>
        <button class="button tray__close" type="button" data-tray="close">${SHARE.close}</button>
    </div>
    <div class="tray__slot" aria-hidden="true"><span class="tray__led"></span></div>
    <div class="tray__paper"><canvas class="tray__card" role="img"></canvas></div>
    <fieldset class="field segmented tray__format">
        <legend class="visually-hidden">${SHARE.format}</legend>
        <div class="segmented__track">
            <label class="segmented__option"><input class="segmented__input" type="radio" name="tray-format" value="wide" checked /><span class="segmented__text">${SHARE.wide}</span></label>
            <label class="segmented__option"><input class="segmented__input" type="radio" name="tray-format" value="square" /><span class="segmented__text">${SHARE.square}</span></label>
        </div>
    </fieldset>
    <div class="tray__actions">
        <button class="button button--primary" type="button" data-tray="copy">${SHARE.copyImage}</button>
        <button class="button" type="button" data-tray="download">${SHARE.download}</button>
        <a class="button" href="${POST_INTENT}" target="_blank" rel="noopener noreferrer" data-tray="post">${SHARE.post} <span aria-hidden="true">↗</span></a>
        <button class="button" type="button" data-tray="share" hidden>${SHARE.share}</button>
    </div>
    <p class="tray__status" role="status" aria-live="polite"></p>
    <p class="tray__note">${SHARE.madeHere}</p>
</div>`.value;
}

function say(message: string): void {
    if (tray) tray.status.textContent = message;
}

/** The machine prints: the real postcard feeds out of the slot. Reduced motion shows it at once. */
async function print(current: Tray, card: Postcard): Promise<void> {
    const mine = ++current.printing;
    current.card = card;
    current.post.href = postUrl(card, current.site);
    say(SHARE.printing);
    current.paper.classList.remove('is-feeding');
    await renderPostcard(card, current.format, current.site, undefined, current.canvas);
    if (mine !== current.printing) return;
    current.canvas.setAttribute('aria-label', card.alt);
    current.dialog.dataset.format = current.format;
    if (!prefersReducedMotion()) {
        void current.paper.offsetWidth;
        current.paper.classList.add('is-feeding');
    }
    say(SHARE.printed);
    const file = fileOf(await canvasBlob(current.canvas), card);
    if (mine === current.printing)
        current.share.hidden = !(typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }));
}

function build(site: string): Tray {
    const dialog = document.createElement('dialog');
    dialog.className = 'tray';
    dialog.setAttribute('aria-label', SHARE.tray);
    dialog.innerHTML = trayMarkup();
    document.body.append(dialog);
    const find = <T extends Element>(selector: string) => dialog.querySelector<T>(selector) as T;
    const made: Tray = {
        dialog,
        canvas: find<HTMLCanvasElement>('.tray__card'),
        paper: find<HTMLElement>('.tray__paper'),
        status: find<HTMLElement>('.tray__status'),
        post: find<HTMLAnchorElement>('[data-tray="post"]'),
        share: find<HTMLButtonElement>('[data-tray="share"]'),
        formats: [...dialog.querySelectorAll<HTMLInputElement>('input[name="tray-format"]')],
        card: null,
        site,
        format: 'wide',
        printing: 0,
    };
    const blob = () => canvasBlob(made.canvas);
    dialog.addEventListener('click', (event) => {
        const target = (event.target as Element).closest<HTMLElement>('[data-tray]');
        if (event.target === dialog) dialog.close();
        if (!target || !made.card) return;
        const card = made.card;
        switch (target.dataset.tray) {
            case 'close':
                dialog.close();
                return;
            case 'copy':
                if (!canCopyImage()) say(SHARE.copyUnsupported);
                else void copyImage(blob()).then((ok) => say(ok ? SHARE.copied : SHARE.copyUnsupported));
                return;
            case 'download':
                void blob().then((data) => {
                    saveBlob(data, postcardFileName(card.tool, Date.now()));
                    say(SHARE.downloaded);
                });
                return;
            case 'post':
                void copyImage(blob()).then((ok) => say(ok ? SHARE.postCopied : SHARE.postNoImage));
                return;
            case 'share':
                void blob()
                    .then((data) =>
                        navigator.share({ files: [fileOf(data, card)], text: composeText(card, made.site) }),
                    )
                    .catch(() => {});
                return;
        }
    });
    for (const input of made.formats) {
        input.addEventListener('change', () => {
            made.format = input.value === 'square' ? 'square' : 'wide';
            if (made.card) void print(made, made.card).catch(() => say(SHARE.failed));
        });
    }
    return made;
}

export async function openTray(card: Postcard, site: string): Promise<void> {
    tray ??= build(site);
    tray.site = site;
    if (!tray.dialog.open) tray.dialog.showModal();
    await print(tray, card);
}

export function closeTray(): void {
    tray?.dialog.close();
}

export async function downloadPostcard(card: Postcard, site: string): Promise<void> {
    saveBlob(await postcardBlob(card, 'wide', site), postcardFileName(card.tool, Date.now()));
}
