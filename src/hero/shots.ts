import { MathUtils, type PerspectiveCamera, Vector3 } from 'three';

export type ShotName = 'edge' | 'field' | 'token';

export interface Insets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface Framing {
    position: Vector3;
    target: Vector3;
    offsetX: number;
    offsetY: number;
}

interface ShotSpec {
    yaw: number;
    pitch: number;
    margin: number;
}

export const SHOTS: Record<ShotName, ShotSpec> = {
    edge: { yaw: -24, pitch: 34, margin: 0.04 },
    field: { yaw: -14, pitch: 46, margin: 0.03 },
    token: { yaw: -38, pitch: 30, margin: 0.18 },
};

const screen = new Vector3();

function direction(yaw: number, pitch: number): Vector3 {
    const y = MathUtils.degToRad(yaw);
    const p = MathUtils.degToRad(pitch);
    return new Vector3(Math.sin(y) * Math.cos(p), Math.sin(p), Math.cos(y) * Math.cos(p));
}

// The fitting idea comes from standing-wave's frameView: aim at the target, then find the
// closest distance at which every point lands inside the screen area the text leaves free.
export function frameShot(
    camera: PerspectiveCamera,
    name: ShotName,
    points: readonly Vector3[],
    width: number,
    height: number,
    insets: Insets,
): Framing {
    const spec = SHOTS[name];
    const free = {
        left: insets.left,
        top: insets.top,
        width: Math.max(1, width - insets.left - insets.right),
        height: Math.max(1, height - insets.top - insets.bottom),
    };
    const offsetX = width / 2 - (free.left + free.width / 2);
    const offsetY = height / 2 - (free.top + free.height / 2);
    camera.aspect = width / height;
    camera.setViewOffset(width, height, offsetX, offsetY, width, height);
    camera.updateProjectionMatrix();

    const target = new Vector3();
    for (const point of points) target.add(point);
    target.divideScalar(Math.max(1, points.length));
    const dir = direction(spec.yaw, spec.pitch);
    const allowed = {
        left: free.left + free.width * spec.margin,
        right: free.left + free.width * (1 - spec.margin),
        top: free.top + free.height * spec.margin,
        bottom: free.top + free.height * (1 - spec.margin),
    };

    const fits = (distance: number) => {
        camera.position.copy(target).addScaledVector(dir, distance);
        camera.lookAt(target);
        camera.updateMatrixWorld();
        for (const point of points) {
            screen.copy(point).project(camera);
            if (screen.z <= -1) return false;
            const x = (screen.x * 0.5 + 0.5) * width;
            const y = (-screen.y * 0.5 + 0.5) * height;
            if (x < allowed.left || x > allowed.right || y < allowed.top || y > allowed.bottom) return false;
        }
        return true;
    };

    let near = 0.5;
    let far = camera.far * 0.8;
    for (let i = 0; i < 32; i += 1) {
        const mid = (near + far) / 2;
        if (fits(mid)) far = mid;
        else near = mid;
    }
    return { position: target.clone().addScaledVector(dir, far), target, offsetX, offsetY };
}
