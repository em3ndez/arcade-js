// SPDX-License-Identifier: GPL-3.0-only
/**
 * computeTileVariantFromTimer (ROM 0x211d) -- fold a value into a 2-bit tile-animation variant.
 *
 * WHAT IT IS
 *   Animated figures cycle their drawn tile through the free-running frame counter. This is the
 *   arithmetic core of that: given an input value in register B and a carry-ish byte in C, it
 *   returns a two-bit variant index that steps as FRAME_COUNTER advances, so the same figure is drawn
 *   with tile+0, +1, +2, +3 -- the nibble-swap feeds bits 4-5, so each phase holds ~16 frames (a ~64-frame
 *   cycle). Below the range limit of 112 it folds
 *   `(nibble-swap(FRAME_COUNTER) + B + C) & 3`; at or above 112 it does not fold -- it saturates to
 *   the fixed 0x80 out-of-range marker via markValueOutOfRange.
 *
 * ROLE IN THE MACHINE
 *   The bottom of the tile-animation stack. computeTileVariantFromValueAndTimer (0x2104) is the front
 *   door that pre-biases a coordinate before calling here; the object-grid draw walk also folds
 *   FRAME_COUNTER straight through this routine for its animated cells. Reads FRAME_COUNTER (0x425f);
 *   A and the Z80 flags are deliberately left unchanged (callers rely on that).
 *
 * ROM 0x211d.  Grounding: [seen] (names.js cert for 0x211d).
 *
 * LIVE-OUT: register B = the 2-bit variant index, or 0x80 on the saturation path.
 */
import { FRAME_COUNTER } from "./names.js";
import { markValueOutOfRange } from "./markValueOutOfRange.js";

const RANGE_LIMIT = 112; // B at or above this saturates instead of folding

export function computeTileVariantFromTimer(m, value = m.regs.b, carryIn = m.regs.c) {
  const { mem8 } = m;

  // Out of range: hand off to the saturation arm, which slams B to the 0x80 sentinel and returns.
  if (value >= RANGE_LIMIT) return markValueOutOfRange(m);

  // FRAME_COUNTER is the per-frame timer; swapping its nibbles spreads the fast-moving low bits into
  // the top so successive frames land on different low-2-bit phases (from bits 4-5), giving a ~64-frame cycle.
  const status = mem8[FRAME_COUNTER];
  const swapped = ((status >> 4) | (status << 4)) & 0xff;
  // Add the input and C, keep the low two bits = the tile-variant index. Note C here is the Z80
  // register (0x00 or 0xff, not a 0/1 carry bit): 0xff == -1 mod 4, so a set C folds the phase back
  // one step rather than forward one.
  return (m.regs.b = (swapped + value + carryIn) & 0x03);
}
