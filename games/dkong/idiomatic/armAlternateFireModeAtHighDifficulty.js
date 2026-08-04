// SPDX-License-Identifier: GPL-3.0-only
/**
 * armAlternateFireModeAtHighDifficulty — arm mode 2 in field +0x19 of fire records 1 and 3 when the
 * board is hard enough and a rare entropy draw comes up.  ROM 0x31DD.
 *
 * Reached from the object processor (its caller iterates the 0x6400 object array). It
 * stamps the value 2 into the same field (+0x19) of records 1 and 3 of that array, but
 * only when BOTH gates open on this pass:
 *
 *   1. Difficulty is at least 3. The test is a signed one on (difficulty - 3): it
 *      proceeds only while that difference stays non-negative as a signed byte. Difficulty
 *      is clamped below 6 in play, so this is effectively "difficulty is 3, 4, or 5";
 *      faithfully it also bows out once difficulty reaches 131, where the signed difference
 *      turns negative again (a value never reached in normal play).
 *   2. A rare entropy draw lands on 1. The value comes from the timing-entropy helper
 *      (loc_31f6): the low two bits of the random accumulator, or the frame counter when
 *      those bits are exactly 1 — so the draw equals 1 only when those bits are 1 AND the
 *      frame counter is 1.
 *
 * When either gate is closed the routine does nothing this pass.
 *
 * NAME: promoted from loc_31dd this pass. The name commits only to the two GATES and to
 * WHICH array is stamped — both of which are pinned (see "WHY 'FIRE'" below) — and stops
 * there. What the armed field ultimately drives is still not confirmed, so the name says
 * "alternate mode" and not what that mode does. The sole caller is ROM 0x31B1
 * (`call 0x31DD` at 0x31B1), and it is translated and readable: `loc_31b1.js` imports this
 * routine and direct-calls it.
 *
 * NAME — WHY "FIRE". OBJ_ARRAY_64 (0x6400) was grounded as the FIRES on the real ROM under
 * MAME 0.288, on a NATURAL zero-poke 25m run (scratchpad/grounding-object-arrays.md): zeroing
 * the five records' +0 erases the fireball from the screen completely (0 of 40 sampled frames)
 * while the barrels are statistically untouched, the tight A/B's first differing frame is a
 * single blob at this array's logged record position to the pixel, and boxes drawn at the
 * logged positions land on a fireball and nothing else on all four boards. HONEST FLOOR: the
 * X-pin POSITIVE control on this array is a NO-OP — the ROM recomputes +3 each frame — so the
 * identity rests on the kill control plus positional correlation, not on a coordinate command.
 * The name deliberately does NOT say what mode 2 IS. The "hold / wait on Mario's Y" reading is a
 * two-hop trace through loc_3202 and loc_32d6 whose own inputs are untraced, and loc_32d6 does
 * not even clear +0x19 on all four exits. Nothing here has ever been OBSERVED to fire either:
 * 0x31DD is dispatched in attract (457x / 2000 frames), but difficulty stays at 1, so nothing
 * past gate 1 has run. That is why this entry is cert "code", not "seen".
 *
 * Memory-equivalent to the frozen oracle — equivalence-31dd.test.js.
 * GATE:     effectively exhaustive — the difficulty gate is swept over all 256 difficulty
 *           values (entropy pinned both open and closed), and the entropy gate over the
 *           whole 256×256 (random, frame) space at a passing difficulty, so both gates and
 *           their AND-composition are proven on the true determinants. The caller does
 *           dispatch this every attract pass, but difficulty stays 1 in attract, so every
 *           real dispatch takes the gate-1 skip; the write and entropy arms are reached only
 *           by the sweep (captured no-write dispatches also match). Teeth: an unsigned
 *           (carry) difficulty gate, a dropped second write, and an inverted entropy gate.
 * LIVE-OUT: memory-only — the two object-field writes. The caller discards any register/flag
 *           residue and the routine returns nothing; its two early exits just mean "skip this
 *           pass". The oracle's push/return bracket around the entropy call dissolves into a
 *           direct call, so its dead stack scratch is excluded from the equivalence diff.
 * NAMES:    DIFFICULTY (0x6380), OBJ_ARRAY_64 (0x6400) from names.js; loc_31f6 direct-called for
 *           the entropy draw. The armed cells are field +0x19 of records 1 and 3 of
 *           OBJ_ARRAY_64 (0x6439 / 0x6479); that field has no names.js name yet, so its offset
 *           stays a literal.
 */

import { u8 } from "../../../core/int.js";
import { DIFFICULTY, OBJ_ARRAY_64 } from "./names.js";
import { loc_31f6 } from "./loc_31f6.js"; // ROM 0x31F6 — the timing-entropy draw

/**
 * @param {object} m  the machine (reads m.mem, and reads through loc_31f6).
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

  // Both gates open: arm field +0x19 of records 1 and 3 of the 0x6400 object array.
  mem.write8(OBJ_ARRAY_64 + 0x39, 2); // 0x6439 — record 1 (+0x20), field +0x19
  mem.write8(OBJ_ARRAY_64 + 0x79, 2); // 0x6479 — record 3 (+0x60), field +0x19
}
