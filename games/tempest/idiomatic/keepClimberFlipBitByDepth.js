// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { TUBE_GEOM_FLAG, ENEMY_SLOT_FLAGS, ENEMY_SEGMENT } from "./names.js";

/**
 * keepClimberFlipBitByDepth — hysteresis on a per-enemy climb bit, keyed to tube depth. ROM 0x9eab.
 *
 * Role in the machine: enemies in the tube carry a bank of per-slot flag bits in loc_283,x; bit6
 * here is the "climber" state that flips the sprite as an enemy travels the well. This routine keeps
 * that bit in step with the slot's segment depth loc_2b9,x, but with hysteresis so it doesn't chatter:
 * the set and clear thresholds sit at opposite ends of the depth range. It only runs while the global
 * tube-geometry gate loc_111 is on (0 means the tube isn't live, so leave the flags untouched).
 *
 * Behavior: bail immediately if loc_111 == 0. Otherwise read the slot's flag byte and its depth.
 * If bit6 is currently set, clear it (mask 0xbf) once depth has climbed to 0x0e or beyond. If bit6
 * is currently clear, set it (mask 0x40) only at the far end, when depth is exactly 0. The gap
 * between the 0x0e clear threshold and the 0 set threshold is the anti-jitter band. Slot chosen by X.
 *
 * Live-out: bit6 of the slot flag byte loc_283,x (set, cleared, or left as-is).
 *
 * Grounding: [seen].
 */
// Per-slot climber bit (bit6 of loc_283,x) with depth hysteresis; only while tube gate loc_111 is on.
export function keepClimberFlipBitByDepth(m, x = m.regs.x) {
  const { mem8 } = m;
  if (mem8[TUBE_GEOM_FLAG] === 0) return; // tube not live: leave the flags alone
  const flag = u16(ENEMY_SLOT_FLAGS + x);
  const depth = mem8[u16(ENEMY_SEGMENT + x)];
  if (mem8[flag] & 0x40) {
    if (depth >= 0x0e) mem8[flag] = mem8[flag] & 0xbf; // clear bit6 at the deep threshold
  } else {
    if (depth === 0) mem8[flag] = mem8[flag] | 0x40;   // set bit6 only at depth 0
  }
}
