// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2303 — seed one object's step magnitude and its toward-player step direction
 * (the difficulty-3/4 arm of object-velocity init).  ROM 0x2303.
 *
 * Reached only as the difficulty-3/4 branch of the object-velocity initialiser: the
 * caller dispatches on (difficulty − 1) and lands here for difficulties 3 and 4. It
 * fills two fields of the object record the caller points at:
 *
 *   • step magnitude (record +0x11) ← the current random byte, so the object gets a
 *     pseudo-random speed rather than a fixed one on the harder difficulties.
 *   • step direction (record +0x10) ← the sign that steers the object toward the
 *     player along X: +1 when the player is at or to the right of the object
 *     (player X ≥ object X), −1 (stored as the byte 0xFF) when the player is left.
 *
 * The magnitude is written first, then the direction — the same order as the oracle,
 * though the two writes land in different cells and are independent.
 *
 * The caller supplies the object-record pointer at the oracle boundary (its caller,
 * sub_22cb, is still the frozen oracle and hands the record over in a register), so
 * this reads that pointer from the machine rather than taking it as a promoted
 * parameter; that dissolves once the caller is decompiled.
 *
 * NAME: kept the neutral loc_ — the mechanism is pinned to the oracle, but the two
 * record fields it writes (+0x10 / +0x11) are not yet named in names.js and their
 * "object velocity" reading rests on the still-oracle caller's header alone, below
 * the routine-name evidence bar. Promote once those offsets are corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2303.test.js.
 * GATE:     exhaustive — the whole memory effect factors into two disjoint writes, so
 *           a random-byte sweep (both direction arms) pins the +0x11 copy over all 256
 *           values, and the full 256×256 (playerX, objX) grid pins the +0x10
 *           toward-player sign; plus a crafted check on a real attract-base machine.
 *           0x2303 is a non-executing frontier in attract (difficulty is 1 there, so
 *           the caller takes the difficulty-1/2 arm at 0x22F6), so there are no natural
 *           dispatches to capture — the exhaustive sweep is the proof. Teeth: a signed
 *           compare, an inverted direction, and swapped output offsets.
 * LIVE-OUT: memory-only — the caller tail-calls this (its own return is this routine's
 *           return) and consumes only the two record fields written here; the oracle's
 *           residual registers/flags and its terminal return are dead.
 * NAMES:    RANDOM (0x6018), MARIO_X (0x6203), OBJ_X (record +0x03) — all from names.js.
 *           The two written fields (record +0x10 step direction, +0x11 step magnitude)
 *           have no names.js offset name yet and stay local consts here.
 */

import { RANDOM, MARIO_X, OBJ_X } from "./names.js";

// Object-record fields written here, addressed off the record pointer. Neither has a
// shared OBJ_* offset name in names.js yet (only +0/+3/+5/+7/+8 are named there).
const OBJ_STEP_DIR = 0x10; // signed step direction: 0x01 = toward-right (+1), 0xFF = toward-left (−1)
const OBJ_STEP_MAG = 0x11; // step magnitude, seeded from the random byte

export function loc_2303(m) {
  const { regs, mem } = m;

  // The caller's object-record pointer (oracle boundary: sub_22cb still supplies it).
  const objBase = regs.ix;

  // Random step magnitude for this object.
  mem.write8((objBase + OBJ_STEP_MAG) & 0xffff, mem.read8(RANDOM));

  // Steer toward the player: −1 (0xFF) when the player is left of the object, +1
  // otherwise (player at or to the right).
  const playerLeftOfObject = mem.read8(MARIO_X) < mem.read8((objBase + OBJ_X) & 0xffff);
  mem.write8((objBase + OBJ_STEP_DIR) & 0xffff, playerLeftOfObject ? 0xff : 0x01);
}
