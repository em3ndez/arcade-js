// SPDX-License-Identifier: GPL-3.0-only
/**
 * mirrorObjectPositionToSprite — mirror the current object's position into its paired sprite record,
 * then advance the per-object scan.
 *
 * A convergence tail of the per-object update loop, reached from two of that loop's state arms. It
 * copies the object record's X and Y into the paired sprite record's X and Y — so the hardware
 * draws the object's sprite where the object currently IS — then falls straight into the shared
 * cursor advance, which steps both scan cursors on to the next object.
 *
 * The object record is addressed by the object-scan cursor and the sprite record by the paired
 * sprite-scan cursor. Both cursors are supplied by the scan loop and re-read by it on the next pass,
 * so they stay register-carried here. The four field offsets are the shared record layout the whole
 * scan uses.
 *
 * WHAT THE NAME CLAIMS. Both destinations are the named sprite-record position fields and both
 * sources are the named object-record position fields, so the effect names the routine exactly. The
 * fall-through cursor advance is a shared tail and is deliberately left out of the name.
 *
 * Reads: the object record's OBJ_X and OBJ_Y. Writes: the sprite record's SPRITE_X and SPRITE_Y.
 * LIVE-OUT: those two writes, plus the registers the shared advance leaves — object cursor +16,
 * sprite cursor +4, remaining-object count preserved, step value 4.
 */

import { OBJ_X, OBJ_Y, SPRITE_X, SPRITE_Y } from "./names.js";
import { advanceToNextObject } from "./advanceToNextObject.js";

/**
 * @param {object} m  the machine. The object/sprite scan cursors arrive in registers; the
 *                    two-byte position copy goes through memory.
 * @returns {void}
 */
export function mirrorObjectPositionToSprite(m) {
  const { regs, mem } = m;

  // Place the object's sprite at the object's position: copy the object record's X and Y
  // into the paired sprite record's X and Y. Object record at the object-scan cursor,
  // sprite record at the paired sprite-scan cursor.
  mem.write8(regs.iy + SPRITE_X, mem.read8(regs.ix + OBJ_X));
  mem.write8(regs.iy + SPRITE_Y, mem.read8(regs.ix + OBJ_Y));

  // Advance both cursors to the next object — the hardware falls straight into this tail.
  advanceToNextObject(m);
}
