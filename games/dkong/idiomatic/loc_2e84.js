// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2e84 — one state of the per-object update: step this object 3 along Y, retire it once it
 * passes the travel limit, then mirror its position to its sprite.
 *
 * The per-object update walks a record array once a frame and dispatches on each record's state
 * field; this handler is what one of those states does. Every call moves the object 3 units
 * along Y. Below the travel limit that is all that happens and the object simply keeps going.
 * At or past the limit it is RETIRED: its X and its active flag are both cleared, so it stops
 * being drawn and stops being processed.
 *
 * Either way, the object's position is then mirrored into its paired sprite record and both scan
 * cursors step on to the next object. On the retire path the mirrored X is the zero just
 * written, so the sprite is pulled to column 0 in the same frame the object goes inactive.
 *
 * NOT CLAIMED: what this object IS, or which way its step reads on screen. A larger Y is lower,
 * so the step moves it down the display, but nothing here establishes whether that is a fall, a
 * descent under power, or something else — which is why the name stays address-shaped.
 *
 * The record is addressed by the object-scan cursor the caller carries in a register, and the
 * paired sprite cursor is passed straight through untouched.
 *
 * LIVE-OUT: the object's Y always, its X and active flag on the retire path, the two sprite
 * position bytes the mirror writes, and the two cursors the mirror advances.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_ACTIVE, OBJ_X, OBJ_Y } from "./names.js";
import { mirrorObjectPositionToSprite } from "./mirrorObjectPositionToSprite.js";

// Y limit: once the object reaches this it is retired instead of moving further.
const TRAVEL_LIMIT = 248;

/**
 * @param {object} m  the machine. The object-scan cursor arrives in a register; the paired
 *                    sprite cursor is passed through to the mirror tail unchanged.
 * @returns {void}
 */
export function loc_2e84(m) {
  const { regs, mem } = m;

  // Step the object 3 units along Y and store it back.
  const newY = u8(mem.read8(regs.ix + OBJ_Y) + 3);
  mem.write8(regs.ix + OBJ_Y, newY);

  // Reached the travel limit: retire the object — clear its X and its active flag, so it is
  // no longer drawn or processed. (Below the limit it just keeps moving.)
  if (newY >= TRAVEL_LIMIT) {
    mem.write8(regs.ix + OBJ_X, 0);
    mem.write8(regs.ix + OBJ_ACTIVE, 0);
  }

  // Mirror the object's position into its sprite record and advance both scan cursors.
  mirrorObjectPositionToSprite(m);
}
