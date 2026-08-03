// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2a2f — probe the tile a moving object is standing on and, if it sits on a
 * sloped girder, slide the object's X along the slope and report the contact. ROM 0x2A2F.
 *
 * The object's record is addressed through the pointer the active-movement handlers set
 * up before calling: its Y is at record offset 3 and its X at offset 5. The routine samples
 * the tilemap cell under the object (its Y, and its X nudged 4 px forward) and reads that
 * tile:
 *   - A tile below 0xB0, or a girder tile whose low nibble is 8 or more, or exactly 0xC0,
 *     is level/passable footing — nothing to do, report no contact.
 *   - Otherwise the tile encodes a slope, and its class picks a horizontal offset:
 *       0xB0-0xB7            -> a full-step offset of -1 (0xFF)
 *       0xC0-0xC7 / 0xE0-0xE7 -> (low nibble) - 9
 *       0xD0-0xD7 / 0xF0-0xF7 -> (low nibble) - 1
 *     The object's forward X is snapped back to its 8 px tile boundary, the slope offset is
 *     added, and if that lands the object LEFT of where it was, its X record is rewritten to
 *     the slid position (undoing the 4 px nudge) and the routine reports contact. If the
 *     slide would not move it left, nothing is written and it reports no contact.
 *
 * The 90-degree display rotation is why the cell is addressed with the object's Y feeding the
 * tilemap's vertical axis and its X feeding the horizontal one — see tileAddrForPixel, whose
 * own address arithmetic the ROM assumes.
 *
 * NAME: kept the neutral loc_ — the tile classes and the slide are pinned to the oracle, but
 * which mover this services (it is a sibling of loc_2a85, called from the active-movement
 * handlers branch_2053 / branch_20ec) is not confirmed to the routine-name bar. Promote once
 * corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2a2f.test.js.
 * GATE:     capture/clone/replay of real attract dispatches + crafted entries driving each
 *           passable exit (tile < 0xB0, low nibble >= 8, exactly 0xC0), every slope class and
 *           its offset, and both slide arms (rewrites X / leaves it). The slide-and-rewrite is
 *           a non-attract frontier the crafted entries carry. The RAM diff excludes the dead
 *           STACK_SCRATCH the oracle's push/pop bracket around the cell lookup writes. Teeth:
 *           an off-by-one passable threshold, a dropped 4 px nudge-undo, and a flipped slide
 *           direction.
 * LIVE-OUT: the object-record X byte (record offset 5, rewritten only on the slide arm), plus
 *           the contact flag returned BOTH as a boolean AND in register A (1 = contact,
 *           0 = none). A is load-bearing, not residual: both callers (ROM 0x2053, 0x20EC) are
 *           still translated and read the answer with `and a / jp nz`, so A is this routine's
 *           register boundary until they are rewritten. The oracle's other residual registers,
 *           its flags (both callers recompute them with `and a`) and its terminal ret are dead.
 * NAMES:    none from ram.js — the object-record fields (Y at +3, X at +5) are addressed
 *           relative to the caller's object pointer, and the probed cell is tilemap video RAM
 *           (0x7400 page); neither has a ram.js name. The cell address is computed by
 *           tileAddrForPixel (ROM 0x2FF0).
 */

import { u8 } from "../../../core/int.js";
import { tileAddrForPixel } from "./tileAddrForPixel.js"; // ROM 0x2FF0

/**
 * @param {object} m  the machine; the caller's object pointer selects the record.
 * @returns {boolean} true if the object sat on a slope and its X was slid; false otherwise.
 */
export function loc_2a2f(m) {
  const { regs, mem } = m;
  const objPtr = regs.ix;

  const objY = mem.read8((objPtr + 3) & 0xffff);
  const probeX = u8(mem.read8((objPtr + 5) & 0xffff) + 4); // sample point 4 px forward of X
  const cell = tileAddrForPixel(objY, probeX);             // tilemap cell under the object
  const tile = mem.read8(cell);

  // Passable footing: below the girder range, a girder tile with a high low-nibble, or the
  // flat 0xC0 tile. Nothing to slide — no contact.
  if (tile < 0xb0) return noContact();
  if ((tile & 0x0f) >= 8) return noContact();
  if (tile === 0xc0) return noContact();

  // A slope tile: its class picks the horizontal offset applied at the snapped boundary.
  let slope;
  if (tile < 0xc0) {
    slope = 0xff;                    // 0xB0-0xB7: step one pixel left
  } else if (tile < 0xd0) {
    slope = u8((tile & 0x0f) - 9);   // 0xC0-0xC7
  } else if (tile < 0xe0) {
    slope = u8((tile & 0x0f) - 1);   // 0xD0-0xD7
  } else if (tile < 0xf0) {
    slope = u8((tile & 0x0f) - 9);   // 0xE0-0xE7
  } else {
    slope = u8((tile & 0x0f) - 1);   // 0xF0-0xF7
  }

  // Snap the forward X back to its 8 px tile boundary, add the slope offset, and slide only
  // if that lands the object left of where it was.
  const slid = u8((probeX & 0xf8) + slope);
  if (slid < probeX) {
    mem.write8((objPtr + 5) & 0xffff, slid - 4); // undo the 4 px nudge; the store truncates
    regs.a = 0x01; // contact, in A — see noContact() for why A is the live-out
    return true;
  }
  return noContact();

  // The contact flag is returned BOTH as a JS boolean and in A. A is not decoration: the two
  // callers (ROM 0x2053 and 0x20EC) are still translated, and they read the answer out of the
  // accumulator — `and a / jp nz` — exactly as the oracle leaves it (`ld a,0x01` on the slide
  // arm, `xor a` here). A JS `return false` alone leaves A holding whatever the preceding
  // gravity step left there, which is reliably NON-ZERO, so every probe would report contact
  // and the caller would branch into its collision arm. A is this routine's register boundary
  // until both callers are rewritten, the same way loc_2a85 hands D/HL to its still-translated
  // callee. The flags A also carries are dead: both callers recompute them with `and a`.
  function noContact() {
    regs.a = 0x00;
    return false;
  }
}
