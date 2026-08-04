// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_22cb — seed one object's velocity fields, choosing the source by mode and difficulty.
 *
 * The entry point of object-velocity setup: the caller hands it an object record in a
 * register, and it picks HOW the record's two velocity fields get seeded, then defers to one
 * of four arms. Every arm writes the record's magnitude field and a sign/direction field
 * beside it; they differ only in where those bytes come from:
 *
 *   • a one-shot MODE latch: while clear, the magnitude is picked purely from the current
 *     level.
 *   • otherwise the current DIFFICULTY (1..5) selects the source, sharpening the harder it is:
 *       difficulty 1-2 -> straight from the random byte
 *       difficulty 3-4 -> random magnitude, direction steered toward the player
 *       difficulty 5   -> both fields derived from the player's horizontal offset
 *
 * So a low difficulty leaves the object's step to chance, while a high one aims it at the
 * player.
 *
 * WHAT THIS DOES NOT CLAIM: the two written fields read as a per-frame velocity — a magnitude
 * and a direction sign — which matches what the arms do with them, but that reading rests on
 * the caller alone [guess].
 *
 * The record pointer is a register live-in and is not modified here; two of the arms take it
 * as an argument and the other two read it off the machine, where it is still intact.
 *
 * LIVE-OUT: memory-only — the record's two velocity fields, written by the dispatched arm.
 */

import { NotImplemented } from "../../../boards/dkong/io.js";
import { DIFFICULTY } from "./names.js";
import { loc_22e1 } from "./loc_22e1.js";
import { loc_22f6 } from "./loc_22f6.js";
import { loc_2303 } from "./loc_2303.js";
import { loc_231a } from "./loc_231a.js";

// One-shot latch selecting the velocity source: clear -> the level-based arm, set -> the
// difficulty-graded arms below. It holds 0 or 1 in play. The cell is MULTIPLEXED — another
// reader takes it as a spawn/movement gate — so no shared name would be true of both, and this
// file-local constant names only its role HERE.
const VELOCITY_MODE_LATCH = 0x6348;

export function loc_22cb(m) {
  const { regs, mem } = m;

  // The object record to seed — the register live-in from the caller.
  const objRecord = regs.ix;

  // Mode latch clear: pick the magnitude from the current level.
  if (mem.read8(VELOCITY_MODE_LATCH) === 0) {
    return loc_22e1(m, objRecord);
  }

  // Otherwise the current difficulty (1..5) selects the velocity source.
  const difficulty = mem.read8(DIFFICULTY);
  switch (difficulty) {
    case 1:
    case 2:
      return loc_22f6(m, objRecord); // straight from the random byte
    case 3:
    case 4:
      return loc_2303(m); // random magnitude, steered toward the player
    case 5:
      return loc_231a(m); // both fields from the player's horizontal offset
    default:
      throw new NotImplemented(
        `loc_22cb: object-velocity dispatch on unexpected difficulty ${difficulty}`,
      );
  }
}
