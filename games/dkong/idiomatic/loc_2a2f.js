// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2a2f — probe the tilemap cell 4 px below a moving object and, if it has reached the sloped
 * girder there, snap OBJ_Y UP onto the girder surface and report contact. Passable tiles (below
 * 0xB0, low nibble >= 8, or exactly 0xC0) report no contact; otherwise the tile class picks the
 * surface row within the 8 px cell, and the object lands only if that surface is above the probe
 * point. The record is at regs.ix.
 *
 * LIVE-OUT: the object record's OBJ_Y byte, rewritten only on the landing arm, plus the contact
 * flag returned BOTH as a boolean AND in the accumulator (1 = contact, 0 = none). The accumulator
 * is load-bearing, not residual — see the note at the bottom of the body.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_X, OBJ_Y } from "./names.js";
import { tileAddrForPixel } from "./tileAddrForPixel.js";

export function loc_2a2f(m, objPtr = m.regs.ix) {
  const { regs, mem8 } = m;

  const objX = mem8[(objPtr + OBJ_X) & 0xffff];
  // Probe point: 4 px BELOW the object (larger Y is lower on screen).
  const probeY = u8(mem8[(objPtr + OBJ_Y) & 0xffff] + 4);
  const cell = tileAddrForPixel(objX, probeY);
  const tile = mem8[cell];

  if (tile < 0xb0) return noContact();
  if ((tile & 0x0f) >= 8) return noContact();
  if (tile === 0xc0) return noContact();

  let slope;
  if (tile < 0xc0) {
    slope = 0xff;                    // 0xB0-0xB7
  } else if (tile < 0xd0) {
    slope = u8((tile & 0x0f) - 9);   // 0xC0-0xC7
  } else if (tile < 0xe0) {
    slope = u8((tile & 0x0f) - 1);   // 0xD0-0xD7
  } else if (tile < 0xf0) {
    slope = u8((tile & 0x0f) - 9);   // 0xE0-0xE7
  } else {
    slope = u8((tile & 0x0f) - 1);   // 0xF0-0xF7
  }

  // Snap the probe row to its 8 px cell boundary, add the slope: the girder surface row. Land
  // only if it is ABOVE the probe point (smaller Y).
  const surface = u8((probeY & 0xf8) + slope);
  if (surface < probeY) {
    mem8[(objPtr + OBJ_Y) & 0xffff] = surface - 4;
    regs.a = 0x01;
    return true;
  }
  return noContact();

  // The contact flag is returned in the accumulator too, and both callers branch on it: false
  // alone would leave A holding the preceding gravity step's reliably NON-ZERO value, so every
  // probe would falsely report contact. The flags it also carries are dead.
  function noContact() {
    regs.a = 0x00;
    return false;
  }
}
