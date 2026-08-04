// SPDX-License-Identifier: GPL-3.0-only
/**
 * armAlternateFireModeAtHighDifficulty — stamp mode 2 into one field of two fire records, but only
 * on a hard board and only on a rare entropy draw.
 *
 * Two gates, both of which must open on the same pass. Either one closed and the routine does
 * nothing at all this frame:
 *
 *   1. DIFFICULTY is at least 3. The test is a SIGNED one on (difficulty - 3) and proceeds while
 *      that difference stays non-negative as a signed byte. Difficulty is clamped below 6 in play,
 *      so in practice this is "difficulty is 3, 4 or 5"; faithfully it also closes again once
 *      difficulty reaches 131, where the signed difference turns negative — a value normal play
 *      never reaches.
 *   2. A rare entropy draw comes up exactly 1. The draw is the low two bits of the running random
 *      accumulator, or the frame counter substituted in when those two bits are exactly 1 — so the
 *      draw is 1 only when those bits are 1 AND the frame counter is 1.
 *
 * Past both gates the constant 2 is stamped into field +0x19 of records 1 and 3 of the fire array
 * OBJ_ARRAY_64. Nothing else is written, on any path.
 *
 * WHAT THE NAME CLAIMS, AND WHERE IT STOPS. Derivable from the body: the two gates, and which two
 * records of which array are written. NOT CLAIMED: what mode 2 makes a fire DO. No reader of that
 * field appears in this file, so "alternate mode" labels the value written, not a behaviour.
 *
 * Reads: DIFFICULTY, plus the two cells behind the entropy draw. Writes: field +0x19 of fire
 * records 1 and 3.
 * LIVE-OUT: memory-only — those two field writes. Both early exits mean only "skip this pass".
 */

import { u8 } from "../../../core/int.js";
import { DIFFICULTY, OBJ_ARRAY_64 } from "./names.js";
import { loc_31f6 } from "./loc_31f6.js";

/**
 * @param {object} m  the machine; reads memory both here and through the entropy draw.
 * @returns {void}
 */
export function armAlternateFireModeAtHighDifficulty(m) {
  const { mem } = m;

  // Gate 1 — difficulty must be at least 3, tested as the sign of the signed byte
  // (difficulty - 3): non-negative to proceed. (It also bows out at difficulty >= 131,
  // an artifact of the signed test that normal play never reaches.)
  const difficulty = mem.read8(DIFFICULTY);
  if ((u8(difficulty - 3) & 0x80) !== 0) return;

  // Gate 2 — the timing-entropy draw must be exactly 1.
  if (loc_31f6(m) !== 1) return;

  // Both gates open: arm field +0x19 of records 1 and 3 of the fire array.
  mem.write8(OBJ_ARRAY_64 + 0x39, 2); // record 1 (+0x20), field +0x19
  mem.write8(OBJ_ARRAY_64 + 0x79, 2); // record 3 (+0x60), field +0x19
}
