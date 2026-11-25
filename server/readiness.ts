/**
 * Which drawing apps can be used right now. Each pair (engine) is checked on its own at startup; the agent
 * runs when at least one pair is ready, and a job for a pair that is not ready is refused with that pair's reason.
 */
import { ENGINES, engineOf, type EngineId } from '../src/state/engines';
import type { RunnerKind } from '../src/state/production';

export interface EngineReadiness { ok: boolean; detail: string }
export type EnginesReadiness = Record<EngineId, EngineReadiness>;

export function combineReadiness(adobe: EngineReadiness, craft: EngineReadiness): { runner: RunnerKind; engines: EnginesReadiness; detail: string } {
  const engines: EnginesReadiness = { adobe: { ok: adobe.ok, detail: adobe.detail }, craft: { ok: craft.ok, detail: craft.detail } };
  // The ready pair first, so the designer reads what works before what doesn't.
  const order = (Object.keys(engines) as EngineId[]).sort((a, b) => Number(engines[b].ok) - Number(engines[a].ok));
  return { runner: adobe.ok || craft.ok ? 'claude' : 'off', engines, detail: order.map((e) => engines[e].detail).filter(Boolean).join(' ') };
}

/** null when the job may be drawn, else why not. Only the real agent needs the apps; mock and off never refuse. */
export function engineRefusal(runner: RunnerKind, engines: EnginesReadiness, engine: unknown): string | null {
  if (runner !== 'claude') return null;
  const e = engineOf(engine);
  const r = engines[e.id];
  return r.ok ? null : `${ENGINES[e.id].label} is not ready on this computer: ${r.detail} Pick the other drawing apps, or fix this and restart the studio app.`;
}
