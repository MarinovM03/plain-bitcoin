import {
    AdditiveBlending,
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    Color,
    DataTexture,
    DirectionalLight,
    EdgesGeometry,
    Fog,
    Group,
    HalfFloatType,
    HemisphereLight,
    LinearFilter,
    LinearMipmapLinearFilter,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    NeutralToneMapping,
    PCFShadowMap,
    PerspectiveCamera,
    PlaneGeometry,
    PointLight,
    Points,
    RGBAFormat,
    Scene,
    ShaderMaterial,
    SRGBColorSpace,
    Vector2,
    WebGLRenderer,
    WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FACE_CELLS, HASH_BITS, hashBits } from '../chain/hash.ts';
import { hashMaterial, type Material } from '../chain/material.ts';
import { type Camera, CHAIN_DIRECTION, FORMING, SLAB_YAW, slabBase } from '../chain/view.ts';
import { TOKENS } from '../styles/tokens.ts';
import type { Actor, ActorPose } from './actors.ts';

export interface DrawList {
    camera: Camera;
    /** Each tablet on stage with where it is right now. */
    slabs: readonly { actor: Actor; pose: ActorPose }[];
    /** 0 hides the forming block; 1 shows it fully. */
    ghost: number;
    /** Share of the motes gathered on the forming block, 0 to 1. */
    fill: number;
    seconds: number;
    /** The newest block's hash: the squares in the air are its 256 bits. */
    hash: string | null;
    /** How strongly the squares show, 0 to 1: full on home, quieter behind a tool. */
    level: number;
}

export interface Quality {
    bloom: boolean;
    shadows: boolean;
}

export interface World {
    resize(width: number, height: number, pixelRatio: number): void;
    quality(next: Quality): void;
    /** Builds every program the list needs before the first frame, off the main thread where the browser can. */
    warm(list: DrawList): Promise<void>;
    draw(list: DrawList): void;
}

const MOTES = 1500;
const DUST_LAYERS = 3;
const FACE_PIXELS = 256;
const FACE_MARGIN = 0.085;
/** The forming block and its dust hover a hair above the floor, so no two surfaces ever share a depth. */
const HOVER = 0.02;
const KEY: readonly [number, number, number] = [-0.5361, 0.7603, 0.3669];
/** Linear-light Bitcoin orange, pushed past white so only it reaches the bloom. */
const GLOW = new Color(TOKENS.btc).multiplyScalar(2.4);

const SURFACE: Record<Material['tone'], { roughness: number; metalness: number }> = {
    orange: { roughness: 0.58, metalness: 0.05 },
    bone: { roughness: 0.86, metalness: 0 },
    limestone: { roughness: 0.92, metalness: 0 },
    steel: { roughness: 0.42, metalness: 0.6 },
    graphite: { roughness: 0.46, metalness: 0.3 },
    blank: { roughness: 0.8, metalness: 0 },
};

function channels(hex: string): [number, number, number] {
    return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as [number, number, number];
}

// A fixed, seeded scatter: dust is texture, so every visit and every still frame shows the same cloud.
function seeds(count: number, salt: number): Float32Array {
    const out = new Float32Array(count);
    let state = salt;
    for (let index = 0; index < count; index += 1) {
        state = Math.imul(state ^ (state >>> 15), 0x2c1b3c6d);
        state = Math.imul(state ^ (state >>> 12), 0x297a2d39);
        state ^= state >>> 15;
        out[index] = (state >>> 0) / 4294967296;
    }
    return out;
}

/** The face of a tablet: the stone with one cut cell per set bit, and the same cells as a mask for depth and glow. */
function faceTextures(hash: string, material: Material): { colour: DataTexture; cut: DataTexture } {
    const bits = hashBits(hash);
    const body = channels(material.body);
    const inlay = channels(material.inlay);
    const colour = new Uint8Array(FACE_PIXELS * FACE_PIXELS * 4);
    const cut = new Uint8Array(FACE_PIXELS * FACE_PIXELS * 4);
    for (let row = 0; row < FACE_PIXELS; row += 1) {
        const gy = ((row + 0.5) / FACE_PIXELS - FACE_MARGIN) / (1 - 2 * FACE_MARGIN);
        for (let column = 0; column < FACE_PIXELS; column += 1) {
            const gx = ((column + 0.5) / FACE_PIXELS - FACE_MARGIN) / (1 - 2 * FACE_MARGIN);
            let set = false;
            if (gx > 0 && gx < 1 && gy > 0 && gy < 1) {
                const cx = gx * FACE_CELLS;
                const cy = gy * FACE_CELLS;
                const inside = Math.max(Math.abs((cx % 1) - 0.5), Math.abs((cy % 1) - 0.5)) < 0.4;
                set = inside && bits[Math.floor(cy) * FACE_CELLS + Math.floor(cx)] === 1;
            }
            // Texture rows run bottom to top; the hash reads top to bottom.
            const at = ((FACE_PIXELS - 1 - row) * FACE_PIXELS + column) * 4;
            const tone = set ? inlay : body;
            colour.set([tone[0], tone[1], tone[2], 255], at);
            const mask = set ? 255 : 0;
            cut.set([mask, mask, mask, 255], at);
        }
    }
    const finish = (data: Uint8Array, srgb: boolean) => {
        const texture = new DataTexture(data, FACE_PIXELS, FACE_PIXELS, RGBAFormat);
        if (srgb) texture.colorSpace = SRGBColorSpace;
        texture.generateMipmaps = true;
        texture.minFilter = LinearMipmapLinearFilter;
        texture.magFilter = LinearFilter;
        texture.anisotropy = 4;
        texture.needsUpdate = true;
        return texture;
    };
    return { colour: finish(colour, true), cut: finish(cut, false) };
}

const DUST_VERTEX = /* glsl */ `
attribute vec3 aCell;
attribute vec3 aRand;
attribute float aBit;
attribute float aPrev;
uniform float uTime;
uniform float uFlip;
uniform float uPixels;
uniform float uLevel;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uAxis;
uniform vec3 uAcross;
uniform vec3 uCentre;
varying float vOn;
varying float vFlash;
varying float vAlpha;

void main() {
    float pace = 0.7 + 0.6 * aRand.x;
    float rise = mod(aCell.y * 0.5 + aRand.y * 0.5 + uTime * 0.035 * pace, 8.0);
    float run = (aCell.x - 7.5) * 1.5 + (aRand.z - 0.5) * 0.9;
    float depth = (aCell.z < 0.5 ? -7.5 : aCell.z < 1.5 ? -4.6 : -2.0) + (aRand.x - 0.5) * 1.6;
    vec3 world = uCentre + uAxis * run + uAcross * depth + vec3(0.0, 0.3 + rise, 0.0);
    world.x += sin(uTime * 0.21 + aCell.x * 0.9 + aCell.y) * 0.06;
    vec4 seen = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * seen;

    float since = uFlip - aCell.y * 0.07 - aCell.x * 0.014;
    vOn = since >= 0.0 ? aBit : aPrev;
    vFlash = since >= 0.0 && since < 0.42 ? 1.0 - since / 0.42 : 0.0;
    gl_PointSize = max(2.0, uPixels * (0.05 + 0.04 * aRand.z) / gl_Position.w);
    float away = -seen.z;
    float fog = 1.0 - smoothstep(uFogNear, uFogFar + 6.0, away);
    float wrap = smoothstep(0.0, 0.8, rise) * smoothstep(8.0, 6.8, rise);
    vAlpha = fog * wrap * smoothstep(2.0, 5.0, away) * uLevel;
}
`;

const DUST_FRAGMENT = /* glsl */ `
uniform vec3 uSet;
uniform vec3 uUnset;
varying float vOn;
varying float vFlash;
varying float vAlpha;

void main() {
    vec2 q = abs(gl_PointCoord - 0.5);
    float outline = smoothstep(0.3, 0.36, max(q.x, q.y));
    float alpha = vOn > 0.5 ? 0.62 + 0.38 * vFlash : (0.1 + 0.4 * vFlash) * outline;
    vec3 colour = vOn > 0.5 ? uSet * (1.0 + vFlash) : uUnset;
    gl_FragColor = vec4(colour, alpha * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

const MOTE_VERTEX = /* glsl */ `
attribute vec4 aSeed;
uniform vec3 uSize;
uniform vec2 uYaw;
uniform float uTime;
uniform float uFill;
uniform float uPixels;
uniform float uHover;
varying float vSettled;
varying float vAlpha;

void main() {
    float pick = aSeed.x;
    vec2 q = aSeed.yz - 0.5;
    vec3 onBlock;
    if (pick < 0.46) onBlock = vec3(q.x, q.y + 0.5, 0.5);
    else if (pick < 0.8) onBlock = vec3(q.x, q.y + 0.5, -0.5);
    else if (pick < 0.88) onBlock = vec3(q.x, 1.0, q.y);
    else if (pick < 0.94) onBlock = vec3(-0.5, q.x + 0.5, q.y);
    else onBlock = vec3(0.5, q.x + 0.5, q.y);
    onBlock *= uSize;

    // Loose motes keep close: a slow ring of dust around the block, thinning with distance from it.
    float turn = aSeed.y * 6.2831853 + uTime * (0.05 + aSeed.w * 0.12);
    float far = aSeed.z * aSeed.z;
    float radius = 0.32 + far * 0.95;
    float height = 0.05 + fract(aSeed.x * 13.7) * 1.05 + sin(uTime * 0.31 + aSeed.w * 40.0) * 0.05;
    vec3 adrift = vec3(cos(turn) * radius, height, sin(turn) * radius * 0.6);

    float settled = smoothstep(0.0, 1.0, clamp((uFill - aSeed.w) / 0.07, 0.0, 1.0));
    vec3 local = mix(adrift, onBlock, settled);
    vec3 world = vec3(local.x * uYaw.x + local.z * uYaw.y, local.y + uHover, -local.x * uYaw.y + local.z * uYaw.x);
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
    float size = mix(0.0075, 0.0052, settled) * (0.6 + fract(aSeed.x * 91.7));
    gl_PointSize = max(1.0, uPixels * size / gl_Position.w);
    float twinkle = 0.8 + 0.2 * sin(uTime * (0.6 + aSeed.z) + aSeed.w * 90.0);
    vSettled = settled;
    vAlpha = mix(0.4 * (1.0 - far * 0.7), 0.95, settled) * twinkle;
}
`;

const MOTE_FRAGMENT = /* glsl */ `
uniform float uGhost;
uniform vec3 uSet;
varying float vSettled;
varying float vAlpha;

void main() {
    float disc = smoothstep(0.5, 0.12, length(gl_PointCoord - 0.5));
    vec3 colour = mix(uSet * 0.7, uSet, vSettled);
    gl_FragColor = vec4(colour, disc * vAlpha * uGhost);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

interface Tablet {
    mesh: Mesh;
    stone: MeshStandardMaterial;
    face: MeshStandardMaterial;
    textures: DataTexture[];
}

export function createScene(canvas: HTMLCanvasElement, context: WebGL2RenderingContext): World {
    const renderer = new WebGLRenderer({ canvas, context, antialias: true, powerPreference: 'high-performance' });
    renderer.toneMapping = NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;

    const scene = new Scene();
    const ink = new Color(TOKENS.void);
    scene.background = ink;
    const fog = new Fog(ink, 5, 20);
    scene.fog = fog;
    const camera = new PerspectiveCamera(32, 1, 0.1, 80);

    const middle = slabBase(4.5);
    scene.add(new HemisphereLight(0x8fa4c8, 0x2a1c10, 0.5));
    const key = new DirectionalLight(0xffe2bd, 2.3);
    key.position.set(middle[0] + KEY[0] * 14, KEY[1] * 14, middle[2] + KEY[2] * 14);
    key.target.position.set(middle[0], 0, middle[2]);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 32;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    scene.add(key, key.target);
    const rim = new DirectionalLight(0x6f9bd8, 0.7);
    rim.position.set(middle[0] + 6, 4, middle[2] - 9);
    rim.target.position.set(middle[0], 0.4, middle[2]);
    scene.add(rim, rim.target);
    const lamp = new PointLight(TOKENS.btc, 0, 9, 1.6);
    lamp.position.set(-0.15, 0.8, 0.45);
    scene.add(lamp);

    const floor = new Mesh(
        new PlaneGeometry(160, 160),
        new MeshStandardMaterial({
            color: 0x0b0c0f,
            roughness: 0.62,
            metalness: 0,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
        }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const box = new BoxGeometry(1, 1, 1);
    box.translate(0, 0.5, 0);
    const tablets = new Map<string, Tablet>();

    const forming = new Group();
    forming.position.y = HOVER;
    forming.rotation.y = SLAB_YAW;
    forming.scale.set(FORMING.side, FORMING.side, FORMING.thick);
    const outline = new LineSegments(
        new EdgesGeometry(box),
        new LineBasicMaterial({ color: GLOW, transparent: true, opacity: 0, depthWrite: false }),
    );
    const haze = new Mesh(
        box,
        new MeshBasicMaterial({
            color: TOKENS.btc,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: AdditiveBlending,
        }),
    );
    forming.add(haze, outline);
    haze.renderOrder = 2;
    outline.renderOrder = 2;
    scene.add(forming);

    const moteGeometry = new BufferGeometry();
    moteGeometry.setAttribute('position', new BufferAttribute(new Float32Array(MOTES * 3), 3));
    moteGeometry.setAttribute('aSeed', new BufferAttribute(seeds(MOTES * 4, 0x9e3779b9), 4));
    const moteMaterial = new ShaderMaterial({
        vertexShader: MOTE_VERTEX,
        fragmentShader: MOTE_FRAGMENT,
        uniforms: {
            uSize: { value: [FORMING.side, FORMING.side, FORMING.thick] },
            uYaw: { value: new Vector2(Math.cos(SLAB_YAW), Math.sin(SLAB_YAW)) },
            uTime: { value: 0 },
            uFill: { value: 0 },
            uPixels: { value: 1 },
            uHover: { value: HOVER },
            uGhost: { value: 0 },
            uSet: { value: GLOW },
        },
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
    });
    const motes = new Points(moteGeometry, moteMaterial);
    motes.frustumCulled = false;
    motes.renderOrder = 3;
    scene.add(motes);

    const dustCount = HASH_BITS * DUST_LAYERS;
    const cells = new Float32Array(dustCount * 3);
    for (let index = 0; index < dustCount; index += 1) {
        const bit = index % HASH_BITS;
        cells.set([bit % FACE_CELLS, Math.floor(bit / FACE_CELLS), Math.floor(index / HASH_BITS)], index * 3);
    }
    const dustBits = new BufferAttribute(new Float32Array(dustCount), 1);
    const dustPrev = new BufferAttribute(new Float32Array(dustCount), 1);
    const dustGeometry = new BufferGeometry();
    dustGeometry.setAttribute('position', new BufferAttribute(new Float32Array(dustCount * 3), 3));
    dustGeometry.setAttribute('aCell', new BufferAttribute(cells, 3));
    dustGeometry.setAttribute('aRand', new BufferAttribute(seeds(dustCount * 3, 0x51ed270b), 3));
    dustGeometry.setAttribute('aBit', dustBits);
    dustGeometry.setAttribute('aPrev', dustPrev);
    const dustMaterial = new ShaderMaterial({
        vertexShader: DUST_VERTEX,
        fragmentShader: DUST_FRAGMENT,
        uniforms: {
            uTime: { value: 0 },
            uFlip: { value: 1000 },
            uPixels: { value: 1 },
            uLevel: { value: 1 },
            uFogNear: { value: 5 },
            uFogFar: { value: 20 },
            uAxis: { value: [...CHAIN_DIRECTION] },
            uAcross: { value: [-CHAIN_DIRECTION[2], 0, CHAIN_DIRECTION[0]] },
            uCentre: { value: [...middle] },
            uSet: { value: GLOW },
            uUnset: { value: new Color(TOKENS.inkWarm) },
        },
        transparent: true,
        depthWrite: false,
    });
    const dust = new Points(dustGeometry, dustMaterial);
    dust.frustumCulled = false;
    dust.renderOrder = 1;
    scene.add(dust);

    const composer = new EffectComposer(renderer, new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new Vector2(1, 1), 0.34, 0.55, 1));
    composer.addPass(new OutputPass());

    let bloom = true;
    let width = 1;
    let height = 1;
    let shownHash: string | null = null;
    let flippedAt = Number.NEGATIVE_INFINITY;

    function tabletFor(actor: Actor): Tablet {
        const known = tablets.get(actor.key);
        if (known) return known;
        const material = hashMaterial(actor.block.hash);
        const surface = SURFACE[material.tone];
        // Always blended, even when solid: a tablet fading in must not need a second program built mid-entrance.
        const stone = new MeshStandardMaterial({
            color: material.body,
            ...surface,
            emissive: TOKENS.btc,
            transparent: true,
        });
        stone.emissiveIntensity = 0;
        let face = stone;
        const textures: DataTexture[] = [];
        if (actor.block.hash !== null && material.tone !== 'blank') {
            const { colour, cut } = faceTextures(actor.block.hash, material);
            textures.push(colour, cut);
            face = new MeshStandardMaterial({
                map: colour,
                bumpMap: cut,
                bumpScale: -1.4,
                ...surface,
                transparent: true,
            });
            if (material.tone === 'graphite') {
                face.emissive = GLOW;
                face.emissiveMap = cut;
                face.emissiveIntensity = 0.55;
            }
        }
        const mesh = new Mesh(box, [stone, stone, stone, stone, face, stone]);
        mesh.rotation.y = SLAB_YAW;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        const tablet = { mesh, stone, face, textures };
        tablets.set(actor.key, tablet);
        return tablet;
    }

    function forget(live: ReadonlySet<string>): void {
        for (const [key, tablet] of tablets) {
            if (live.has(key)) continue;
            scene.remove(tablet.mesh);
            for (const texture of tablet.textures) texture.dispose();
            tablet.stone.dispose();
            if (tablet.face !== tablet.stone) tablet.face.dispose();
            tablets.delete(key);
        }
    }

    function showHash(hash: string | null, seconds: number): void {
        if (hash === shownHash) return;
        const first = shownHash === null;
        shownHash = hash;
        const bits = hashBits(hash);
        dustPrev.array.set(
            first ? Array.from({ length: dustCount }, (_, index) => bits[index % HASH_BITS] ?? 0) : dustBits.array,
        );
        for (let index = 0; index < dustCount; index += 1) dustBits.array[index] = bits[index % HASH_BITS] ?? 0;
        dustBits.needsUpdate = true;
        dustPrev.needsUpdate = true;
        flippedAt = first ? Number.NEGATIVE_INFINITY : seconds;
    }

    function arrange(list: DrawList): void {
        const live = new Set<string>();
        let flash = 0;
        for (const { actor, pose } of list.slabs) {
            live.add(actor.key);
            const { mesh, stone, face } = tabletFor(actor);
            const base = slabBase(pose.offset);
            mesh.visible = pose.presence > 0.001;
            mesh.position.set(base[0], pose.lift, base[2]);
            mesh.scale.set(pose.side, pose.side, pose.thick);
            stone.opacity = pose.presence;
            face.opacity = pose.presence;
            stone.emissiveIntensity = pose.flash * 0.9;
            flash = Math.max(flash, pose.flash);
        }
        forget(live);

        const { eye, target, fovY, aspect, shift } = list.camera;
        camera.fov = (fovY * 180) / Math.PI;
        camera.aspect = aspect;
        camera.position.set(eye[0], eye[1], eye[2]);
        camera.lookAt(target[0], target[1], target[2]);
        camera.setViewOffset(width, height, (-shift.x * width) / 2, (shift.y * height) / 2, width, height);
        const distance = Math.hypot(eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]);
        fog.near = Math.max(1, distance - 0.5);
        fog.far = distance + 14;

        const gathered = Math.min(1, list.fill);
        (outline.material as LineBasicMaterial).opacity = list.ghost * (0.45 + 0.55 * gathered);
        (haze.material as MeshBasicMaterial).opacity = list.ghost * (0.03 + 0.05 * gathered);
        forming.visible = list.ghost > 0.001;
        motes.visible = forming.visible;
        lamp.intensity = list.ghost * (3 + 9 * gathered) + flash * 26;

        const pixels = renderer.domElement.height / Math.tan(fovY / 2);
        showHash(list.hash, list.seconds);
        const mote = moteMaterial.uniforms;
        const speck = dustMaterial.uniforms;
        if (mote.uTime) mote.uTime.value = list.seconds;
        if (mote.uFill) mote.uFill.value = list.fill;
        if (mote.uPixels) mote.uPixels.value = pixels;
        if (mote.uGhost) mote.uGhost.value = list.ghost;
        if (speck.uTime) speck.uTime.value = list.seconds;
        if (speck.uFlip) speck.uFlip.value = list.seconds - flippedAt;
        if (speck.uPixels) speck.uPixels.value = pixels;
        if (speck.uLevel) speck.uLevel.value = list.level;
        if (speck.uFogNear) speck.uFogNear.value = fog.near;
        if (speck.uFogFar) speck.uFogFar.value = fog.far;
    }

    return {
        resize(nextWidth, nextHeight, pixelRatio) {
            width = Math.max(1, nextWidth);
            height = Math.max(1, nextHeight);
            renderer.setPixelRatio(pixelRatio);
            renderer.setSize(width, height, false);
            composer.setPixelRatio(pixelRatio);
            composer.setSize(width, height);
        },
        quality(next) {
            bloom = next.bloom;
            key.castShadow = next.shadows;
        },
        async warm(list) {
            arrange(list);
            // Everything is shown for the build, so no program is left to be made when a tablet first appears.
            for (const { mesh } of tablets.values()) mesh.visible = true;
            forming.visible = true;
            motes.visible = true;
            await renderer.compileAsync(scene, camera);
        },
        draw(list) {
            arrange(list);
            if (bloom) composer.render();
            else renderer.render(scene, camera);
        },
    };
}
