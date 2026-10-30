export interface ShareCard {
    headline: string;
    detail: string;
    source: string;
    alt: string;
    copy: string;
    fileName: string;
}

export type CardArt = (context: CanvasRenderingContext2D, box: { x: number; y: number; w: number; h: number }) => void;

export function siteAddress(siteUrl: string): string {
    return siteUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}
