import { HERO } from './copy.ts';
import { html, type SafeHtml } from './html.ts';

export function renderHero(): SafeHtml {
    return html`<section class="hero" aria-labelledby="hero-heading">
    <div id="hero-stage" class="hero__stage" aria-hidden="true"></div>
    <div class="hero__text">
        <h1 id="hero-heading" class="hero__heading" tabindex="-1">${HERO.heading}</h1>
        <p id="hero-figure" class="hero__figure"><span class="hero__figure-empty">${HERO.figureEmpty}</span></p>
        <p id="hero-note" class="hero__note">${HERO.note}</p>
    </div>
</section>`;
}
