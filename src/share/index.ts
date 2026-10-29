export interface ShareCard {
    headline: string;
    detail: string;
    source: string;
    alt: string;
    copy: string;
    fileName: string;
}

export function siteAddress(siteUrl: string): string {
    return siteUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}
