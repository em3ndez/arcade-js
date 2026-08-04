// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2a2f — probe the tile below a moving object and, if it has reached the sloped girder there,
 * snap the object UP onto the girder surface and report the contact.
 *
 * The object's record is addressed through the pointer the active-movement handlers set up before
 * calling. The routine samples the tilemap cell 4 px BELOW the object — its OBJ_X, and its OBJ_Y
 * nudged 4 px further down, since larger Y is lower on screen — and reads that tile:
 *   - A tile below 0xB0, or a girder tile whose low nibble is 8 or more, or exactly 0xC0, is
 *     passable: the object is not standing on a girder here, so report no contact.
 *   - Otherwise the tile encodes a girder slope, and its class picks the surface's row WITHIN that
 *     8 px cell:
 *       0xB0-0xB7             -> a full-step offset of -1
 *       0xC0-0xC7 / 0xE0-0xE7 -> (low nibble) - 9
 *       0xD0-0xD7 / 0xF0-0xF7 -> (low nibble) - 1
 *     The probe row is snapped back to its 8 px cell boundary and the offset added, which gives the
 *     girder SURFACE row under the object. If that surface is ABOVE the probe point (a smaller Y),
 *     the object has fallen to or through it: OBJ_Y is rewritten to the surface, undoing the 4 px
 *     probe nudge, which lifts the object up onto the girder, and the routine reports contact. If
 *     the surface is still below the probe point the object has not landed yet — nothing is
 *     written, no contact.
 *
 * THE AXES ARE NOT INTERCHANGEABLE HERE, and getting them backwards manufactures a phantom
 * left/right asymmetry in the slope handling. The record's X-role byte and Y-role byte are imported
 * by NAME rather than written as bare offsets, precisely so the assignment cannot be misread off
 * this file. The 90-degree display rotation is why the cell is addressed with the object's X
 * feeding the tilemap's vertical axis and its Y feeding the horizontal one.
 *
 * NAME: HELD at the neutral loc_. No derivation that survives scrutiny has been produced for this
 * routine yet, so nothing is promoted.
 *
 * LIVE-OUT: the object record's OBJ_Y byte, rewritten only on the landing arm, plus the contact
 * flag returned BOTH as a boolean AND in the accumulator (1 = contact, 0 = none). The accumulator
 * is load-bearing, not residual — see the note at the bottom of the body.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_X, OBJ_Y } from "./names.js";
import { tileAddrForPixel } from "./tileAddrForPixel.js";

/**
 * @param {object} m  the machine; the caller's object pointer selects the record.
 * @returns {boolean} true if the object reached the girder and its Y was snapped up to the
 *                    surface; false otherwise.
 */
export function loc_2a2f(m) {
  const { regs, mem } = m;
  const objPtr = regs.ix;

  const objX = mem.read8((objPtr + OBJ_X) & 0xffff);
  // Probe point: 4 px BELOW the object (larger Y is lower on screen).
  const probeY = u8(mem.read8((objPtr + OBJ_Y) & 0xffff) + 4);
  const cell = tileAddrForPixel(objX, probeY); // tilemap cell under the object
  const tile = mem.read8(cell);

  // Passable: below the girder range, a girder tile with a high low-nibble, or the uniform
  // 0xC0 tile. There is no girder surface to land on here — no contact.
  if (tile < 0xb0) return noContact();
  if ((tile & 0x0f) >= 8) return noContact();
  if (tile === 0xc0) return noContact();

  // A girder-slope tile: its class picks the surface's row within this 8 px cell.
  let slope;
  if (tile < 0xc0) {
    slope = 0xff;                    // 0xB0-0xB7: one pixel above the cell boundary
  } else if (tile < 0xd0) {
    slope = u8((tile & 0x0f) - 9);   // 0xC0-0xC7
  } else if (tile < 0xe0) {
    slope = u8((tile & 0x0f) - 1);   // 0xD0-0xD7
  } else if (tile < 0xf0) {
    slope = u8((tile & 0x0f) - 9);   // 0xE0-0xE7
  } else {
    slope = u8((tile & 0x0f) - 1);   // 0xF0-0xF7
  }

  // Snap the probe row back to its 8 px cell boundary and add the slope offset: that is the
  // girder SURFACE row under the object. Land only if the surface is ABOVE the probe point
  // (a smaller Y), i.e. the object has fallen to or through it.
  const surface = u8((probeY & 0xf8) + slope);
  if (surface < probeY) {
    // Snap OBJ_Y up onto the surface, undoing the 4 px probe nudge; the store truncates.
    mem.write8((objPtr + OBJ_Y) & 0xffff, surface - 4);
    regs.a = 0x01; // contact, in the accumulator — see noContact() for why that matters
    return true;
  }
  return noContact();

  // The contact flag is returned BOTH as a JS boolean and in the accumulator. The accumulator is
  // not decoration: both callers read the answer out of it and branch on zero. Returning false
  // alone would leave it holding whatever the preceding gravity step left there, which is reliably
  // NON-ZERO, so every probe would report contact and the caller would branch into its collision
  // arm. The accumulator is this routine's register boundary until both callers take the boolean.
  // The flags it also carries are dead: both callers recompute them.
  function noContact() {
    regs.a = 0x00;
    return false;
  }
}
