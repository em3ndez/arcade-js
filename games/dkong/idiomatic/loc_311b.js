// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_311b — frame-phase caller-skip guard: proceed on 5 of every 8 frames.  ROM 0x311B.
 *
 * One arm of the four-guard family at ROM 0x3110-0x313B (siblings 0x3110, 0x3126, 0x3131),
 * selected by difficulty through the clamped jump table in sub_30fa: it reads DIFFICULTY
 * (0x6380), clamps it to 0..5, and dispatches arm 0x3110 for 0/1, THIS arm for 2, 0x3126
 * for 3/4, and 0x3131 for 5. Every arm reads the low bits of the frame counter and returns
 * whether the caller should proceed this frame, so the family paces some per-frame action
 * to a duty cycle that widens as difficulty climbs — 1/2, then this arm's 5/8, then 3/4,
 * then 7/8. (The family is present but not yet wired into any live dispatch path.)
 *
 * In the raw Z80 this is the caller-skip trick: on the proceed decision the guard returns
 * normally so the caller keeps running; otherwise it discards its own return address so
 * control splices up a level, skipping the rest of whoever ran the dispatch. The idiomatic
 * form drops that stack manipulation (the Z80 stack is the JS call stack) and returns the
 * decision as a boolean the caller consumes as an early return: `if (!loc_311b(m)) return;`.
 * true = proceed this frame, false = skip.
 *
 * The proceed window is the first five phases of the frame counter's eight-phase low bits:
 * `(FRAME & 7) < 5`. This is a genuine less-than on the phase, NOT an equality or a
 * half-open carry test — the sibling arms differ from it only in their mask and their
 * compare value, so the exact comparison here is load-bearing and the teeth pin it.
 *
 * A LEAF — reads one byte, writes nothing, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-311b.test.js.
 * GATE:     exhaustive — pure predicate over all 256 FRAME byte values vs the oracle's
 *           skip decision, cross-checked that neither side writes RAM. This arm is reached
 *           ONLY through sub_30fa's difficulty-selected table and never on the live
 *           NMI/substate dispatches, so there are no natural dispatches to capture
 *           (measured: 0 over 2000 attract frames); the exhaustive sweep is the whole proof.
 * LIVE-OUT: memory-only (writes none) — the control-flow boolean is the whole output; the
 *           residual registers/flags and the two-level Z80 return the oracle leaves are the
 *           dead return mechanism, replaced by a plain JS return the caller reloads past.
 * NAMES:    FRAME (0x601A).
 */

import { FRAME } from "./ram.js";

export function loc_311b(m) {
  // Proceed on the first five of the frame counter's eight repeating phases; on the last
  // three, skip the caller for this frame.
  return (m.mem.read8(FRAME) & 7) < 5;
}
