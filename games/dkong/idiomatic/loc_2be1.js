// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2be1 — resolve whether Mario's airborne descent has reached a tile surface;
 * on a hit, snap him onto it and abort the collision probe.  ROM 0x2BE1.
 *
 * The tail of the tile-classifier gate (entry_2b9b): it is entered by a tail-jump
 * once the classifier has built the tile-column boundary in C. It measures how far
 * Mario has descended by comparing a probe value against that boundary:
 *
 *     probe = MARIO_AIR_PREV_Y - (object Y field) + rowOffset
 *
 * where the previous-frame airborne Y comes from MARIO_AIR_PREV_Y, the object's
 * current Y is the record field at +5 of the caller's object pointer (in the Mario
 * collision case that pointer is the Mario block, so +5 aliases MARIO_Y), and
 * rowOffset is the tile-row adjustment the classifier passes in.
 *
 *   - probe ABOVE the boundary (probe > C): Mario is still clear of this tile.
 *     Report the "still airborne, keep probing" code (2) and return normally so
 *     the classifier's caller continues its collision walk.
 *
 *   - probe AT OR BELOW the boundary (probe <= C): Mario has reached the surface.
 *     Snap MARIO_Y to just above the boundary (C - 7), report the "landed" code (1),
 *     and take the two-frame unwind — the landing aborts the whole multi-probe walk,
 *     not just this classifier call. That unwind is expressed as returning `false`
 *     under the caller-skip convention (the classifier propagates it, and its caller
 *     completes it with `if (!callee) return`).
 *
 * Register live-ins come from the still-translated caller: the boundary C, the row
 * offset (the accumulator the classifier leaves), and the object pointer. The result
 * code is left where the caller reads it (its `and a` reject test), with its twin in
 * the secondary result byte, exactly as the oracle leaves them on each arm.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2be1.test.js.
 * GATE:     exhaustive over the (probe, C) decision space (256x256), a boundary-set
 *           cross-product over the three summands to pin the arithmetic wrap, and real
 *           captured 0x2BE1 dispatches from an attract run (both arms occur).
 * LIVE-OUT: MARIO_Y on the at-or-below arm; the result code A (2 = airborne, 1 = landed)
 *           and its twin B; and the caller-skip control flow — the boolean return, where
 *           false is the two-frame unwind. No stack is written (the oracle only pops), so
 *           the memory-equivalence RAM diff needs no stack-scratch exclusion.
 * NAMES:    MARIO_AIR_PREV_Y (0x620C), MARIO_Y (0x6205) from ram.js. The object Y field is
 *           addressed relative to the caller's object pointer, so it carries no ram.js name.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_AIR_PREV_Y, MARIO_Y } from "./ram.js";

/**
 * @param {object} m  the machine. Live-in registers: the object pointer, the column
 *   boundary, and the row offset; live-out registers: the result code and its twin.
 * @returns {boolean} true = normal return (still airborne); false = the two-frame
 *   unwind of the caller-skip convention (landed — the collision walk aborts).
 */
export function loc_2be1(m) {
  const { regs, mem } = m;

  const boundary = regs.c;
  const objectY = mem.read8((regs.ix + 5) & 0xffff); // object record field +5 (Mario: MARIO_Y)
  const probe = u8(mem.read8(MARIO_AIR_PREV_Y) - objectY + regs.e);

  if (probe > boundary) {
    // Still clear of this tile — report "airborne" and let the walk continue.
    regs.a = 2;
    regs.b = 0;
    return true;
  }

  // Reached the surface — snap Mario onto it and abort the whole probe walk.
  mem.write8(MARIO_Y, boundary - 7);
  regs.a = 1;
  regs.b = 1;
  return false;
}
