// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3131 — let the caller proceed on seven of every eight frames; skip it on the
 * eighth.  ROM 0x3131.
 *
 * A frame-phase caller-skip gate keyed to the low three bits of the frame counter.
 * It reads FRAME and, on the seven frames of every eight where those bits are not all
 * set, returns normally so the caller runs its remaining work. On the one frame in
 * eight where they are all set (FRAME & 7 == 7) it performs the two-level
 * `inc sp; inc sp; ret` caller-skip, so the caller returns without doing that work —
 * throttling whatever the caller drives to a 7-in-8 duty cycle.
 *
 * It is the fastest member of a four-gate family (loc_3110 1/2, loc_311b 5/8,
 * loc_3126 3/4, loc_3131 7/8) that gateObjectUpdateByDifficulty selects among by DIFFICULTY (0x6380),
 * so higher difficulty lets the gated action run on more frames.
 *
 * Expressed as the boolean early-return idiom: returns true to let the caller
 * continue, false to make it return at once (`if (!loc_3131(m)) return;`).
 *
 * A LEAF: reads FRAME, writes nothing, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3131.test.js.
 * GATE:     exhaustive over all 256 FRAME values (the routine's sole input). No
 *           realism arm: 0x3131 is never dispatched in attract — it is reached only
 *           through the untranslated entry_30ed rst-0x28 table — so there are no real
 *           captures to replay, and the exhaustive sweep is itself a complete proof.
 * LIVE-OUT: the boolean proceed/skip decision — the oracle carries it as normal-ret
 *           vs caller-skip (a +2 vs +4 SP delta and a different return address). It
 *           writes no memory; the residual registers/flags are dead.
 * NAMES:    FRAME (0x601A) from names.js.
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
