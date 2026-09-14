// SPDX-License-Identifier: GPL-3.0-only
import { POINTER_PARITY, ALT_DRAW_PTR_CLR_LO, ALT_DRAW_PTR_CLR_HI, ALT_DRAW_PTR_SET_LO, ALT_DRAW_PTR_SET_HI } from "./names.js";

/**
 * selectPointerPair — pick one of two hard-coded draw-struct pointers by a RAM parity flag. ROM 0xb967.
 *
 * Role in the machine: the moving-object renderer (drawMovingObjectSlots) lays enemy/shot records into
 * the vector display list and, to double-buffer its shadow passes, needs the base address of one of two
 * pre-built draw structures. Which one is live is tracked by a single RAM parity flag (POINTER_PARITY,
 * $415) that the swap logic toggles. This helper reads that flag and hands back the matching (hi, lo)
 * address pair so the caller can cache it as the base pointer for the frame.
 *
 * Behavior: when POINTER_PARITY is zero it returns the "clear" pointer 0xce87/0xce86
 * (ALT_DRAW_PTR_CLR_HI/LO); when non-zero it returns the "set" pointer 0xce6f/0xce6e
 * (ALT_DRAW_PTR_SET_HI/LO). The high byte goes to A, the low byte to X, mirroring the 6502 that left the
 * pair in the A/X registers.
 *
 * Live-out: the register file A (hi) and X (lo); no memory is written. The returned [A, X] array is the
 * caller's copy of the same pair.
 *
 * Grounding: [seen]
 */
export function selectPointerPair(m) {
  const { mem8 } = m;
  let a, x;
  // Parity flag $415 selects which double-buffered draw struct is base for this frame.
  if (mem8[POINTER_PARITY] === 0) {
    // Even parity: the "clear" pair 0xce87 / 0xce86.
    a = mem8[ALT_DRAW_PTR_CLR_HI];
    x = mem8[ALT_DRAW_PTR_CLR_LO];
  } else {
    // Odd parity: the "set" pair 0xce6f / 0xce6e.
    a = mem8[ALT_DRAW_PTR_SET_HI];
    x = mem8[ALT_DRAW_PTR_SET_LO];
  }
  // Publish hi->A, lo->X (as the 6502 left them) and hand the caller its own copy.
  return [(m.regs.a = a), (m.regs.x = x)];
}
