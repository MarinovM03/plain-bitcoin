import type { SceneData, SceneId } from '../../gauges/types.ts';
import type { Mat4, Vec3 } from '../gfx/math.ts';
import type { Bounds, Mesh } from '../gfx/mesh.ts';

export type { SceneData, SceneId } from '../../gauges/types.ts';

/** One solid part of a scene, drawn once per frame. */
export interface Item {
    mesh: Mesh;
    model: Mat4;
    color: Vec3;
    /** The part this belongs to: what the pointer picks and the highlight lights. */
    part?: string;
    /** For a cell grid: cells below `count` take `color` of the fill; cells at or past `visible` are not drawn. */
    fill?: { count: number; color: Vec3; visible?: number };
    /** 0..1 extra light from the material itself (a seated pin, the active seam). */
    glow?: number;
    /** Pickable but not drawn: an exact region of a part that is drawn as one merged mesh. */
    hidden?: boolean;
    /** Drawn but never picked: a merged mesh whose regions are picked through hidden boxes instead. */
    inert?: boolean;
}

/** An engraved label, drawn as DOM at a projected point so it stays crisp at any size. */
export interface Tag {
    id: string;
    text: string;
    at: Vec3;
    tone?: 'ink' | 'dim' | 'btc' | 'cool';
    align?: 'start' | 'middle' | 'end';
}

/** A soft contact shadow on the ground under an object, baked as an ellipse: no shadow maps. */
export interface Shadow {
    x: number;
    z: number;
    rx: number;
    rz: number;
    strength: number;
}

export interface Ground {
    y: number;
    /** Ground disc centre and how far its lit pool reaches before it fades into the plate. */
    x: number;
    z: number;
    radius: number;
}

export interface Frame {
    items: Item[];
    tags: Tag[];
    shadows: Shadow[];
    ground: Ground | null;
}

export interface CameraSpec {
    kind: 'perspective' | 'ortho';
    target: Vec3;
    /** Home pose, radians. The pointer turns the scene away from this and it eases back. */
    yaw: number;
    pitch: number;
    /** Vertical field of view, radians (perspective only). */
    fov: number;
    /** Box that must fit the window at the home pose. */
    fit: Bounds;
    /** Share of the window the fitted box may fill, 0..1. */
    fill: number;
    /** How far the pointer may turn the scene, radians. */
    maxYaw: number;
    maxPitch: number;
}

export interface PartInfo {
    id: string;
    label: string;
}

export interface View {
    width: number;
    height: number;
}

/**
 * A scene is one handcrafted object for one route. It owns its geometry and its settle animation; the host owns the
 * camera orbit, picking, highlight and frame loop. Every size and count it draws comes from the bus payload.
 */
export interface Scene {
    readonly id: SceneId;
    /** One plain line saying what the model is and how to read it; shown under the scene while it is drawn. */
    readonly about: string;
    camera(view: View): CameraSpec;
    /** A new payload. `instant` lands on the target with no tween (first show, reduced motion). */
    set(data: SceneData, instant: boolean): void;
    /** Advance tweens; true while anything still moves. */
    step(dt: number): boolean;
    frame(view: View, hovered: string | null): Frame;
    /** Keyboard-reachable parts, the accessible twin of picking. */
    parts(): PartInfo[];
    describe(part: string): string;
    /** A short, plain account of the settled state, compared with the DOM answer in tests. */
    summary(): string;
    /** A real new block arrived. */
    pulse(): void;
    /** A tap (or a click on the part's button) on a part; a route to open, or null. */
    tap?(part: string): string | null;
}

export type SceneFactory = (reduced: () => boolean) => Scene;
