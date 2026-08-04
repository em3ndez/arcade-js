// SPDX-License-Identifier: GPL-3.0-only
/**
 * blinkSpritePairOn — the colour-cycle blink driver's "blink ON" arm: raise the blink
 * bit (bit 7) on BOTH decorative blink sprites, then commit via the shared store tail.
 * ROM 0x04e1. (Exact mirror of blinkSpritePairOff, ROM 0x04f9.)
 *
 * The per-frame colour-cycle driver (entry_03fb) makes a pair of decorative sprites —
 * records 0 and 1 in the sprite shadow buffer — blink by driving bit 7 (the
 * flip/visibility bit) of their code bytes 0x6901 and 0x6905 through three arms:
 * loc_04a3 "leave as-is" (paintColorColumnAndHoldBlink), this "blink ON" arm, and its
 * exact mirror loc_04f9 "blink OFF" (AND 0x7F). This is the ON phase:
 *
 *   1. It ORs 0x80 into record #0's code byte (0x6901) in place — the bit set directly.
 *   2. It ORs 0x80 into record #1's code byte (0x6905) in A and falls into the shared
 *      blink-store tail loc_04ac (storeBlinkSpriteCode), which writes A to 0x6905 and may
 *      apply its once-per-sweep low-2-bit tile toggle (driven by the counter staged in C).
 *
 * Reached on the rivet board (BOARD 0x6227 == 4) only, from loc_04be / loc_0509, which
 * route to it by Kong's X (0x6203) and the sweep counter's bit 6 — so attract (25m only)
 * never dispatches it. The store callee is already idiomatic, so the tail is a direct call
 * with no register-ABI plumbing. Writes exactly two bytes (0x6901 and 0x6905); reads
 * 0x6901, 0x6905, and the sweep counter C live-in.
 *
 * Memory-equivalent to the frozen oracle — equivalence-04e1.test.js.
 * GATE:     exhaustive (value-level) — the two bytes it leaves at 0x6901/0x6905 are a
 *           total function of (byte@0x6901, byte@0x6905, C): 0x6901' = in|0x80 depends
 *           only on its own input, 0x6905' = store(in|0x80, C) only on (0x6905,C), so the
 *           two dimensions are swept exhaustively and independently vs the oracle (256 +
 *           65,536 combos) on a reused clone whose faithfulness the PURITY footprint
 *           licenses. Plus crafted whole-machine bases from REAL captured 0x04ac attract
 *           dispatches (0x04e1 itself needs board 4, unreached by attract) with a fresh
 *           clone per side, covering both the plain-store and the once-per-sweep toggle
 *           phase. Teeth: a wrong-bit twin (0x6905) and a skip-0x6901 twin — both caught.
 * LIVE-OUT: memory-only — 0x6901 and 0x6905. The exit tail loc_04ac is itself memory-only,
 *           and the whole tail-call chain (…loc_197a, the top) calls the next routine
 *           without reading A/B/C/F, so the oracle's residual registers are dead ABI; SP/PC
 *           are the `ret` bookkeeping the JS call stack replaces.
 * NAMES:    SPRITE_BUFFER (0x6900) from names.js — 0x6901 is record #0's code byte (+1),
 *           0x6905 record #1's (+5). C is the colour-cycle sweep counter (0x6390), staged
 *           by loc_0486 and consumed by the store tail; not a RAM reference within here.
 */
import { SPRITE_BUFFER } from "./names.js";
import { storeBlinkSpriteCode } from "./storeBlinkSpriteCode.js";

// Record #0's code byte inside the sprite shadow buffer: base + 0 (record 0) + 1 (code).
const SPRITE0_CODE = SPRITE_BUFFER + 1; // 0x6901
// Record #1's code byte inside the sprite shadow buffer: base + 4 (record 1) + 1 (code).
const SPRITE1_CODE = SPRITE_BUFFER + 5; // 0x6905

const BLINK_BIT = 0x80; // bit 7 — the code byte's flip/visibility bit the driver blinks

export function blinkSpritePairOn(m) {
  const { regs, mem } = m;

  // 1. Set the blink bit on record #0's code byte, in place.
  mem.write8(SPRITE0_CODE, mem.read8(SPRITE0_CODE) | BLINK_BIT);

  // 2. Stage record #1's code byte with the blink bit set, and hand it to the shared
  //    blink-store tail, which commits it to 0x6905 (with the phase-gated tile toggle).
  regs.a = mem.read8(SPRITE1_CODE) | BLINK_BIT;
  storeBlinkSpriteCode(m);
}
