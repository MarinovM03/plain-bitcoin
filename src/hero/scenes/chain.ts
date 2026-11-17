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
    HemisphereLight,
    LinearFilter,
    LinearMipmapLinearFilter,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    PointLight,
    Points,
    RGBAFormat,
    Scene,
    ShaderMaterial,
    SRGBColorSpace,
    Vector2,
} from 'three';
import { FACE_CELLS, hashBits } from '../../chain/hash.ts';
import { hashMaterial, type Material } from '../../chain/material.ts';
import { CHAIN_DIRECTION, FORMING, SLAB_YAW, slabBase } from '../../chain/view.ts';
import { TOKENS } from '../../styles/tokens.ts';
import type { Actor } from '../actors.ts';
import { type ChainDraw, createDust, GLOW, type Layer, seeds } from '../kit.ts';
import { createPile } from '../pile.ts';

const MOTES = 1500;
const FACE_PIXELS = 256;
const FACE_MARGIN = 0.085;
/** The forming block and its dust hover a hair above the floor, so no two surfaces ever share a depth. */
const HOVER = 0.02;
const KEY: readonly [number, number, number] = [-0.5361, 0.7603, 0.3669];

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

/** The face of a tablet: the stone with one cut cell per set bit, and the same cells as a mask for depth and glow. */
function faceTextures(hash: string, material: Material): { colour: DataTexture; cut: DataTexture } {
    const bits = hashBits(hash);
    const body = channels(material.body);
    const inlay = channels(material.inlay);
    const colour = new Uint8Array(FACE_PIXELS * FACE_PIXELS * 4);
    const cut = new Uint8Array(FACE_PIXELS * FACE_PIXELS * 4);
    // One 32-bit write per pixel, with each row and column's cell worked out once: this runs for every tablet
    // before the first frame, on a phone.
    const colourWords = new Uint32Array(colour.buffer);
    const cutWords = new Uint32Array(cut.buffer);
    const pack = ([red, green, blue]: [number, number, number]) =>
        (0xff000000 | (blue << 16) | (green << 8) | red) >>> 0;
    const stone = pack(body);
    const cell = pack(inlay);
    const cellOf = new Int16Array(FACE_PIXELS);
    for (let pixel = 0; pixel < FACE_PIXELS; pixel += 1) {
        const along = (((pixel + 0.5) / FACE_PIXELS - FACE_MARGIN) / (1 - 2 * FACE_MARGIN)) * FACE_CELLS;
        const inside = along > 0 && along < FACE_CELLS && Math.abs((along % 1) - 0.5) < 0.4;
        cellOf[pixel] = inside ? Math.floor(along) : -1;
    }
    for (let row = 0; row < FACE_PIXELS; row += 1) {
        const cellRow = cellOf[row] ?? -1;
        // Texture rows run bottom to top; the hash reads top to bottom.
        const start = (FACE_PIXELS - 1 - row) * FACE_PIXELS;
        for (let column = 0; column < FACE_PIXELS; column += 1) {
            const cellColumn = cellOf[column] ?? -1;
            const set = cellRow >= 0 && cellColumn >= 0 && bits[cellRow * FACE_CELLS + cellColumn] === 1;
            colourWords[start + column] = set ? cell : stone;
            cutWords[start + column] = set ? 0xffffffff : 0xff000000;
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

/**
 * The world behind every page: the last eight real blocks as lit tablets, the next one forming at the front, and
 * the converter's stack of points on the floor before it.
 */
export function create(): Layer {
    const scene = new Scene();
    const ink = new Color(TOKENS.void);
    scene.background = ink;
    const fog = new Fog(ink, 5, 20);
    scene.fog = fog;
    const camera = new PerspectiveCamera(32, 1, 0.1, 80);

    const middle = slabBase(4.5);
    const sky = new HemisphereLight(0x8fa4c8, 0x2a1c10, 0.5);
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
    const rim = new DirectionalLight(0x6f9bd8, 0.7);
    rim.position.set(middle[0] + 6, 4, middle[2] - 9);
    rim.target.position.set(middle[0], 0.4, middle[2]);
    const lamp = new PointLight(TOKENS.btc, 0, 9, 1.6);
    lamp.position.set(-0.15, 0.8, 0.45);
    scene.add(sky, key, key.target, rim, rim.target, lamp);

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
    // Nothing ever stands in front of the forming block, so its outline skips the depth test: an edge that shares
    // a depth with the floor can then never flicker as the camera drifts.
    const edges = new EdgesGeometry(box);
    const outline = new LineSegments(
        edges,
        new LineBasicMaterial({ color: GLOW, transparent: true, opacity: 0, depthWrite: false, depthTest: false }),
    );
    const haze = new Mesh(
        box,
        new MeshBasicMaterial({
            color: TOKENS.btc,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            depthTest: false,
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

    const dust = createDust({
        centre: middle,
        axis: CHAIN_DIRECTION,
        across: [-CHAIN_DIRECTION[2], 0, CHAIN_DIRECTION[0]],
    });
    const pile = createPile();
    scene.add(dust.points, pile.points);

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

    function drop(tablet: Tablet): void {
        scene.remove(tablet.mesh);
        for (const texture of tablet.textures) texture.dispose();
        tablet.stone.dispose();
        if (tablet.face !== tablet.stone) tablet.face.dispose();
    }

    function forget(live: ReadonlySet<string>): void {
        for (const [key, tablet] of tablets) {
            if (live.has(key)) continue;
            drop(tablet);
            tablets.delete(key);
        }
    }

    function arrange(list: ChainDraw, width: number, height: number): number {
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
        outline.material.opacity = list.ghost * (0.45 + 0.55 * gathered);
        haze.material.opacity = list.ghost * (0.03 + 0.05 * gathered);
        forming.visible = list.ghost > 0.001;
        motes.visible = forming.visible;
        lamp.intensity = list.ghost * (3 + 9 * gathered) + flash * 26;
        return fovY;
    }

    return {
        scene,
        camera,
        prepare() {
            for (const { mesh } of tablets.values()) mesh.visible = true;
            forming.visible = true;
            motes.visible = true;
            pile.points.visible = true;
        },
        textures: () => [...tablets.values()].flatMap((tablet) => tablet.textures),
        shadows(on) {
            key.castShadow = on;
        },
        update(tick) {
            const fovY = arrange(tick.chain, Math.max(1, tick.width), Math.max(1, tick.height));
            const pixels = tick.pixels / Math.tan(fovY / 2);
            const mote = moteMaterial.uniforms;
            if (mote.uTime) mote.uTime.value = tick.seconds;
            if (mote.uFill) mote.uFill.value = tick.chain.fill;
            if (mote.uPixels) mote.uPixels.value = pixels;
            if (mote.uGhost) mote.uGhost.value = tick.chain.ghost;
            dust.update(tick, pixels, 1, fog);
            pile.update(tick, pixels);
        },
        dispose() {
            for (const tablet of tablets.values()) drop(tablet);
            tablets.clear();
            floor.geometry.dispose();
            floor.material.dispose();
            box.dispose();
            edges.dispose();
            outline.material.dispose();
            haze.material.dispose();
            moteGeometry.dispose();
            moteMaterial.dispose();
            key.shadow.map?.dispose();
            dust.dispose();
            pile.dispose();
        },
    };
}
