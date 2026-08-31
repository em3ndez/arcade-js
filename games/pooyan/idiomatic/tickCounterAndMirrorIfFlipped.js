// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { FLIP_SCREEN_FLAG } from "./names.js";
import { mirrorSpriteListVertically } from "./mirrorSpriteListVertically.js";
/**
 * tickCounterAndMirrorIfFlipped — tick a caller-set frame counter, then run the flip-screen mirror pass when armed.
 *
 * Decrements the byte the caller points at (its per-frame counter), then gates on the screen
 * orientation flag: while it is non-zero (normal upright orientation) nothing more happens;
 * once it is zero (screen flipped) the sprite display list is mirrored vertically.
 *
 * LIVE-OUT: memory only — the counter byte and, on the flipped path, the mirrored list. The
 * tamper caller tail-jumps here and the inline twin rets straight after; no register survives.
 */
export function tickCounterAndMirrorIfFlipped(m, counter = m.regs.hl) {
  const { mem8 } = m;
  mem8[counter] = u8(mem8[counter] - 1);
  if (mem8[FLIP_SCREEN_FLAG] !== 0) return; // normal orientation: skip the mirror
  mirrorSpriteListVertically(m);
}
