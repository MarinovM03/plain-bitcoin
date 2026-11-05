/** A client rect in CSS px, as getBoundingClientRect() reports it. */
export interface ClientRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** A region of the drawing buffer in device px, GL convention: origin at the bottom left. */
export interface BufferBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ScenePoint {
    /** Scene-local CSS px from the scene window's top left. */
    cssX: number;
    cssY: number;
    /** Drawing-buffer px, GL convention (y up from the bottom of the canvas). */
    bufferX: number;
    bufferY: number;
    /** Normalised device coordinates inside the scene's own viewport: -1..1, y up. */
    ndcX: number;
    ndcY: number;
    inside: boolean;
}

/**
 * Device px the canvas buffer holds per CSS px: the screen's pixel ratio, capped, times the tier's render scale.
 * Bad input falls back to 1, so a NaN can never reach a viewport or a ray.
 */
export function bufferScale(devicePixelRatio: number, dprCap: number, renderScale: number): number {
    const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
    const cap = dprCap > 0 ? dprCap : 1;
    const render = Number.isFinite(renderScale) && renderScale > 0 ? renderScale : 1;
    return Math.min(dpr, cap) * render;
}

/**
 * The scene window's box in the drawing buffer. The renderer scissors and sets its viewport to exactly this box, and
 * the pointer maps through exactly this box, so a pointer and the pixel under it can never disagree.
 */
export function sceneViewport(scene: ClientRect, canvas: ClientRect, scale: number): BufferBox {
    const bufferHeight = Math.max(1, Math.round(canvas.height * scale));
    const x = Math.round((scene.left - canvas.left) * scale);
    const top = Math.round((scene.top - canvas.top) * scale);
    const width = Math.max(1, Math.round(scene.width * scale));
    const height = Math.max(1, Math.round(scene.height * scale));
    return { x, y: bufferHeight - top - height, width, height };
}

/**
 * The one mapping from a pointer to the stage. `clientX/Y` are viewport CSS px (never offsetX or pageX, which move
 * with scroll and with the element under the pointer); `scene` is the window's measured rect, the same rect that
 * drives the scissor; `canvas` is the stage canvas's rect; the scale is the device px per CSS px actually drawn.
 */
export function pointerToScene(
    pointer: { clientX: number; clientY: number },
    scene: ClientRect,
    canvas: ClientRect,
    devicePixelRatio: number,
    renderScale: number,
    dprCap = Number.POSITIVE_INFINITY,
): ScenePoint {
    const scale = bufferScale(devicePixelRatio, dprCap, renderScale);
    const clientX = Number.isFinite(pointer.clientX) ? pointer.clientX : Number.NaN;
    const clientY = Number.isFinite(pointer.clientY) ? pointer.clientY : Number.NaN;
    const cssX = clientX - scene.left;
    const cssY = clientY - scene.top;
    const bufferHeight = Math.max(1, Math.round(canvas.height * scale));
    const bufferX = (clientX - canvas.left) * scale;
    const bufferY = bufferHeight - (clientY - canvas.top) * scale;
    const box = sceneViewport(scene, canvas, scale);
    const ndcX = ((bufferX - box.x) / box.width) * 2 - 1;
    const ndcY = ((bufferY - box.y) / box.height) * 2 - 1;
    const inside =
        Number.isFinite(cssX) &&
        Number.isFinite(cssY) &&
        scene.width > 0 &&
        scene.height > 0 &&
        cssX >= 0 &&
        cssY >= 0 &&
        cssX <= scene.width &&
        cssY <= scene.height;
    if (!inside) return { cssX, cssY, bufferX, bufferY, ndcX: Number.NaN, ndcY: Number.NaN, inside: false };
    return { cssX, cssY, bufferX, bufferY, ndcX, ndcY, inside };
}

/** Inverse of the mapping for one point: scene NDC back to client CSS px (used for callouts and test probes). */
export function ndcToClient(ndcX: number, ndcY: number, scene: ClientRect): { x: number; y: number } {
    return { x: scene.left + ((ndcX + 1) / 2) * scene.width, y: scene.top + ((1 - ndcY) / 2) * scene.height };
}
