// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3131 — let the caller proceed on seven of every eight frames; skip it on the eighth.
 *
 * A frame-phase caller-skip gate keyed to the low three bits of FRAME. On the seven frames of every
 * eight where those bits are not all set it returns normally, so the caller runs its remaining work.
 * On the one frame in eight where they are all set it performs the two-level caller-skip, so the
 * caller returns without doing that work — throttling whatever the caller drives to a 7-in-8 duty
 * cycle.
 *
 * It is the fastest member of a four-gate family — one-half, five-eighths, three-quarters, and this
 * arm's seven-eighths — that a difficulty-clamped table selects among by DIFFICULTY, so a higher
 * difficulty lets the gated action run on more frames.
 *
 * Expressed here as the boolean early-return idiom: true lets the caller continue, false makes it
 * return at once (`if (!loc_3131(m)) return;`).
 *
 * A LEAF — reads FRAME, writes nothing, calls nothing.
 *
 * Reads: FRAME. Writes: nothing.
 * LIVE-OUT: the proceed/skip decision. In the raw form it is carried as a normal return against a
 * caller-skip — two different stack deltas and two different return addresses; here it is the
 * boolean.
 */

import { FRAME } from "./names.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {boolean}  true to let the caller proceed; false to make it return at once.
 */
export function loc_3131(m) {
  const { mem } = m;

  // Proceed on the seven frames of every eight where the low three bits of the frame
  // counter are not all set; skip the caller on the eighth (when they are all set).
  return (mem.read8(FRAME) & 7) !== 7;
}
