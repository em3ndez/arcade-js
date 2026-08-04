// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2a2f — probe the tile below a moving object and, if it has reached the sloped girder
 * there, snap the object UP onto the girder surface and report the contact. ROM 0x2A2F.
 *
 * ★ AXIS CORRECTION (2026-08-03). An earlier version of this header — and of names.js's role
 * line — had the record's two coordinate fields SWAPPED, and therefore described the routine
 * as sliding the object's X sideways along the slope, with a mysterious "only a LEFTWARD
 * slide counts as contact" asymmetry. There is no asymmetry; the mystery was manufactured by
 * the error. Three independent facts fix the axes:
 *   • names.js grounds OBJ_X = record +3 and OBJ_Y = record +5, each live in real MAME on its
 *     own byte (0x6403/0x6703 swept 227/223 distinct values; 0x6405/0x6705 22/158).
 *   • startMarioFallWhenGroundGivesWay fills the SAME two tileAddrForPixel slots this routine fills — it calls
 *     tileAddrForPixel(MARIO_X - 3, MARIO_Y + 12) — so the FIRST slot takes the X-role byte
 *     and the second the Y-role byte.
 *   • the store at ROM 0x2A7D is `d6 04 / dd 77 05`, i.e. it writes record +5 = OBJ_Y.
 *
 * The object's record is addressed through the pointer the active-movement handlers set up
 * before calling. The routine samples the tilemap cell 4 px BELOW the object (its OBJ_X, and
 * its OBJ_Y nudged 4 px further down — larger Y is lower on screen) and reads that tile:
 *   - A tile below 0xB0, or a girder tile whose low nibble is 8 or more, or exactly 0xC0,
 *     is passable — the object is not standing on a girder here, so report no contact.
 *   - Otherwise the tile encodes a girder slope, and its class picks the surface's row
 *     WITHIN that 8 px cell:
 *       0xB0-0xB7            -> a full-step offset of -1 (0xFF)
 *       0xC0-0xC7 / 0xE0-0xE7 -> (low nibble) - 9
 *       0xD0-0xD7 / 0xF0-0xF7 -> (low nibble) - 1
 *     The probe row is snapped back to its 8 px cell boundary and the offset added, which
 *     gives the girder SURFACE row under the object. If that surface is ABOVE the probe point
 *     (a smaller Y), the object has fallen to or through it: OBJ_Y is rewritten to the
 *     surface (undoing the 4 px probe nudge), which lifts the object up onto the girder, and
 *     the routine reports contact. If the surface is still below the probe point the object
 *     has not landed yet — nothing is written, no contact.
 *
 * The 90-degree display rotation is why the cell is addressed with the object's X feeding the
 * tilemap's vertical axis and its Y feeding the horizontal one — see tileAddrForPixel, whose
 * own address arithmetic the ROM assumes.
 *
 * NAME: HELD at the neutral loc_, deliberately. The third naming review refuted BOTH blind
 * proposals for this routine: they independently made the same axis error described above and
 * then each filed the resulting nonsense as an open question rather than as a signal to stop.
 * Their candidate names happen to survive the correction, but neither rests on a derivation
 * that holds, so nothing is promoted here. Re-derive it in a fresh proposer != confirmer round
 * and promote then. (Also for that round: ROM 0x2083 publishes its 2-or-4 arm-select only from
 * its THIRD step onward; its first two steps write nothing to +2.)
 *
 * Memory-equivalent to the frozen oracle — equivalence-2a2f.test.js.
 * GATE:     capture/clone/replay of real attract dispatches + crafted entries driving each
 *           passable exit (tile < 0xB0, low nibble >= 8, exactly 0xC0), every slope class and
 *           its offset, and both landing arms (rewrites OBJ_Y / leaves it). The
 *           land-and-rewrite is a non-attract frontier the crafted entries carry. The RAM diff
 *           excludes the dead STACK_SCRATCH the oracle's push/pop bracket around the cell
 *           lookup writes. Teeth: an off-by-one passable threshold, a dropped 4 px nudge-undo,
 *           and a flipped landing comparison.
 * LIVE-OUT: the object-record OBJ_Y byte (record +5, rewritten only on the landing arm), plus
 *           the contact flag returned BOTH as a boolean AND in register A (1 = contact,
 *           0 = none). A is load-bearing, not residual: both callers (ROM 0x2053, 0x20EC) are
 *           still translated and read the answer with `and a / jp nz`, so A is this routine's
 *           register boundary until they are rewritten. The oracle's other residual registers,
 *           its flags (both callers recompute them with `and a`) and its terminal ret are dead.
 * NAMES:    OBJ_X (record +3) and OBJ_Y (record +5) from names.js, addressed relative to the
 *           caller's object pointer — imported rather than written as bare +3/+5, so the axis
 *           error corrected above cannot be reintroduced by reading the offsets off this file.
 *           The probed cell is tilemap video RAM (0x7400 page), which has no names.js name; its
 *           address is computed by tileAddrForPixel (ROM 0x2FF0).
 */

import { u8 } from "../../../core/int.js";
import { OBJ_X, OBJ_Y } from "./names.js";
import { tileAddrForPixel } from "./tileAddrForPixel.js"; // ROM 0x2FF0

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
    regs.a = 0x01; // contact, in A — see noContact() for why A is the live-out
    return true;
  }
  return noContact();

  // The contact flag is returned BOTH as a JS boolean and in A. A is not decoration: the two
  // callers (ROM 0x2053 and 0x20EC) are still translated, and they read the answer out of the
  // accumulator — `and a / jp nz` — exactly as the oracle leaves it (`ld a,0x01` on the landing
  // arm, `xor a` here). A JS `return false` alone leaves A holding whatever the preceding
  // gravity step left there, which is reliably NON-ZERO, so every probe would report contact
  // and the caller would branch into its collision arm. A is this routine's register boundary
  // until both callers are rewritten, the same way startMarioFallWhenGroundGivesWay hands D/HL to
  // decideSlopeGirderFooting across an un-promoted register-ABI boundary. The flags A also
  // carries are dead: both callers recompute them with `and a`.
  function noContact() {
    regs.a = 0x00;
    return false;
  }
}
