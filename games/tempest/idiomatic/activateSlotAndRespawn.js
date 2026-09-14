// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { HIT_TALLY } from "./names.js";
import { respawnEnemyAndAward } from "./respawnEnemyAndAward.js";

/**
 * activateSlotAndRespawn — flag enemy slot X active, then recycle the slot four lanes back.
 * ROM 0xa38e (lane-band spawn dispatch tail).
 *
 * Role in the machine: this is one of the two exits from the per-frame lane-proximity scan
 * (resolveSlotProximityInteractions). As that scan walks the enemy slots and folds each one's lane
 * position into a distance band, a slot landing in a spawn-eligible band arrives here. The routine
 * marks the current slot X as an active occupant of the lane-spawn bank by stamping its HIT_TALLY
 * cell (0x2f2,x) with 0xff, then hands the actual retire/respawn/score work to respawnEnemyAndAward
 * — but for the slot four lane-indices earlier, not slot X itself. Stepping the index back by four
 * is how the original walks the descriptor bank in fixed strides so a newly-flagged occupant and the
 * slot being recycled stay a fixed distance apart around the tube.
 *
 * Behavior: write 0xff into HIT_TALLY[X] (0x2f2,x) to raise slot X's active flag; compute
 * priorSlot = Y - 4 (wrapped to a byte) as the stepped-back lane index; tail-delegate to
 * respawnEnemyAndAward(m, x, priorSlot), which retires that stepped-back slot, spawns its
 * replacement, and awards score through the lane table. The delegate's return value is returned
 * unchanged — this is a pure tail call, no work happens after it.
 *
 * Live-out: HIT_TALLY[X] = 0xff (slot X now reads as active to the teardown pass, which later clears
 * 0x2f2,x when the slot dies); everything else (spawn state, live-enemy count 0x135, score) is
 * whatever respawnEnemyAndAward leaves behind. Grounding: [seen].
 */
export function activateSlotAndRespawn(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;

  // Raise slot X's active flag in the lane-spawn bank: 0xff marks the slot occupied.
  mem8[u16(HIT_TALLY + x)] = 0xff;
  // Step the lane index back by four (byte-wrapped) — the slot the original recycles this pass.
  const priorSlot = u8(y - 4);
  // Tail-delegate retire/respawn/score for the stepped-back slot; its result is our result.
  return respawnEnemyAndAward(m, x, priorSlot);
}
