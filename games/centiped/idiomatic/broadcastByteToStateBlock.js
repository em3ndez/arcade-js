// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_ef, loc_f0, loc_f1, loc_f2, loc_f3, loc_f4, loc_f5, loc_f6, loc_f7, loc_f8,
  loc_bd, loc_bf, loc_fe, FLIP_SCREEN, loc_2400,
} from "./names.js";

/**
 * broadcastByteToStateBlock -- fan a single source byte across the whole zero-page
 * state block (plus the flip-screen latch and a dead store).
 *
 * ROLE IN THE MACHINE. The $ef..$f8 state block (see seedStateBlockConstants) is
 * normally planted with individual fixed constants. This is its companion "set the
 * whole block to ONE value" operation: it reads a single source byte from $fe and
 * writes that same value into the two lead cells ($bd/$bf), the ten-cell block run
 * ($ef,$f0..$f8), the hardware flip-screen output latch ($1c07), and the ignored
 * $2400 mirror. Straight-line: no branches, no sub-calls, no per-cell logic.
 *
 * WHY BROADCAST A SINGLE VALUE. The original ROM uses this idiom to force the block
 * into a uniform state on certain per-frame/per-event transitions (e.g. blanking or
 * resetting orientation state en masse) where every cell should carry the same byte.
 * Because the flip-screen latch is included, bit 7 of the broadcast value directly
 * selects the display orientation as a side effect of the fan-out.
 *
 * THE DEAD STORE. $2400 lands on a ROM-space address the board ignores; it is
 * written only so the memory mirror matches the original program exactly.
 *
 * GROUNDING: [code]. LIVE-OUT: $bd,$bf, FLIP_SCREEN ($1c07), $ef,$f0..$f8, and the
 * ignored $2400 store -- all set to mem8[$fe]. No return value.
 */
export function broadcastByteToStateBlock(m) {
  const { mem8 } = m;
  // Read the single source byte once; this exact value is fanned to every target.
  const v = mem8[loc_fe]; // the value fanned to the whole block
  // Two lead status cells.
  mem8[loc_bd] = v;
  mem8[loc_bf] = v;
  // Flip-screen output latch: bit 7 of the broadcast value drives display orientation.
  mem8[FLIP_SCREEN] = v; // flip-screen latch = bit7 of the value
  // Dead store mirrored to ROM-space $2400 (ignored by the board; kept for exactness).
  mem8[loc_2400] = v; // dead store, mirrored
  // The ten-cell state-block run, written in the ROM's original store order.
  mem8[loc_f5] = v;
  mem8[loc_f7] = v;
  mem8[loc_f6] = v;
  mem8[loc_f0] = v;
  mem8[loc_ef] = v;
  mem8[loc_f1] = v;
  mem8[loc_f2] = v;
  mem8[loc_f3] = v;
  mem8[loc_f4] = v;
  mem8[loc_f8] = v;
}
