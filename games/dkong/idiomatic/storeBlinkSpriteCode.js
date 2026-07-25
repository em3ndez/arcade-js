// SPDX-License-Identifier: GPL-3.0-only
/**
 * storeBlinkSpriteCode — commit sprite record #1's tile-code byte, the shared tail
 * of the attract/how-high blink driver. ROM 0x04ac.
 *
 * The colour-cycle driver (entry_03fb, reached once per frame from loc_197a) blinks a
 * pair of decorative sprites — records 0 and 1 in the sprite shadow buffer — by
 * toggling bit 7 (the flip/visibility bit) of their code bytes 0x6901 and 0x6905. Its
 * three arms (loc_04a3 "leave as-is", loc_04e1 "blink ON" = OR 0x80, loc_04f9 "blink
 * OFF" = AND 0x7F) each hand this routine, in A, the finished code byte for record 1
 * and then fall/jump into it. This routine is the one place that actually stores it:
 *
 *   - It always writes A into record 1's code byte (0x6905 = SPRITE_BUFFER + 5).
 *   - Additionally, once per colour-cycle sweep — when the sweep counter C (0x6390,
 *     staged into the C register by loc_0486) is at phase (C & 0x47) == 0x40, i.e.
 *     bit 6 set AND the low three bits clear — it flips the code's two low bits
 *     (XOR 0x03), advancing that sprite's tile to its alternate animation cell. Any
 *     other counter value stores A unchanged.
 *
 * The oracle stores twice on the toggle arm (A, then A ^ 0x03); only the final byte is
 * observable at the exit, so this writes it once. A near-pure leaf: reads only the two
 * register inputs A and C, writes only 0x6905, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-04ac.test.js.
 * GATE:     exhaustive — the byte written to 0x6905 is a pure total function of
 *           (A, C); compared against the oracle over all 65,536 (A, C) combos, plus
 *           real attract dispatches (both the plain-store and the toggle arm occur
 *           naturally) via a fresh-clone whole-machine RAM diff + crafted toggle-arm
 *           entries. Reached from the colour-cycle driver entry_03fb (attract + how-high).
 * LIVE-OUT: memory-only — the single byte at 0x6905. No live registers/flags: the sole
 *           caller loc_197a (@0x19b3, top of the tail-call chain) immediately calls the
 *           next routine (0x2808) without reading A/B/C/F, so the oracle's residual
 *           registers are dead ABI; SP/PC are the `ret` bookkeeping the JS call stack
 *           replaces.
 * NAMES:    SPRITE_BUFFER (0x6900) from ram.js — 0x6905 is record #1's code byte
 *           (+4 for record 1, +1 for the code field). The register inputs are A (the
 *           code byte to store) and C (the colour-cycle counter 0x6390); neither is a
 *           RAM reference within this routine.
 */
import { SPRITE_BUFFER } from "../optimized/ram.js";

// Record #1's code byte inside the sprite shadow buffer: base + 4 (record 1) + 1 (code).
const SPRITE1_CODE = SPRITE_BUFFER + 5; // 0x6905

export function storeBlinkSpriteCode(m) {
  const { regs, mem } = m;
  const code = regs.a; // the finished tile-code byte (bit 7 already set by the caller arm)
  const counter = regs.c; // the colour-cycle sweep counter (0x6390), staged by loc_0486

  // The counter's once-per-sweep "advance the tile" phase: bit 6 set and the low three
  // bits clear. Only then does the code step to its alternate animation cell.
  const advanceTile = (counter & 0x47) === 0x40;

  mem.write8(SPRITE1_CODE, advanceTile ? code ^ 0x03 : code);
}
