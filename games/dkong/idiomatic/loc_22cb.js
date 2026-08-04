// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_22cb — seed one object's velocity fields, choosing the source by mode and difficulty.
 * ROM 0x22CB.
 *
 * The entry point of object-velocity setup: its still-translated caller hands it an object
 * record in a register, and it picks HOW the record's two velocity fields get seeded, then
 * defers to one of four sibling arms. Every arm writes the record's magnitude field (+0x11)
 * and a sign/direction field (+0x10); they differ only in where those bytes come from:
 *
 *   • a one-shot MODE latch (0x6348): while clear, the magnitude is picked purely from the
 *     current LEVEL (loc_22e1).
 *   • otherwise the current DIFFICULTY (1..5) selects the source, sharpening the harder it is:
 *       difficulty 1-2 -> straight from the random byte                       (loc_22f6)
 *       difficulty 3-4 -> random magnitude, direction steered toward the player (loc_2303)
 *       difficulty 5   -> both fields derived from the player's horizontal offset (loc_231a)
 *
 * So a low difficulty leaves the object's step to chance, while a high one aims it at the
 * player. [guess] the two written fields read as a per-frame velocity (magnitude at +0x11,
 * direction sign at +0x10) — matching the arms' role — but that reading rests on the
 * still-oracle caller alone and is below the routine-name evidence bar, so this keeps the
 * neutral loc_ name, exactly as its sibling arms (loc_2303/loc_231a/loc_22f9) do.
 *
 * The record pointer is the register live-in from the still-translated caller and is not
 * modified here; the two param-taking arms (loc_22e1/loc_22f6) receive it as an argument,
 * and the two that still read it off the machine (loc_2303/loc_231a) find it unchanged there.
 * All of that marshalling dissolves once the caller is decompiled.
 *
 * Memory-equivalent to the frozen oracle — equivalence-22cb.test.js.
 * GATE:     crafted — sweep the mode latch and difficulty (1..5) at several record pointers,
 *           with the arms' inputs (LEVEL/RANDOM/MARIO_X/object X) set so the four arms write
 *           DISTINCT record bytes, so any mis-dispatch shows up in the record; plus real
 *           captured 0x22CB dispatches from an attract run and crafted dispatches on a real
 *           attract base. Each dispatched arm is proven exhaustively in its own gate; this
 *           gate proves only the dispatch. Teeth: an ignore-mode twin, an inverted-mode twin,
 *           an off-by-one difficulty twin, and a difficulty-5-misrouted twin.
 * LIVE-OUT: memory-only (record +0x10 / +0x11, written by the dispatched arm). The oracle's
 *           rst-0x28 register/flag churn and its terminal return are dead — the caller
 *           discards the result.
 * NAMES:    DIFFICULTY (0x6380) from names.js. The velocity-mode latch 0x6348 has no names.js name —
 *           verified: it has no export there, because the cell is MULTIPLEXED across readers with
 *           different roles (velocity mode here, a spawn/movement gate in startBarrelDescentAtLadder), so no single
 *           name would be true of both. Kept hex for that reason, not by oversight. The two
 *           record fields +0x10 / +0x11 are written inside the arms and stay unnamed there.
 */

import { NotImplemented } from "../../../boards/dkong/io.js";
import { DIFFICULTY } from "./names.js";
import { loc_22e1 } from "./loc_22e1.js";
import { loc_22f6 } from "./loc_22f6.js";
import { loc_2303 } from "./loc_2303.js";
import { loc_231a } from "./loc_231a.js";

// One-shot latch selecting the velocity source: clear -> the level-based arm, set -> the
// difficulty-graded arms below. Own byte grounded {0,1} live vs MAME (pass-9), but no names.js
// name: it is MULTIPLEXED across readers (velocity-mode here, spawn/movement gate in startBarrelDescentAtLadder),
// so no single names.js name would be true of both and it stays hex — this file-local const names
// only its role HERE, which is why it is scoped to this file rather than promoted to names.js.
const VELOCITY_MODE_LATCH = 0x6348;

export function loc_22cb(m) {
  const { regs, mem } = m;

  // The object record to seed — the register live-in from the still-translated caller.
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
