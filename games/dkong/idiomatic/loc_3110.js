// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3110 — frame-phase caller-skip guard: proceed on the odd frames, one of every two.
 *
 * One arm of a family of four guards selected by DIFFICULTY: a difficulty-clamped table picks this
 * arm at difficulty 0 and 1, and progressively wider arms above that. Every arm reads the low bits
 * of FRAME and answers whether the caller should proceed this frame, so the family paces some
 * per-frame action to a duty cycle that widens as difficulty climbs — one-half, then five-eighths,
 * three-quarters, seven-eighths. This is the narrowest arm: it lets the gated action run on every
 * other frame.
 *
 * In the raw form this is the caller-skip trick: on a proceed the guard returns normally and the
 * caller keeps running; otherwise it discards its own return address so control splices up a level,
 * skipping the rest of whoever ran the dispatch. Here that stack manipulation is gone and the
 * decision IS the return value, which the caller consumes as an early return —
 * `if (!loc_3110(m)) return;`. True = proceed this frame, false = skip.
 *
 * THE POLARITY OUTLIER, and why the exact comparison is load-bearing. This arm proceeds exactly when
 * FRAME's low bit is SET: an EQUALITY on bit 0. Its three siblings each test a LESS-THAN on a wider
 * phase. That is a difference in kind rather than degree — the masked value here is only ever 0 or
 * 1, so a sibling's less-than would invert the decision on every single frame.
 *
 * A LEAF — reads one byte, writes nothing, calls nothing.
 *
 * Reads: FRAME. Writes: nothing.
 * LIVE-OUT: the proceed/skip boolean, and nothing else.
 */

import { FRAME } from "./names.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {boolean}  true to let the caller proceed this frame; false to make it return at once.
 */
export function loc_3110(m) {
  // Proceed on the odd frames — those where the frame counter's low bit is set; on the even
  // frames (low bit clear) skip the caller for this frame.
  return (m.mem.read8(FRAME) & 1) === 1;
}
