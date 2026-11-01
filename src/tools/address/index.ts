import { type ChainStats, explorerUrl, fetchChainStats } from '../../data/address.ts';
import type { CharRole } from '../../hero/bus.ts';
import {
    type Address,
    type AddressPart,
    type Analysis,
    analyseAddress,
    type InvalidAddress,
    type PartRole,
} from '../../model/address.ts';
import { CardFiles } from '../../share/actions.ts';
import { bindShareBar } from '../../share/bar.ts';
import { type AddressText, addressText } from '../../share/cardText.ts';
import { siteAddress } from '../../share/index.ts';
import { ADDRESS, SCENE } from '../../ui/copy.ts';
import { EMPTY_FIGURE } from '../../ui/output.ts';
import { find } from '../../util/dom.ts';
import { formatBtcExact, formatSats, formatUtcStamp } from '../../util/format.ts';
import { linkScene } from '../scene.ts';

const SETTLE_MS = 700;
const MULTISIG_TYPES = new Set(['p2sh', 'p2wsh', 'p2tr']);

interface Legend {
    swatch: PartRole;
    text: string;
    label: string;
    bad?: boolean;
}

function span(text: string, className: string): HTMLSpanElement {
    const element = document.createElement('span');
    element.className = className;
    element.textContent = text;
    return element;
}

function shorten(text: string): string {
    return text.length > 14 ? `${text.slice(0, 6)}…${text.slice(-6)}` : text;
}

function partLabel(part: AddressPart, analysis: Address | InvalidAddress): string {
    const valid = analysis.kind === 'address' ? analysis : null;
    switch (part.role) {
        case 'hrp':
            return valid ? ADDRESS.parts.hrp(ADDRESS.networks[valid.network]) : ADDRESS.parts.hrpUnknown;
        case 'separator':
            return ADDRESS.parts.separator;
        case 'version':
            return valid?.witnessVersion != null
                ? ADDRESS.parts.version(valid.witnessVersion)
                : ADDRESS.parts.versionUnknown;
        case 'program':
            return valid && valid.type !== 'p2pkh' && valid.type !== 'p2sh'
                ? ADDRESS.parts.program(valid.programBytes, ADDRESS.programs[valid.type])
                : ADDRESS.parts.programUnknown;
        case 'checksum':
            return valid ? ADDRESS.parts.checksum(ADDRESS.encodings[valid.encoding]) : ADDRESS.parts.checksumBad;
        case 'prefix':
            return valid
                ? ADDRESS.parts.prefix(ADDRESS.types[valid.type], ADDRESS.networks[valid.network])
                : ADDRESS.parts.prefixUnknown;
        case 'body':
            return ADDRESS.parts.body;
    }
}

function charRoles(analysis: Address | InvalidAddress): CharRole[] {
    const roles: CharRole[] = Array.from({ length: analysis.text.length }, () => 'unknown');
    for (const part of analysis.parts) roles.fill(part.role, part.start, part.end);
    return roles;
}

function invalidCaption(analysis: InvalidAddress): string {
    if (analysis.suspect !== null || analysis.reason === 'characters') return SCENE.addressBad;
    return analysis.reason === 'checksum' ? SCENE.addressLoose : SCENE.address;
}

function whyInvalid(analysis: InvalidAddress): string {
    const position = (analysis.suspect ?? 0) + 1;
    switch (analysis.reason) {
        case 'checksum':
            if (analysis.encoding === 'base58check') return ADDRESS.why.checksumBase58;
            return analysis.suspect === null ? ADDRESS.why.checksumBech32 : ADDRESS.why.checksumAt(position);
        case 'characters':
            return ADDRESS.why.characters(position, analysis.encoding);
        default:
            return ADDRESS.why[analysis.reason];
    }
}

export function mountAddress(root: HTMLElement, siteUrl: string): () => void {
    const form = find<HTMLFormElement>(root, '.tool__inputs');
    const input = find<HTMLInputElement>(root, '#address-input');
    const pasteButton = find<HTMLButtonElement>(root, '#address-paste');
    const guard = find(root, '#address-guard');
    const figure = find(root, '#tool-result');
    const big = find(root, '#tool-result-figure');
    const detail = find(root, '#tool-result-detail');
    const status = find(root, '#tool-result-status');
    const source = find(root, '#tool-source');
    const partsSection = find(root, '#address-parts');
    const partsText = find(root, '#address-text');
    const bytesText = find(root, '#address-bytes');
    const legend = find(root, '#address-legend');
    const about = find(root, '#address-about');
    const multisig = find(root, '#address-multisig');
    const lookupButton = find<HTMLButtonElement>(root, '#address-lookup');
    const lookupStatus = find(root, '#address-lookup-status');
    const chain = find(root, '#address-chain');
    const explorer = find<HTMLAnchorElement>(root, '#address-explorer');
    const fullToggle = find<HTMLInputElement>(root, '#address-card-full');

    const scene = linkScene(root);
    const site = siteAddress(siteUrl);
    const files = new CardFiles(site);
    let address: Address | null = null;
    let text: AddressText | null = null;
    let sequence = 0;
    let lookup: AbortController | null = null;
    let settleTimer = 0;
    const share = bindShareBar(root, {
        files,
        card: () => text?.card ?? null,
        onStatus: (message) => {
            window.clearTimeout(settleTimer);
            status.textContent = message;
        },
    });

    function settle(message: string): void {
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
            status.textContent = message;
            if (text) files.get(text.card).catch(() => {});
        }, SETTLE_MS);
    }

    function showGuard(message: string | null): void {
        guard.hidden = message === null;
        guard.textContent = message ?? '';
    }

    function showResult(headline: string | null, line: string): void {
        if (headline === null) {
            figure.replaceChildren(span(line, 'result__empty'));
            detail.textContent = '';
        } else {
            figure.textContent = headline;
            detail.textContent = line;
        }
        settle(headline === null ? line : `${headline} ${line}`);
    }

    function resetLookup(): void {
        lookup?.abort();
        lookup = null;
        chain.hidden = true;
        chain.replaceChildren();
        lookupStatus.hidden = true;
        lookupStatus.textContent = '';
        lookupButton.textContent = ADDRESS.lookUp;
    }

    function renderParts(analysis: Address | InvalidAddress | null): void {
        if (!analysis || analysis.parts.length === 0) {
            partsSection.hidden = true;
            partsText.replaceChildren();
            bytesText.replaceChildren();
            legend.replaceChildren();
            return;
        }
        const suspect = analysis.kind === 'invalid' ? analysis.suspect : null;
        const checksumBad = analysis.kind === 'invalid' && analysis.reason === 'checksum';
        const rows: Legend[] = [];
        const nodes: Node[] = [];
        for (const part of analysis.parts) {
            const piece = analysis.text.slice(part.start, part.end);
            const bad = checksumBad && part.role === (analysis.encoding === 'base58check' ? 'body' : 'checksum');
            const className = `part part--${part.role}${bad ? ' part--bad' : ''}`;
            if (suspect !== null && suspect >= part.start && suspect < part.end) {
                const at = suspect - part.start;
                nodes.push(
                    span(piece.slice(0, at), className),
                    span(piece.charAt(at), `${className} part--suspect`),
                    span(piece.slice(at + 1), className),
                );
            } else {
                nodes.push(span(piece, className));
            }
            rows.push({ swatch: part.role, text: shorten(piece), label: partLabel(part, analysis), bad });
        }
        if (suspect !== null) {
            rows.push({
                swatch: 'checksum',
                text: analysis.text.charAt(suspect),
                label: ADDRESS.parts.suspect(suspect + 1),
                bad: true,
            });
        }
        partsText.replaceChildren(...nodes);

        const bytes = analysis.bytes;
        bytesText.hidden = bytes === null;
        if (bytes) {
            const hashOf = analysis.kind === 'address' && (analysis.type === 'p2pkh' || analysis.type === 'p2sh');
            bytesText.replaceChildren(
                span(bytes.version, 'part part--version'),
                span(bytes.hash, 'part part--program'),
                span(bytes.checksum, `part part--checksum${checksumBad ? ' part--bad' : ''}`),
            );
            rows.push(
                { swatch: 'version', text: bytes.version, label: ADDRESS.parts.bytesVersion },
                {
                    swatch: 'program',
                    text: shorten(bytes.hash),
                    label: hashOf
                        ? ADDRESS.parts.bytesHash(ADDRESS.hashes[analysis.type as 'p2pkh' | 'p2sh'])
                        : ADDRESS.parts.bytesHashUnknown,
                },
                {
                    swatch: 'checksum',
                    text: bytes.checksum,
                    label: checksumBad ? ADDRESS.parts.bytesChecksumBad : ADDRESS.parts.bytesChecksum,
                    bad: checksumBad,
                },
            );
        } else {
            bytesText.replaceChildren();
        }

        legend.replaceChildren(
            ...rows.map((row) => {
                const item = document.createElement('div');
                item.className = 'address-parts__row';
                const term = document.createElement('dt');
                term.append(span(row.text, `part part--${row.swatch}${row.bad ? ' part--bad' : ''}`));
                const description = document.createElement('dd');
                description.textContent = row.label;
                item.append(term, description);
                return item;
            }),
        );
        partsSection.hidden = false;
    }

    function setAddress(next: Address | null): void {
        address = next;
        resetLookup();
        const mainnet = next?.network === 'mainnet' && next.type !== 'future';
        lookupButton.disabled = !mainnet;
        explorer.hidden = !mainnet;
        if (next && mainnet) explorer.href = explorerUrl(next.text);
        if (next && !mainnet && next.network !== 'mainnet') {
            lookupStatus.hidden = false;
            lookupStatus.textContent = ADDRESS.lookupMainnet;
        }
        about.hidden = next === null;
        about.textContent = next ? ADDRESS.about[next.type] : '';
        multisig.hidden = !next || !MULTISIG_TYPES.has(next.type);
        source.textContent = next ? ADDRESS.source(ADDRESS.specs[next.encoding]) : ADDRESS.sourceIdle;
    }

    function updateCard(): void {
        text = address ? addressText(address, fullToggle.checked, Date.now(), site) : null;
        share.setEnabled(text !== null);
    }

    function renderScene(analysis: Analysis): void {
        const empty = {
            id: 'address',
            text: '',
            roles: [],
            state: 'empty',
            suspect: null,
            checksumBad: false,
        } as const;
        if (analysis.kind === 'address') {
            big.textContent = ADDRESS.figures[analysis.type];
            scene.set({ ...empty, text: analysis.text, roles: charRoles(analysis), state: 'valid' }, SCENE.address);
            return;
        }
        if (analysis.kind === 'invalid') {
            big.textContent = analysis.reason === 'checksum' ? ADDRESS.figures.checksum : ADDRESS.figures.invalid;
            scene.set(
                {
                    ...empty,
                    text: analysis.text,
                    roles: charRoles(analysis),
                    state: 'invalid',
                    suspect: analysis.suspect,
                    checksumBad: analysis.reason === 'checksum',
                },
                invalidCaption(analysis),
            );
            return;
        }
        if (analysis.kind === 'lightning') big.textContent = ADDRESS.figures.lightning;
        else if (analysis.kind === 'extended-public') big.textContent = ADDRESS.figures.extendedPublic;
        else big.textContent = EMPTY_FIGURE;
        scene.set(empty, SCENE.addressEmpty);
    }

    function render(analysis: Analysis): void {
        showGuard(null);
        renderScene(analysis);
        if (analysis.kind === 'secret') {
            input.value = '';
            showGuard(ADDRESS.secret);
        }
        if (analysis.kind === 'extended-public') showGuard(ADDRESS.extendedPublic);
        setAddress(analysis.kind === 'address' ? analysis : null);
        renderParts(analysis.kind === 'address' || analysis.kind === 'invalid' ? analysis : null);
        updateCard();
        switch (analysis.kind) {
            case 'empty':
            case 'secret':
                showResult(null, ADDRESS.empty);
                break;
            case 'extended-public':
                showResult(ADDRESS.extendedPublicHeadline, ADDRESS.extendedPublic);
                break;
            case 'lightning':
                showResult(ADDRESS.lightningHeadline, ADDRESS.lightningDetail);
                break;
            case 'address':
                if (text) showResult(text.headline, text.detail);
                break;
            case 'invalid':
                showResult(ADDRESS.invalid[analysis.reason], whyInvalid(analysis));
                break;
        }
    }

    async function analyse(): Promise<void> {
        const current = ++sequence;
        const analysis = await analyseAddress(input.value);
        if (current === sequence) render(analysis);
    }

    function row(label: string, value: string): HTMLDivElement {
        const item = document.createElement('div');
        item.className = 'stat';
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = value;
        item.append(term, description);
        return item;
    }

    function amount(sats: number): string {
        return `${formatBtcExact(sats)} (${formatSats(sats)})`;
    }

    function showStats(stats: ChainStats, checkedAt: number): void {
        const rows = [
            row(ADDRESS.rows.balance, amount(stats.balance)),
            row(ADDRESS.rows.received, amount(stats.received)),
            row(ADDRESS.rows.sent, amount(stats.sent)),
            row(ADDRESS.rows.txs, ADDRESS.txs(stats.txCount)),
        ];
        if (stats.pendingTxCount > 0) {
            const sign = stats.pendingChange < 0 ? '-' : '+';
            const change = `${sign}${formatBtcExact(Math.abs(stats.pendingChange))}`;
            rows.push(row(ADDRESS.rows.pending, ADDRESS.pending(stats.pendingTxCount, change)));
        }
        chain.replaceChildren(...rows);
        chain.hidden = false;
        lookupStatus.hidden = false;
        lookupStatus.textContent = ADDRESS.lookupChecked(formatUtcStamp(checkedAt));
    }

    async function lookUp(): Promise<void> {
        if (!address || lookupButton.disabled) return;
        resetLookup();
        const controller = new AbortController();
        lookup = controller;
        lookupButton.disabled = true;
        lookupButton.textContent = ADDRESS.lookingUp;
        try {
            const stats = await fetchChainStats(window.fetch.bind(window), address.text, controller.signal);
            if (lookup === controller) showStats(stats, Date.now());
        } catch {
            if (lookup === controller) {
                lookupStatus.hidden = false;
                lookupStatus.textContent = ADDRESS.lookupFailed;
            }
        } finally {
            if (lookup === controller) {
                lookupButton.disabled = false;
                lookupButton.textContent = ADDRESS.lookUp;
            }
        }
    }

    async function paste(): Promise<void> {
        try {
            input.value = await navigator.clipboard.readText();
        } catch {
            showGuard(ADDRESS.pasteBlocked);
            return;
        }
        await analyse();
    }

    const onSubmit = (event: SubmitEvent) => event.preventDefault();
    form.addEventListener('submit', onSubmit);
    input.addEventListener('input', () => {
        analyse().catch(() => {});
    });
    lookupButton.addEventListener('click', () => {
        lookUp().catch(() => {});
    });
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-sample]')) {
        button.addEventListener('click', () => {
            input.value = button.dataset.sample ?? '';
            analyse().catch(() => {});
        });
    }
    fullToggle.addEventListener('change', () => {
        updateCard();
        if (text) files.get(text.card).catch(() => {});
    });
    if (typeof navigator.clipboard?.readText === 'function') {
        pasteButton.hidden = false;
        pasteButton.addEventListener('click', () => {
            paste().catch(() => {});
        });
    }
    analyse().catch(() => {});

    return () => {
        sequence += 1;
        lookup?.abort();
        window.clearTimeout(settleTimer);
        form.removeEventListener('submit', onSubmit);
        share.dispose();
    };
}
