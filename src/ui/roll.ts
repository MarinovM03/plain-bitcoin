import { prefersReducedMotion } from '../util/motion.ts';

const ROLL_MS = 460;
const STEP_MS = 22;
/** The one easing every move on the site shares; the same curve as `--ease`. */
export const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

function amount(text: string): number {
    return Number(text.replace(/[^\d.]/g, '')) || 0;
}

/**
 * Shows a new figure by rolling only the characters that changed: up when the number grew, down when it shrank.
 * Characters are matched from the right, so a digit keeps its place while the number gets longer. Screen readers
 * get the plain text; with reduced motion the characters just change.
 */
export function rollText(target: HTMLElement, text: string): void {
    const before = target.dataset.roll;
    if (before === text) return;
    target.dataset.roll = text;
    const still = prefersReducedMotion();
    const was = before ?? '';
    const from = amount(text) >= amount(was) ? '0.7em' : '-0.7em';
    const seen = document.createElement('span');
    seen.className = 'roll';
    seen.setAttribute('aria-hidden', 'true');
    const characters = [...text];
    characters.forEach((character, index) => {
        const cell = document.createElement('span');
        cell.className = 'roll__cell';
        cell.textContent = character;
        seen.append(cell);
        const fromEnd = characters.length - 1 - index;
        if (still || was[was.length - 1 - fromEnd] === character) return;
        cell.animate(
            [
                { transform: `translateY(${from})`, opacity: 0 },
                { transform: 'none', opacity: 1 },
            ],
            { duration: ROLL_MS, delay: Math.min(fromEnd, 14) * STEP_MS, easing: EASE, fill: 'backwards' },
        );
    });
    const read = document.createElement('span');
    read.className = 'visually-hidden';
    read.textContent = text;
    target.replaceChildren(read, seen);
}
