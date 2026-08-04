// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_311b — frame-phase caller-skip guard: proceed on 5 of every 8 frames.
 *
 * One arm of a family of four guards selected by DIFFICULTY: a difficulty-clamped table picks the
 * narrowest arm at difficulty 0 and 1, THIS arm at 2, and wider arms above that. Every arm reads the
 * low bits of FRAME and answers whether the caller should proceed this frame, so the family paces
 * some per-frame action to a duty cycle that widens as difficulty climbs — one-half, then this
 * arm's five-eighths, then three-quarters, then seven-eighths.
 *
 * In the raw form this is the caller-skip trick: on a proceed the guard returns normally and the
 * caller keeps running; otherwise it discards its own return address so control splices up a level,
 * skipping the rest of whoever ran the dispatch. Here that stack manipulation is gone and the
 * decision IS the return value, which the caller consumes as an early return —
 * `if (!loc_311b(m)) return;`. True = proceed this frame, false = skip.
 *
 * The proceed window is the first five phases of FRAME's eight-phase low bits: `(FRAME & 7) < 5`.
 * That is a genuine LESS-THAN on the phase, not an equality and not a half-open carry test. The
 * sibling arms differ from it only in their mask and their compare value, so the exact comparison
 * here is load-bearing — a copied sibling constant would be wrong on only some frames.
 *
 * A LEAF — reads one byte, writes nothing, calls nothing.
 *
 * Reads: FRAME. Writes: nothing.
 * LIVE-OUT: the proceed/skip boolean, and nothing else.
 */

import { FRAME } from "./names.js";

export function loc_311b(m) {
  // Proceed on the first five of the frame counter's eight repeating phases; on the last
  // three, skip the caller for this frame.
  return (m.mem.read8(FRAME) & 7) < 5;
}
