import { hrefFor } from '../app/routes.ts';
import { HERO } from './copy.ts';
import { html, type SafeHtml } from './html.ts';

export function renderHero(options: { link: boolean } = { link: true }): SafeHtml {
    const link = options.link
        ? html`<a class="hero__link" href="${hrefFor('left')}">${HERO.link} <span aria-hidden="true">→</span></a>`
        : '';
    return html`<section class="hero" aria-labelledby="hero-heading">
    <div id="hero-stage" class="hero__stage"></div>
    <div class="hero__text">
        <h1 id="hero-heading" class="hero__heading" tabindex="-1">${HERO.heading}</h1>
        <p id="hero-figure" class="hero__figure"><span class="hero__figure-empty">${HERO.figureEmpty}</span></p>
        <p id="hero-note" class="hero__note"></p>
        ${link}
    </div>
</section>`;
}
