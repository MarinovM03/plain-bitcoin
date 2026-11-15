import { Color, Scene } from 'three';
import type { BackdropData, BackdropId, Plan } from '../../backdrop/types.ts';
import { TOKENS } from '../../styles/tokens.ts';
import { aimToolCamera, createDust, createMarks, type Layer, type Tick, toolCamera, VIEW } from '../kit.ts';

export interface Recipe {
    id: BackdropId;
    /** The most marks the plan can ever hold. */
    capacity: number;
    plan: Plan;
    /** GLSL run for every mark; see `createMarks`. */
    motion: string;
    /** Seconds over which a changed plan sweeps through its marks, first to last. */
    stagger: number;
    /** How strongly the hash squares show behind the picture, 0 to 1. */
    dust: number;
    /** Four numbers of the scene's own for its motion, worked out each frame. */
    extra?(tick: Tick, data: BackdropData | null, aspect: number): readonly [number, number, number, number];
}

const NONE = [0, 0, 0, 0] as const;

/**
 * A tool's scene: its marks in front, the hash squares behind, one fixed camera. Every tool is built this way, so
 * they share one light and one dust and differ only in what their own numbers draw.
 */
export function createField(recipe: Recipe): Layer {
    const scene = new Scene();
    scene.background = new Color(TOKENS.void);
    const camera = toolCamera();
    const marks = createMarks(recipe.capacity, recipe.motion, recipe.stagger);
    const dust = createDust({ centre: [0, -4.2, -2], axis: [1, 0, 0], across: [0, 0, 1] });
    scene.add(dust.points, marks.mesh);
    let planned: BackdropData | null | undefined;
    let plannedAspect = 0;

    return {
        scene,
        camera,
        update(tick) {
            const aspect = aimToolCamera(camera, tick);
            const data = tick.data?.id === recipe.id ? tick.data : null;
            if (data !== planned || Math.abs(aspect - plannedAspect) > 0.001) {
                marks.show(recipe.plan(data, aspect), tick.seconds);
                planned = data;
                plannedAspect = aspect;
            }
            marks.update(tick, aspect, recipe.extra?.(tick, data, aspect) ?? NONE);
            dust.update(tick, tick.pixels / Math.tan((VIEW.fov * Math.PI) / 360), recipe.dust, { near: 14, far: 30 });
        },
        dispose() {
            marks.dispose();
            dust.dispose();
        },
    };
}
