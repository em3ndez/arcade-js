// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2b91 — commit Mario's adjusted X to both the game position and his sprite record.  ROM 0x2B91.
 *
 * The accept arm of a tile-probe: it stores the adjusted X (passed in from the probe) into MARIO_X
 * and into the +0 (X) field of Mario's sprite record, so the on-screen sprite tracks the new
 * position immediately — this write pair is exactly why the Mario sprite record's +0 byte equals
 * MARIO_X live (grounded). It then leaves 1 in the result register for the still-translated caller
 * and performs a caller-skip unwind (two levels up, past the probe's caller).
 *
 * Faithful to translated/loc_2b91.js: the adjusted X is the register live-in (A); the returned
 * boolean models the Z80 `pop hl / ret` skip (each caller propagates it as `if (!loc_2b91(m)) return;`).
 * regs.a = 1 is kept as a register write because the caller chain is still the frozen translation and
 * reads it back; it dissolves to an honest return once that chain is decompiled.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2b91.test.js.
 */
import { MARIO_X, MARIO_SPRITE_RECORD, SPRITE_X } from "./ram.js";

/**
 * @param {object} m  the machine; reads the adjusted X from regs.a (probe live-in).
 * @returns {boolean} false — the caller-skip signal (unwind two levels).
 */
export function loc_2b91(m) {
  const { regs, mem } = m;
  const x = regs.a; // the adjusted X the probe computed
  mem.write8(MARIO_X, x);
  mem.write8((MARIO_SPRITE_RECORD + SPRITE_X) & 0xffff, x);
  regs.a = 0x01; // register live-out consumed by the still-translated caller
  return false; // caller-skip: unwind past the probe's caller
}
