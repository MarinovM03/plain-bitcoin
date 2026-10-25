export class SafeHtml {
    constructor(readonly value: string) {}

    toString(): string {
        return this.value;
    }
}

type Part = SafeHtml | string | number | readonly SafeHtml[];

const ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

export function escapeHtml(text: string): string {
    return text.replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char);
}

function renderPart(part: Part): string {
    if (part instanceof SafeHtml) return part.value;
    if (Array.isArray(part)) return part.map(renderPart).join('');
    return escapeHtml(String(part));
}

export function html(strings: TemplateStringsArray, ...parts: Part[]): SafeHtml {
    return new SafeHtml(strings.reduce((out, chunk, i) => out + renderPart(parts[i - 1] ?? '') + chunk));
}
