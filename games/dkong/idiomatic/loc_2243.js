// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2243 — has Mario reached the target position? a three-condition hit test.
 * ROM 0x2243.
 *
 * Called from the sub_2207 state machine (its loc_2227 / loc_2259 arms), each of
 * which points at one byte of an object record — the object's target X — and asks
 * whether Mario has arrived there. Three conditions must all hold for a HIT:
 *
 *   1. MARIO_Y is under REACH_Y — Mario is in the reach band low on the playfield;
 *      higher up the hit never registers.
 *   2. MARIO_AIRBORNE is clear — the hit only counts with Mario grounded, not
 *      mid jump or fall.
 *   3. MARIO_X exactly equals the object's target X (the byte the caller points at).
 *
 * On a HIT the routine reports true and the caller runs its own tail (which stamps
 * its follow-up state). On any miss it reports the "no hit" signal by returning
 * loc_2257 — the shared caller-skip tail — which is false, so the caller propagates
 * the skip (`if (!loc_2243(m)) return;`) and its tail never runs. The false result
 * therefore unwinds two levels up, exactly as the oracle's stack drop does.
 *
 * A near-LEAF: it reads three Mario cells plus the caller's target byte, writes no
 * memory, and hands off only to the no-hit tail. Its input is the target pointer the
 * caller leaves in place; that stays a register read because its callers are still
 * the frozen oracle (a genuine oracle boundary), to be promoted to a real parameter
 * once loc_2227 / loc_2259 are idiomatic.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2243.test.js.
 * GATE:     factored-exhaustive + realism. The result is a pure function of three
 *           decisions (MARIO_Y vs REACH_Y, MARIO_AIRBORNE == 0, MARIO_X == target),
 *           so four 256-wide sweeps over a real attract base cover every branch of
 *           each decision independently — the Y threshold at every value (both sides
 *           of the boundary), the airborne gate at every value, target-match against
 *           a fixed X, and equality across every X. Plus real captured in-play states
 *           from the reachable ancestor sub_2207 (0x2243 itself never dispatches in
 *           attract). Every case: no RAM written, same hit/no-hit signal. Teeth: a
 *           dropped airborne gate, an off-by-one Y boundary, and an inverted X test.
 * LIVE-OUT: the boolean hit signal (true = hit, false = no-hit skip); memory is
 *           untouched. The oracle's residual registers/flags and its stack drop are
 *           dead — the JS call stack and the boolean carry the control flow.
 * NAMES:    MARIO_X (0x6203), MARIO_Y (0x6205), MARIO_AIRBORNE (0x6216) — all from
 *           ram.js. The target byte is read through the caller's pointer (no fixed
 *           address of its own), so it carries no ram.js name here.
 */

import { MARIO_X, MARIO_Y, MARIO_AIRBORNE } from "./ram.js";
import { loc_2257 } from "./loc_2257.js"; // ROM 0x2257 — the shared no-hit caller-skip tail

// Mario must be under this Y for the hit to register; at or above it the object is
// out of reach and the test always misses.
const REACH_Y = 122;

/**
 * @param {object} m  the machine. The caller leaves the target-X pointer in place
 *   (regs.hl) — a genuine oracle boundary, still a register read.
 * @returns {boolean} true on a hit (caller continues); false on a miss (caller skips).
 */
export function loc_2243(m) {
  const { regs, mem } = m;

  // Out of the reach band — too high on the playfield to count.
  if (mem.read8(MARIO_Y) >= REACH_Y) return loc_2257(m);

  // Airborne — the hit only registers with Mario grounded.
  if (mem.read8(MARIO_AIRBORNE) !== 0) return loc_2257(m);

  // Horizontally aligned with the object's target X?
  if (mem.read8(MARIO_X) !== mem.read8(regs.hl)) return loc_2257(m);

  // All three conditions met — HIT: the caller runs its own tail.
  return true;
}
