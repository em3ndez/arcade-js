// SPDX-License-Identifier: GPL-3.0-only
/**
 * gateFireUpdateByDifficulty — pick this difficulty's frame gate and hand its proceed/skip
 * decision straight back to the caller.
 *
 * It reads DIFFICULTY, clamps it to the six slots its table has (anything at or above 6 shares
 * the last one), and runs the gate that slot names. Each gate reads the low bits of the frame
 * counter and answers whether the caller should do its work this frame, so the pair paces the
 * caller to a duty cycle that widens as difficulty climbs:
 *
 *   difficulty 0, 1 -> every other frame  (1/2)
 *   difficulty 2    -> five frames in 8   (5/8)
 *   difficulty 3, 4 -> three frames in 4  (3/4)
 *   difficulty 5+   -> seven frames in 8  (7/8)
 *
 * Two of the six slots are DUPLICATES, which is why four gates cover six difficulties. That is
 * the table's own shape, not a simplification made here.
 *
 * The clamp is a genuine guard but never fires in normal play: DIFFICULTY's own writer already
 * caps it at 5, so only a corrupted or out-of-range value can reach the last slot through the
 * clamp rather than through its own slot.
 *
 * SKIP-CAPABLE, AND TRANSPARENTLY SO. The gate's answer is not consumed here — it is the
 * caller's. A false means the gate wants the caller's remaining work skipped for this frame, and
 * this routine sits so directly on top of the gate that the skip lands one level further out than
 * the gate itself: the CALLER is the one that gets skipped, and ITS caller resumes. So the
 * decision is returned unchanged, and a caller consumes it as an early return. true = proceed,
 * false = return at once.
 *
 * NOT RECURSIVE, stated because it is easy to assume of a dispatcher: nothing in the gate family
 * calls back here, so this routine runs its selected gate exactly once and returns.
 *
 * WHAT THE NAME RESTS ON, from this body alone: the routine reads exactly one cell of its own,
 * DIFFICULTY, and its entire output is a proceed/skip decision it does not use. That is a gate
 * selected by difficulty and nothing else — a name claiming it schedules, counts or spawns would
 * be refuted by the fact that it writes no memory at all.
 *
 * Reads DIFFICULTY; the gates read the frame counter themselves. Writes nothing.
 *
 * LIVE-OUT: the proceed/skip decision, and nothing else — neither this routine nor any gate it
 * selects writes memory.
 */

import { DIFFICULTY } from "./names.js";
import { loc_3110 } from "./loc_3110.js";
import { loc_311b } from "./loc_311b.js";
import { loc_3126 } from "./loc_3126.js";
import { loc_3131 } from "./loc_3131.js";

/**
 * The six-entry table, one slot per difficulty, transcribed as the gate functions it names:
 * 1/2, 1/2, 5/8, 3/4, 3/4, 7/8. The duplicated slots are what make the duty cycle widen in four
 * steps over six difficulties.
 */
const FRAME_GATE_BY_DIFFICULTY = [loc_3110, loc_3110, loc_311b, loc_3126, loc_3126, loc_3131];

/**
 * @param {object} m  the machine.
 * @returns {boolean}  true to let the caller proceed this frame; false to make it return at once.
 */
export function gateFireUpdateByDifficulty(m) {
  // Any difficulty past the end of the table shares the last (widest) gate.
  const difficulty = Math.min(m.mem.read8(DIFFICULTY), FRAME_GATE_BY_DIFFICULTY.length - 1);

  // The gate's decision is the caller's, not ours — pass it up untouched.
  return FRAME_GATE_BY_DIFFICULTY[difficulty](m);
}
