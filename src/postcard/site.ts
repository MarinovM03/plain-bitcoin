export function siteAddress(siteUrl: string): string {
    return siteUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}
