export type HeroMode = 'scene' | 'still';

const MODES: readonly HeroMode[] = ['scene', 'still'];
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

interface NetworkInformation {
    saveData?: boolean;
}

/** `?hero=scene` or `?hero=still` pins the mode, for checks on machines that would choose the other. */
export function forcedMode(): HeroMode | null {
    const value = new URLSearchParams(window.location.search).get('hero');
    return MODES.find((mode) => mode === value) ?? null;
}

// Chrome masks RENDERER unless asked for the unmasked name; Firefox already reports the real one.
function rendererName(gl: WebGL2RenderingContext): string {
    const name = String(gl.getParameter(gl.RENDERER));
    if (!/webkit webgl/i.test(name)) return name;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : name;
}

export function isSoftwareRenderer(gl: WebGL2RenderingContext): boolean {
    return SOFTWARE_RENDERER.test(rendererName(gl));
}

/** Save-Data and browsers without WebGL2 get the drawn still; everyone else tries the lit scene. */
export function detectMode(): HeroMode {
    const forced = forcedMode();
    if (forced) return forced;
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    if (connection?.saveData) return 'still';
    return typeof WebGL2RenderingContext === 'undefined' ? 'still' : 'scene';
}
