// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2303 — on the two hardest difficulties, give one object a random speed and point it at the
 * player.
 *
 * It is the difficulty-3/4 arm of object-velocity setup, and it fills two fields of the object
 * record the caller points at:
 *
 *   - step magnitude (+0x11) <- the current random byte, so the object gets a pseudo-random speed
 *     rather than the fixed one the easier difficulties hand out.
 *   - step direction (+0x10) <- the sign that steers it toward the player along X: +1 when the
 *     player is at or to the right of the object, -1 (the byte 0xFF) when the player is left.
 *
 * The two writes are independent — different cells, disjoint inputs — and the magnitude happens to
 * be written first.
 *
 * The object-record pointer arrives in the index register rather than as a parameter.
 *
 * NOT CLAIMED: that these two fields are a general "velocity" pair. The reading here is derived
 * from what this arm puts in them and from the comparison it makes, and the offsets carry no
 * shared name — hence the neutral routine name.
 *
 * LIVE-OUT: memory-only — the two record fields.
 */

import { RANDOM, MARIO_X, OBJ_X } from "./names.js";

// The two object-record fields written here, addressed off the record pointer.
const OBJ_STEP_DIR = 0x10; // signed step direction: 0x01 = toward-right, 0xFF = toward-left
const OBJ_STEP_MAG = 0x11; // step magnitude, seeded from the random byte

export function loc_2303(m) {
  const { regs, mem } = m;

  // The object record the caller points at.
  const objBase = regs.ix;

  // Random step magnitude for this object.
  mem.write8((objBase + OBJ_STEP_MAG) & 0xffff, mem.read8(RANDOM));

  // Steer toward the player: −1 (0xFF) when the player is left of the object, +1
  // otherwise (player at or to the right).
  const playerLeftOfObject = mem.read8(MARIO_X) < mem.read8((objBase + OBJ_X) & 0xffff);
  mem.write8((objBase + OBJ_STEP_DIR) & 0xffff, playerLeftOfObject ? 0xff : 0x01);
}
