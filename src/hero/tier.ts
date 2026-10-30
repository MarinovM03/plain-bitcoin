export type Tier = 'full' | 'phone' | 'plain';

const TIERS: readonly Tier[] = ['full', 'phone', 'plain'];
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i;

interface NetworkInformation {
    saveData?: boolean;
}

function requested(): Tier | null {
    const value = new URLSearchParams(window.location.search).get('hero');
    return TIERS.find((tier) => tier === value) ?? null;
}

// Chrome masks RENDERER unless asked for the unmasked name; Firefox already reports the real one.
function rendererName(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
    const name = String(gl.getParameter(gl.RENDERER));
    if (!/webkit webgl/i.test(name)) return name;
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    return debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : name;
}

export function isSoftwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
    return SOFTWARE_RENDERER.test(rendererName(gl));
}

export function isForced(): boolean {
    return requested() !== null;
}

function isPhoneClass(): boolean {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    return (
        window.matchMedia('(pointer: coarse)').matches ||
        Math.min(window.screen.width, window.screen.height) < 600 ||
        (memory !== undefined && memory <= 4)
    );
}

export function detectTier(): Tier {
    const forced = requested();
    if (forced) return forced;
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
    if (connection?.saveData) return 'plain';
    if (typeof WebGL2RenderingContext === 'undefined') return 'plain';
    return isPhoneClass() ? 'phone' : 'full';
}
