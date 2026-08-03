// SPDX-License-Identifier: GPL-3.0-only
/**
 * blinkSpritePairByX — pick the decorative-sprite-pair blink phase by the player's X;
 * the bit-6-clear arm of the rivet-board colour-cycle blink block. ROM 0x0509.
 *
 * On the 100m rivet board (BOARD 0x6227 == 4) the colour-cycle driver blinks a pair of
 * decorative sprites — records 0 and 1 in the sprite shadow buffer — by driving bit 7
 * (the flip/visibility bit) of their code bytes 0x6901 and 0x6905. Its parent loc_04be
 * splits on bit 6 of the sweep counter C; this routine is the bit-6-clear half. It reads
 * the player X (MARIO_X, 0x6203) and routes purely on which screen half he is in:
 *
 *   - X >= 0x80 (right half)  ->  blinkSpritePairOff  (force bit 7 CLEAR on both bytes)
 *   - X <  0x80 (left half)   ->  blinkSpritePairOn   (set   bit 7       on both bytes)
 *
 * The oracle expresses this as `ld a,(0x6203) / cp 0x80 / jp nc,0x04f9 / jp 0x04e1`;
 * `jp nc` (no borrow) is the unsigned "A >= 0x80" test, so it selects the OFF arm on the
 * right half and the ON arm on the left. Both callees are already idiomatic and take the
 * machine; they read the sweep counter C — which flows in from the parent through regs.c
 * — inside their shared store tail (storeBlinkSpriteCode, ROM 0x04ac), so the two ROM
 * tail-jumps become direct JS calls with no register marshalling. This routine writes no
 * memory of its own; its whole footprint is the callee's {0x6901, 0x6905}.
 *
 * Reached on the rivet board only (BOARD == 4), so attract (25m only) never dispatches it
 * — its realism comes from crafted entries built on real captured attract states.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0509.test.js.
 * GATE:     crafted-entry — loc_0509 is unreached in attract (0 dispatches), so it is
 *           gated by crafting BOTH branch arms (X below, AT, and above 0x80 — including
 *           the exact 0x80 boundary) on real 0x04ac-captured attract bases, fresh clone
 *           per side, whole-machine RAM (minus STACK_SCRATCH) identical to the oracle, and
 *           the oracle's write footprint proven ⊆ {0x6901, 0x6905}. Teeth: a boundary-
 *           flipped twin (`>` instead of `>=`) that mis-routes only at X == 0x80.
 * LIVE-OUT: memory-only — bytes 0x6901 and 0x6905 (written by whichever blink arm runs;
 *           both arms write both bytes). The tail-call chain returns up to loc_197a, which
 *           reads no A/B/C/F before overwriting them, so the oracle's residual A/flags are
 *           dead ABI; SP/PC are `ret` bookkeeping the JS call stack replaces. No register
 *           is SET on entry: C already holds the sweep counter and is preserved by
 *           threading m into the idiomatic callees.
 * NAMES:    MARIO_X (0x6203) from ram.js — the player X the branch reads. The two blink
 *           bytes 0x6901/0x6905 live inside the callees; register C is the colour-cycle
 *           sweep counter (0x6390), consumed only in the shared store tail.
 */
import { MARIO_X } from "./ram.js";
import { blinkSpritePairOff } from "./blinkSpritePairOff.js"; // ROM 0x04f9
import { blinkSpritePairOn } from "./blinkSpritePairOn.js"; // ROM 0x04e1

export function blinkSpritePairByX(m) {
  // Route the decorative-sprite blink by the player's screen half. `cp 0x80` + `jp nc`
  // is the unsigned "X >= 0x80" (right half) test; anything below it (left half) blinks ON.
  if (m.mem.read8(MARIO_X) >= 0x80) {
    blinkSpritePairOff(m); // ROM 0x04f9 — right half: force bit 7 clear on both records
  } else {
    blinkSpritePairOn(m); // ROM 0x04e1 — left half: set bit 7 on both records
  }
}
