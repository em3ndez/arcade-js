// SPDX-License-Identifier: GPL-3.0-only
import {
  loc_ef, loc_f0, loc_f1, loc_f2, loc_f3, loc_f4, loc_f5, loc_f6, loc_f7, loc_f8,
  loc_bd, loc_bf, loc_fe, FLIP_SCREEN, loc_2400,
} from "./names.js";

/**
 * broadcastByteToStateBlock — fan the single source byte across the whole zero-page state block.
 *
 * Reads one byte and writes that same value into every cell of the state block (two lead cells plus a
 * ten-cell run), the flip-screen output latch (bit 7 of the value drives it), and a dead store. A
 * straight-line broadcast: no branches, no sub-calls. The block is otherwise seeded with fixed
 * constants elsewhere; this is the per-frame/per-event "set the block to one value" companion.
 */
export function broadcastByteToStateBlock(m) {
  const { mem8 } = m;
  const v = mem8[loc_fe]; // the value fanned to the whole block
  mem8[loc_bd] = v;
  mem8[loc_bf] = v;
  mem8[FLIP_SCREEN] = v; // flip-screen latch = bit7 of the value
  mem8[loc_2400] = v; // dead store, mirrored
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
