import type { BackdropId, Plan } from './types.ts';

const LOADERS: Record<BackdropId, () => Promise<{ plan: Plan }>> = {
    left: () => import('./left.ts'),
    power: () => import('./power.ts'),
    convert: () => import('./convert.ts'),
    dca: () => import('./dca.ts'),
    address: () => import('./address.ts'),
};

const loaded = new Map<BackdropId, Plan>();

/** A tool's plan, if this visit has already fetched it. */
export function knownPlan(id: BackdropId): Plan | null {
    return loaded.get(id) ?? null;
}

export async function loadPlan(id: BackdropId): Promise<Plan> {
    const known = loaded.get(id);
    if (known) return known;
    const { plan } = await LOADERS[id]();
    loaded.set(id, plan);
    return plan;
}
