// SPDX-License-Identifier: GPL-3.0-only
/**
 * blinkSpritePairOff — the "blink OFF" arm of the colour-cycle blink driver: force
 * the blink bit off on the pair of decorative sprites. ROM 0x04f9.
 *
 * The colour-cycle driver blinks two decorative sprites — records 0 and 1 in the
 * sprite shadow buffer — by driving bit 7 (the flip/visibility bit) of their code
 * bytes 0x6901 and 0x6905. It has three arms: loc_04a3 "leave as-is", loc_04e1
 * "blink ON" (OR 0x80), and this one, "blink OFF" (AND 0x7F). This arm forces bit 7
 * clear on both records:
 *
 *   - Record 0's code byte (0x6901) is masked with 0x7F and committed here directly.
 *   - Record 1's code byte (0x6905) is masked with 0x7F and handed, in A, to the
 *     shared store tail storeBlinkSpriteCode (ROM 0x04ac) — the one place that stores
 *     record 1 — which commits it to 0x6905 and applies the once-per-sweep low-2-bits
 *     tile toggle keyed on the colour-cycle counter C. The oracle expresses this as
 *     `and 0x7f` then `jp 0x04ac`; the tail call becomes a direct JS call here.
 *
 * NOT reached in attract (0 dispatches over 6000 frames): it is the OFF phase, taken
 * on the 100m rivet board (via loc_0509, X >= 0x80) and specific colour paths (via the
 * loc_04f1 fall-through). Its logic is nonetheless a pure total function of its three
 * inputs, so it is gated exhaustively; realism is supplied by crafted entries built on
 * real captured attract states (see equivalence-04f9.test.js).
 *
 * Memory-equivalent to the frozen oracle — equivalence-04f9.test.js.
 * GATE:     exhaustive + crafted-entry — the pair {0x6901, 0x6905} is a pure total
 *           function of (mem[0x6901], mem[0x6905], C); compared against the oracle over
 *           the full (v1, v5) grid on both store arms + all-256 C breadth. loc_04f9 is
 *           NOT reached in attract, so whole-machine realism comes from crafted entries
 *           on real 0x04ac-captured attract states (fresh-clone RAM diff, footprint
 *           proof, arms exercised).
 * LIVE-OUT: memory-only — bytes 0x6901 and 0x6905. The blink chain returns (via
 *           storeBlinkSpriteCode's `ret`) to loc_197a, which reads no A/B/C/F before
 *           overwriting them, so the oracle's residual registers/flags are dead ABI;
 *           SP/PC are `ret` bookkeeping the JS call stack replaces.
 * NAMES:    SPRITE_BUFFER (0x6900) from names.js — record 0's code byte = base + 1
 *           (0x6901), record 1's code byte = base + 5 (0x6905). Register input C is the
 *           colour-cycle sweep counter (0x6390), consumed only inside the store tail.
 */
import { SPRITE_BUFFER } from "./names.js";
import { storeBlinkSpriteCode } from "./storeBlinkSpriteCode.js"; // ROM 0x04ac

// Code bytes of the two blinked decorative sprites inside the sprite shadow buffer:
// record 0 at base + 1, record 1 at base + 5 (record stride 4, +1 to the code field).
const SPRITE0_CODE = SPRITE_BUFFER + 1; // 0x6901
const SPRITE1_CODE = SPRITE_BUFFER + 5; // 0x6905

export function blinkSpritePairOff(m) {
  const { regs, mem } = m;

  // Record 0: force the blink bit (bit 7) off, committed here directly.
  mem.write8(SPRITE0_CODE, mem.read8(SPRITE0_CODE) & 0x7f);

  // Record 1: clear the blink bit, then hand the finished code byte to the shared
  // store tail in A (exactly as the oracle's `and 0x7f` / `jp 0x04ac`). The tail
  // commits it to 0x6905 and runs the once-per-sweep low-2-bits tile toggle on C.
  regs.a = mem.read8(SPRITE1_CODE) & 0x7f;
  storeBlinkSpriteCode(m); // ROM 0x04ac
}
