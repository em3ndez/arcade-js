// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { tickSpawnCadence } from "./tickSpawnCadence.js";
import { routeSegmentByRange } from "./routeSegmentByRange.js";

/**
 * advanceSegmentSlotLoop -- step down the segment slot index and route to the next slot (or finish).
 *
 * ROM 0x3031. Grounding: [code] (behaviour-read; the slot cursor X is a bare loop index).
 *
 * ROLE IN THE MACHINE. This is the loop tail of the head/range routing pass. `routeSegmentByRange`
 * examines one segment slot X — testing its coarse X-band, its folded horizontal/vertical distance
 * to the head, and its slot class — and dispatches it; when no class matches, control falls here to
 * advance to the next slot. It is the sibling of `advanceSegmentLoopIndex` but for the routing sweep
 * rather than the motion walk: same 6502 `DEX` / `BMI` / loop-back shape, different loop head and
 * different terminal handoff. When the cursor underflows past slot 0 the whole routing sweep is over,
 * so it tail-transfers into `tickSpawnCadence`, the per-slot spawn-cadence stepper that paces when
 * the next centipede segment is spawned.
 *
 * LIVE-OUT. Republishes the decremented cursor into `m.regs.x` for the cyclic router, and returns
 * whichever callee it hands to (the router for another slot, or the spawn-cadence tick at the end).
 */
export function advanceSegmentSlotLoop(m, x = m.regs.x) {
  // Decrement the slot cursor (6502 DEX; u8() wraps 0x00 -> 0xff so bit7 flags underflow).
  const next = u8(x - 1); // dex
  // Underflow past the first slot means every slot has been routed this sweep -> hand the frame to
  // the spawn-cadence tick, which decides whether a new segment spawns.
  if (next & 0x80) return tickSpawnCadence(m); // underflow -> finish the sweep
  // Otherwise republish the cursor and loop back to the per-segment router for the next slot.
  return (m.regs.x = next), routeSegmentByRange(m); // next slot -> per-segment router
}
