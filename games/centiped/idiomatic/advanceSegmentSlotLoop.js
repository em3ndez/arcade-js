// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { tickSpawnCadence } from "./tickSpawnCadence.js";
import { routeSegmentByRange } from "./routeSegmentByRange.js";

/**
 * advanceSegmentSlotLoop -- step down the segment slot index and route. Decrements the slot counter;
 * on underflow the sweep is finished and it hands off to the spawn-cadence tick, otherwise it loops
 * back to the per-segment router for the next slot. The decremented index is republished for the
 * cyclic router. [code]
 */
export function advanceSegmentSlotLoop(m, x = m.regs.x) {
  const next = u8(x - 1); // dex
  if (next & 0x80) return tickSpawnCadence(m); // underflow -> finish the sweep
  return (m.regs.x = next), routeSegmentByRange(m); // next slot -> per-segment router
}
