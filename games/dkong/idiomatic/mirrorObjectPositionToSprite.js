// SPDX-License-Identifier: GPL-3.0-only
/**
 * mirrorObjectPositionToSprite — mirror the current object's position into its paired
 * sprite record, then advance the per-object scan.  ROM 0x2E6C.
 *
 * A convergence tail of the per-object update loop (entry_2e04), reached from loc_2e4b
 * at the animation-string boundary and from loc_2e84 in the rise/deactivate state. It
 * copies the object record's X and Y into the paired sprite record's X and Y — so the
 * hardware draws the object's sprite at the object's current position — then falls
 * straight into advanceToNextObject, which steps both scan cursors on to the next object.
 *
 * The object record is addressed by the object-scan cursor and the sprite record by the
 * paired sprite-scan cursor. Both cursors are supplied — and, after the advance, re-read
 * on the next pass — by the still-translated scan loop, so they stay register-carried
 * here (a genuine oracle boundary). The field offsets (object X/Y, sprite X/Y) are the
 * shared record layout the whole scan uses.
 *
 * NAME: promoted from loc_2e6c in the clarify pass (proposer != confirmer). The mechanism —
 * mirror the object's X/Y into the paired sprite record — is clear and every touched cell is a
 * named, grounded record field, so the effect names the routine exactly; the fall-through
 * advance is the shared tail (advanceToNextObject), correctly left out of the name.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2e6c.test.js.
 * GATE:     crafted + captured. Each copied byte is swept over all 256 values (pins the copy
 *           value-faithfully and rules out a swap / spurious mask / cross-term); the exact
 *           in-game cursor sequence is grid-cross-producted; an independence sweep varies the
 *           ignored registers and RAM; and 10 real captured 0x2e6c dispatches from a steered
 *           full entry_2e04 loop replay oracle vs candidate. No full 0..65535 cursor sweep —
 *           unlike the register-only advanceToNextObject tail this routine dereferences the
 *           cursors, so coverage comes from the real (mapped) record positions.
 * LIVE-OUT: two memory writes (sprite X, sprite Y) plus the registers advanceToNextObject
 *           leaves — object cursor +16, sprite cursor +4, remaining-object count preserved,
 *           step value 4. The scratch byte the oracle leaves in the accumulator is dead: the
 *           loop reloads it before its next test, and no exit successor reads it.
 * NAMES:    OBJ_X (+3), OBJ_Y (+5), SPRITE_X (+0), SPRITE_Y (+3) — record-field offsets from
 *           names.js, indexed off the object and sprite scan cursors.
 */

import { OBJ_X, OBJ_Y, SPRITE_X, SPRITE_Y } from "./names.js";
import { advanceToNextObject } from "./advanceToNextObject.js"; // ROM 0x2E78

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

  // Advance both cursors to the next object (the oracle falls straight into this tail).
  advanceToNextObject(m);
}
