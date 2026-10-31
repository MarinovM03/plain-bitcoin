import {
    ACESFilmicToneMapping,
    AdditiveBlending,
    BoxGeometry,
    type BufferGeometry,
    Color,
    DirectionalLight,
    Float32BufferAttribute,
    Fog,
    HemisphereLight,
    InstancedMesh,
    LinearSRGBColorSpace,
    MathUtils,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    MeshStandardMaterial,
    PerspectiveCamera,
    PlaneGeometry,
    PMREMGenerator,
    PointLight,
    Quaternion,
    RingGeometry,
    Scene,
    type Texture,
    Vector3,
    WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TOKENS } from '../styles/tokens.ts';
import { hexToSrgb, inverseAces, type Rgb, srgbToLinear } from './aces.ts';
import { type CoinShape, coinGeometry, wedgeGeometry } from './geometry.ts';
import {
    BASE_DEPTH,
    type FieldLayout,
    fieldLayout,
    TOKEN_COUNT,
    TOKEN_HEIGHT,
    TOKEN_RADIUS,
    type TokenState,
    tokensBounds,
} from './layout.ts';
import type { Scene as Playable } from './playback.ts';
import type { Post } from './post.ts';
import { type Framing, frameShot, type Insets, type ShotName } from './shots.ts';
import { ContactShadow, coinFaceTexture, glowTexture } from './textures.ts';
import { isSoftwareRenderer } from './tier.ts';
import { damp, ease, Tweens } from './tween.ts';

export type WebGlTier = 'full' | 'phone';

export class SoftwareRendererError extends Error {
    override name = 'SoftwareRendererError';
}

export type SceneCanvas = HTMLCanvasElement | OffscreenCanvas;

export interface SceneSize {
    width: number;
    height: number;
    pixelRatio: number;
    insets: Insets;
}

export interface SceneInit {
    tier: WebGlTier;
    allowSoftware: boolean;
    shot: ShotName;
    tokens: TokenState;
    reducedMotion: boolean;
    size: SceneSize;
}

export interface SceneControl extends Playable {
    resize(size: SceneSize): void;
    setTokens(tokens: TokenState, arrived: boolean): void;
    setTilt(x: number, y: number): void;
}

interface TierSettings {
    segments: number;
    chamfer: number;
    ringSegments: number;
    shadowWidth: number;
    environmentSize: number;
    startRatio: number;
    maxRatio: number;
}

const TIERS: Record<WebGlTier, TierSettings> = {
    full: {
        segments: 24,
        chamfer: 0.035,
        ringSegments: 24,
        shadowWidth: 2048,
        environmentSize: 128,
        startRatio: 1.5,
        maxRatio: 1.5,
    },
    phone: {
        segments: 9,
        chamfer: 0,
        ringSegments: 12,
        shadowWidth: 1024,
        environmentSize: 64,
        startRatio: 1,
        maxRatio: 1.25,
    },
};

const MIN_RATIO = 0.75;
const DRIFT_SECONDS = 36;
const DRIFT_YAW = 3.5;
const DRIFT_PITCH = 1.2;
const TILT_YAW = 2.5;
const TILT_PITCH = 1.5;
const SLIVER_DROP = 2.6;
const POOL_OPACITY = 0.48;
const PULSE_BASE = 4;
const UP = new Vector3(0, 1, 0);

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// Workers get requestAnimationFrame only alongside OffscreenCanvas, and not in every engine.
const nextFrame: (callback: (now: number) => void) => number =
    typeof requestAnimationFrame === 'function'
        ? (callback) => requestAnimationFrame(callback)
        : (callback) => setTimeout(() => callback(performance.now()), 16) as unknown as number;
const cancelFrame: (id: number) => void =
    typeof cancelAnimationFrame === 'function' ? (id) => cancelAnimationFrame(id) : (id) => clearTimeout(id);

function color(hex: string): Color {
    return new Color(hex);
}

function mix(a: string, b: string, t: number): Color {
    return color(a).lerp(color(b), t);
}

function linearColor(rgb: Rgb): Color {
    return new Color().setRGB(rgb[0], rgb[1], rgb[2], LinearSRGBColorSpace);
}

function random(seed: number): number {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}

function tokenPosition(layout: FieldLayout, i: number, target: Vector3): Vector3 {
    const index = Math.min(TOKEN_COUNT - 1, Math.max(0, i));
    return target.set(
        layout.positions[index * 2] ?? 0,
        (layout.heights[index] ?? 0) + TOKEN_HEIGHT / 2,
        layout.positions[index * 2 + 1] ?? 0,
    );
}

function slabGeometry(layout: FieldLayout): { sides: BufferGeometry; tops: BufferGeometry } {
    const sides: BufferGeometry[] = [];
    const tops: BufferGeometry[] = [];
    for (const block of layout.blocks) {
        if (block.w < 0.05 || block.d < 0.05) continue;
        const height = block.top + BASE_DEPTH;
        const box = new BoxGeometry(block.w, height, block.d);
        box.translate(block.x + block.w / 2, block.top - height / 2, block.z + block.d / 2);
        sides.push(box);
        const top = new PlaneGeometry(block.w, block.d);
        top.rotateX(-Math.PI / 2);
        top.translate(block.x + block.w / 2, block.top + 0.002, block.z + block.d / 2);
        const position = top.getAttribute('position');
        const uv: number[] = [];
        for (let v = 0; v < position.count; v += 1) {
            uv.push(
                (position.getX(v) + layout.width / 2) / layout.width,
                1 - (position.getZ(v) + layout.depth / 2) / layout.depth,
            );
        }
        top.setAttribute('uv', new Float32BufferAttribute(uv, 2));
        tops.push(top);
    }
    const merged = { sides: mergeGeometries(sides), tops: mergeGeometries(tops) };
    for (const geometry of [...sides, ...tops]) geometry.dispose();
    return merged;
}

export async function createScene(canvas: SceneCanvas, options: SceneInit): Promise<SceneControl> {
    const settings = TIERS[options.tier];
    const full = options.tier === 'full';
    const layout = fieldLayout();
    let tokens = options.tokens;

    const renderer = new WebGLRenderer({
        canvas,
        antialias: !full,
        powerPreference: 'high-performance',
        stencil: false,
    });
    if (!options.allowSoftware && isSoftwareRenderer(renderer.getContext())) {
        renderer.dispose();
        throw new SoftwareRendererError();
    }
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    const background = hexToSrgb(TOKENS.inkRaised);
    const backgroundLinear = background.map(srgbToLinear) as unknown as Rgb;
    const sceneBackground = linearColor(full ? inverseAces(backgroundLinear) : backgroundLinear);

    const scene = new Scene();
    scene.background = sceneBackground;
    scene.fog = new Fog(sceneBackground, 40, 300);

    const buildEnvironment = (): Texture => {
        const pmrem = new PMREMGenerator(renderer);
        const environment = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, {
            size: settings.environmentSize,
        }).texture;
        pmrem.dispose();
        return environment;
    };
    await nextTask();
    scene.environment = buildEnvironment();
    scene.environmentIntensity = 0.4;

    const key = new DirectionalLight(mix(TOKENS.paper, TOKENS.btc, 0.28), 2.9);
    key.position.set(-60, 90, 70);
    const rim = new DirectionalLight(color(TOKENS.fiat), 2.1);
    rim.position.set(55, 28, -90);
    const kicker = new DirectionalLight(mix(TOKENS.btc, TOKENS.paper, 0.45), 0.8);
    kicker.position.set(40, 18, 110);
    const fill = new HemisphereLight(color(TOKENS.line), color(TOKENS.ink), 0.55);
    scene.add(key, rim, kicker, fill);

    await nextTask();
    const faceTexture = coinFaceTexture();
    const glow = glowTexture();
    const shadow = new ContactShadow(layout, settings.shadowWidth);
    shadow.draw(tokens.full);

    const slabs = slabGeometry(layout);
    const slabSide = new MeshStandardMaterial({ color: mix(TOKENS.line, TOKENS.ink, 0.35), roughness: 0.92 });
    const slabTop = new MeshStandardMaterial({
        color: mix(TOKENS.line, TOKENS.inkRaised, 0.25),
        roughness: 0.85,
        map: shadow.texture,
    });
    const ground = new Mesh(
        new PlaneGeometry(900, 900),
        new MeshStandardMaterial({ color: color(TOKENS.ink), roughness: 1 }),
    );
    ground.rotateX(-Math.PI / 2);
    ground.position.y = -BASE_DEPTH;
    scene.add(new Mesh(slabs.sides, slabSide), new Mesh(slabs.tops, slabTop), ground);

    await nextTask();
    const shape: CoinShape = {
        radius: TOKEN_RADIUS,
        height: TOKEN_HEIGHT,
        chamfer: settings.chamfer,
        segments: settings.segments,
    };
    const coinFace = new MeshStandardMaterial({ map: faceTexture, metalness: 0.9, roughness: 0.36 });
    const coinEdge = new MeshStandardMaterial({ metalness: 0.95, roughness: 0.28 });
    const coin = coinGeometry(shape);
    const solid = new InstancedMesh(coin, [coinFace, coinEdge], TOKEN_COUNT);

    const ringGeometry = new RingGeometry(TOKEN_RADIUS * 0.82, TOKEN_RADIUS, settings.ringSegments, 1);
    ringGeometry.rotateX(-Math.PI / 2);
    const ringMaterial = new MeshBasicMaterial({
        color: color(TOKENS.paper),
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
    });
    const outlines = new InstancedMesh(ringGeometry, ringMaterial, TOKEN_COUNT);

    const matrix = new Matrix4();
    const turn = new Quaternion();
    const scale = new Vector3(1, 1, 1);
    const at = new Vector3();
    const old = color(TOKENS.btc).lerp(color(TOKENS.ink), 0.42);
    const fresh = color(TOKENS.btc).lerp(color(TOKENS.paper), 0.08);
    const tint = new Color();
    for (let i = 0; i < TOKEN_COUNT; i += 1) {
        tokenPosition(layout, i, at);
        turn.setFromAxisAngle(UP, random(i + 1) * Math.PI * 2);
        solid.setMatrixAt(i, matrix.compose(at, turn, scale));
        const era = layout.eras[i] ?? 0;
        tint.copy(old)
            .lerp(fresh, Math.min(1, era / 4))
            .multiplyScalar(0.92 + random(i + 7) * 0.16);
        solid.setColorAt(i, tint);
        at.y = (layout.heights[i] ?? 0) + 0.012;
        outlines.setMatrixAt(TOKEN_COUNT - 1 - i, matrix.compose(at, turn.identity(), scale));
    }
    solid.computeBoundingSphere();
    outlines.computeBoundingSphere();
    scene.add(solid, outlines);

    const partialFace = coinFace.clone();
    const partialEdge = coinEdge.clone();
    for (const material of [partialFace, partialEdge]) {
        material.color = fresh.clone();
        material.emissive = color(TOKENS.btc);
        material.emissiveIntensity = 0.22;
    }
    const partial = new Mesh(wedgeGeometry(shape, 0, Math.PI * 2), [partialFace, partialEdge]);
    const marker = new Mesh(
        new RingGeometry(TOKEN_RADIUS * 1.18, TOKEN_RADIUS * 1.32, 48, 1).rotateX(-Math.PI / 2),
        new MeshBasicMaterial({ color: color(TOKENS.btc).multiplyScalar(1.6), transparent: true, depthWrite: false }),
    );
    const pool = new Mesh(
        new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        new MeshBasicMaterial({
            map: glow,
            color: color(TOKENS.btc),
            transparent: true,
            opacity: POOL_OPACITY,
            blending: AdditiveBlending,
            depthWrite: false,
        }),
    );
    pool.scale.setScalar(4.2);
    const sliverMaterial = new MeshBasicMaterial({ color: color(TOKENS.btc).multiplyScalar(3) });
    const sliver = new Mesh(wedgeGeometry(shape, 0, 0.02), [sliverMaterial, sliverMaterial]);
    const pulse = new PointLight(mix(TOKENS.btc, TOKENS.paper, 0.3), PULSE_BASE, 9, 2);
    scene.add(partial, marker, pool, sliver);
    if (full) scene.add(pulse);

    const poolMaterial = pool.material;
    const camera = new PerspectiveCamera(30, 1, 0.5, 900);

    let post: Post | null = null;
    if (full) {
        const { createPost, GLOW_LAYER } = await import('./post.ts');
        for (const object of [marker, sliver]) object.layers.enable(GLOW_LAYER);
        post = createPost(renderer, scene, camera, background);
    }

    const tokenAt = new Vector3();
    function placeTokens(): void {
        solid.count = tokens.full;
        outlines.count = TOKEN_COUNT - tokens.full;
        const hasPartial = tokens.full < TOKEN_COUNT;
        for (const object of [partial, marker, pool]) object.visible = hasPartial;
        if (!hasPartial) return;
        tokenPosition(layout, tokens.full, tokenAt);
        const sweep = Math.max(0.001, tokens.partial * Math.PI * 2);
        partial.geometry.dispose();
        partial.geometry = wedgeGeometry(shape, 0, sweep);
        partial.position.copy(tokenAt);
        marker.position.set(tokenAt.x, tokenAt.y - TOKEN_HEIGHT / 2 + 0.014, tokenAt.z);
        pool.position.set(tokenAt.x, tokenAt.y - TOKEN_HEIGHT / 2 + 0.02, tokenAt.z);
        pulse.position.set(tokenAt.x, tokenAt.y + 1.4, tokenAt.z);
        shadow.draw(tokens.full);
    }
    placeTokens();
    sliver.visible = false;

    let { width, height, insets } = options.size;
    let ratio = Math.min(options.size.pixelRatio, settings.startRatio);
    let maxRatio = Math.min(options.size.pixelRatio, settings.maxRatio);
    const framings = new Map<ShotName, Framing>();

    function shotPoints(name: ShotName): Vector3[] {
        const points: Vector3[] = [];
        const corners = (x: number, z: number, w: number, d: number, ys: number[]) => {
            for (const y of ys) {
                points.push(new Vector3(x, y, z), new Vector3(x + w, y, z), new Vector3(x, y, z + d));
                points.push(new Vector3(x + w, y, z + d));
            }
        };
        const top = (layout.blocks.at(-1)?.top ?? 0) + TOKEN_HEIGHT;
        if (name === 'field') {
            corners(-layout.width / 2, -layout.depth / 2, layout.width, layout.depth, [0, top]);
            return points;
        }
        const current = Math.min(TOKEN_COUNT - 1, tokens.full);
        if (name === 'token') {
            tokenPosition(layout, current, tokenAt);
            corners(tokenAt.x - 2, tokenAt.z - 2, 4, 4, [tokenAt.y - 0.2, tokenAt.y + 0.4]);
            return points;
        }
        const region = tokensBounds(layout, current);
        corners(region.x - 1, region.z - 1, region.w + 2, region.d + 2, [layout.heights[current] ?? 0, top]);
        return points;
    }

    function frameAll(): void {
        camera.fov = width / height < 0.8 ? 38 : 30;
        for (const name of ['edge', 'field', 'token'] as const) {
            framings.set(name, frameShot(camera, name, shotPoints(name), width, height, insets));
        }
    }

    const base: ShotName = options.shot;
    let from: Framing | null = null;
    let to: ShotName = base;
    let blend = 1;
    const look = new Vector3();
    const offset = new Vector3();
    const right = new Vector3();
    let driftTime = options.reducedMotion ? DRIFT_SECONDS : 0;
    const tilt = { yaw: 0, pitch: 0, goalYaw: 0, goalPitch: 0 };

    function pose(): void {
        const goal = framings.get(to);
        if (!goal) return;
        const start = from ?? goal;
        const t = from ? blend : 1;
        look.lerpVectors(start.target, goal.target, t);
        offset.lerpVectors(start.position, goal.position, t).sub(look);
        const envelope = Math.sin((Math.PI * Math.min(driftTime, DRIFT_SECONDS)) / DRIFT_SECONDS) ** 2;
        const phase = (driftTime / DRIFT_SECONDS) * Math.PI * 2 * 1.4;
        const yaw = DRIFT_YAW * envelope * Math.sin(phase) + tilt.yaw;
        const pitch = DRIFT_PITCH * envelope * Math.sin(phase * 0.7) + tilt.pitch;
        offset.applyAxisAngle(UP, MathUtils.degToRad(yaw));
        right.crossVectors(UP, offset).normalize();
        offset.applyAxisAngle(right, MathUtils.degToRad(-pitch));
        camera.position.copy(look).add(offset);
        camera.lookAt(look);
        const offsetX = MathUtils.lerp(start.offsetX, goal.offsetX, t);
        const offsetY = MathUtils.lerp(start.offsetY, goal.offsetY, t);
        camera.setViewOffset(width, height, offsetX, offsetY, width, height);
        camera.updateProjectionMatrix();
        const distance = offset.length();
        const fog = scene.fog as Fog;
        fog.near = distance * 0.8;
        fog.far = distance * 1.8;
    }

    function applySize(): void {
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
        post?.setSize(width, height, ratio);
    }

    function resize(size: SceneSize): void {
        width = Math.max(1, Math.round(size.width));
        height = Math.max(1, Math.round(size.height));
        insets = size.insets;
        maxRatio = Math.min(size.pixelRatio, settings.maxRatio);
        ratio = Math.min(ratio, maxRatio);
        applySize();
        frameAll();
        pose();
    }

    const tweens = new Tweens();
    let raf = 0;
    let allowed = false;
    let lost = false;
    let last = 0;
    let avgDt = 1 / 60;
    let slowFor = 0;
    let fastFor = 0;
    let settle = 1.5;

    // Adapted from coin-table's adaptive render scale: step down on long frames, back up after a smooth spell.
    function adapt(dt: number): void {
        if (settle > 0) {
            settle -= dt;
            return;
        }
        avgDt += (Math.min(dt, 0.25) - avgDt) * (1 - Math.exp(-dt / 0.4));
        slowFor = avgDt > 1 / 50 ? slowFor + dt : Math.max(0, slowFor - dt * 0.5);
        fastFor = avgDt < 1 / 57 ? fastFor + dt : 0;
        if (slowFor > 1.5 && ratio > MIN_RATIO) {
            maxRatio = Math.max(MIN_RATIO, ratio - 0.25);
            setRatio(ratio - 0.25);
        } else if (fastFor > 8 && ratio < maxRatio) {
            setRatio(ratio + 0.25);
        }
    }

    function setRatio(next: number): void {
        ratio = Math.min(maxRatio, Math.max(MIN_RATIO, next));
        applySize();
        slowFor = 0;
        fastFor = 0;
        avgDt = 1 / 60;
        settle = 0.75;
    }

    function draw(): void {
        if (lost) return;
        if (post) post.render();
        else renderer.render(scene, camera);
    }

    function animating(): boolean {
        const tilting = Math.abs(tilt.yaw - tilt.goalYaw) + Math.abs(tilt.pitch - tilt.goalPitch) > 0.002;
        return tweens.busy || driftTime < DRIFT_SECONDS || tilting;
    }

    function frame(now: number): void {
        raf = 0;
        const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
        last = now;
        tweens.tick(dt);
        if (driftTime < DRIFT_SECONDS) driftTime = Math.min(DRIFT_SECONDS, driftTime + dt);
        const k = damp(4, dt);
        tilt.yaw += (tilt.goalYaw - tilt.yaw) * k;
        tilt.pitch += (tilt.goalPitch - tilt.pitch) * k;
        pose();
        draw();
        if (dt > 0) adapt(dt);
        if (animating()) request();
        else last = 0;
    }

    function request(): void {
        if (!allowed || lost || raf) return;
        raf = nextFrame(frame);
    }

    function moveTo(name: ShotName, duration: number, delay = 0): void {
        let started = false;
        tweens.run({
            duration,
            delay,
            ease: ease.inOutCubic,
            update: (t) => {
                if (!started) {
                    started = true;
                    from = framings.get(to) ?? null;
                    to = name;
                }
                blend = t;
            },
            done: () => {
                from = null;
                blend = 1;
            },
        });
    }

    function landSliver(next: TokenState, arriving: number): void {
        tokenPosition(layout, tokens.full, tokenAt);
        const startAngle = tokens.partial * Math.PI * 2;
        sliver.geometry.dispose();
        sliver.geometry = wedgeGeometry(shape, startAngle, Math.max(0.012, arriving * Math.PI * 2));
        sliver.position.set(tokenAt.x, tokenAt.y + SLIVER_DROP, tokenAt.z);
        const landY = tokenAt.y;
        tweens.run({
            delay: 1.5,
            duration: 1.05,
            ease: ease.inCubic,
            update: (t) => {
                sliver.visible = true;
                sliver.position.y = landY + SLIVER_DROP * (1 - t);
            },
            done: () => {
                sliver.visible = false;
                tokens = next;
                placeTokens();
                frameAll();
                tweens.run({
                    duration: 2.2,
                    ease: ease.outCubic,
                    update: (t) => {
                        const glowing = Math.sin(Math.min(1, t * 6) * Math.PI * 0.5) * (1 - t);
                        poolMaterial.opacity = POOL_OPACITY + glowing * 0.9;
                        pulse.intensity = PULSE_BASE + glowing * 28;
                    },
                });
            },
        });
    }

    const control: SceneControl = {
        start() {
            allowed = true;
            request();
        },
        stop() {
            allowed = false;
            if (raf) cancelFrame(raf);
            raf = 0;
            last = 0;
        },
        setTokens(next, arrived) {
            const before = tokens;
            const arriving = next.full - before.full + (next.partial - before.partial);
            if (!arrived || arriving <= 0 || options.reducedMotion || !allowed) {
                tweens.finish();
                tokens = next;
                placeTokens();
                frameAll();
                pose();
                request();
                if (!allowed) draw();
                return;
            }
            tweens.finish();
            frameAll();
            moveTo('token', 1.8);
            landSliver(next, Math.min(arriving, 1 - before.partial));
            moveTo(base, 2.4, 4.6);
            request();
        },
        resize(size) {
            resize(size);
            if (allowed) request();
            else draw();
        },
        setTilt(x, y) {
            if (options.reducedMotion) return;
            tilt.goalYaw = x * TILT_YAW;
            tilt.goalPitch = y * TILT_PITCH;
            request();
        },
        dispose() {
            control.stop();
            post?.dispose();
            scene.traverse((object) => {
                const mesh = object as Mesh;
                if (!mesh.isMesh) return;
                mesh.geometry.dispose();
                for (const material of [mesh.material].flat()) material.dispose();
            });
            for (const texture of [faceTexture, glow, shadow.texture, scene.environment]) texture?.dispose();
            renderer.dispose();
        },
    };

    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        lost = true;
        if (raf) cancelFrame(raf);
        raf = 0;
    });
    canvas.addEventListener('webglcontextrestored', () => {
        lost = false;
        scene.environment?.dispose();
        scene.environment = buildEnvironment();
        for (const texture of [faceTexture, glow, shadow.texture]) texture.needsUpdate = true;
        applySize();
        draw();
        request();
    });

    await nextTask();
    resize(options.size);
    await nextTask();
    sliver.visible = true;
    const target = post?.compileTarget() ?? null;
    renderer.setRenderTarget(target);
    if (renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(scene, camera);
    else renderer.compile(scene, camera);
    renderer.setRenderTarget(null);
    sliver.visible = false;
    draw();
    return control;
}
