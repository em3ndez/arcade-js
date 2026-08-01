// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3110 — frame-phase caller-skip guard: proceed on the odd frames (one of every two).  ROM 0x3110.
 *
 * The head arm of the four-guard family at ROM 0x3110-0x313B (siblings 0x311b, 0x3126,
 * 0x3131), selected by difficulty through the clamped jump table in sub_30fa: it reads
 * DIFFICULTY (0x6380), clamps it to 0..5, and dispatches THIS arm for difficulty 0 and 1,
 * 0x311b for 2, 0x3126 for 3/4, and 0x3131 for 5. Every arm reads the low bits of the frame
 * counter and returns whether the caller should proceed this frame, so the family paces some
 * per-frame action to a duty cycle that widens as difficulty climbs — this arm's 1/2, then
 * 5/8, then 3/4, then 7/8. This is the narrowest (lowest-difficulty) arm: it lets the gated
 * action run on every other frame.
 *
 * This arm IS on a live path. The family is dispatched by handler_1977 → entry_30ed →
 * sub_30fa, which reads DIFFICULTY and clamps it before selecting an arm through its inline
 * table. Attract runs at low difficulty, so index 0/1 both select THIS arm and it is
 * genuinely exercised there (measured ~1197 dispatches over 2000 attract frames); the
 * higher-difficulty siblings are never selected in attract and stay dark (0 dispatches) —
 * which is why the sibling arms' notes say the family is "not yet wired". It is: only its
 * low-difficulty entry is what runs during attract.
 *
 * In the raw Z80 this is the caller-skip trick: on the proceed decision the guard returns
 * normally so the caller keeps running; otherwise it discards its own return address so
 * control splices up a level, skipping the rest of whoever ran the dispatch. The idiomatic
 * form drops that stack manipulation (the Z80 stack is the JS call stack) and returns the
 * decision as a boolean the caller consumes as an early return: `if (!loc_3110(m)) return;`.
 * true = proceed this frame, false = skip.
 *
 * THE POLARITY OUTLIER. This arm proceeds exactly when the frame counter's low bit is SET —
 * `(FRAME & 1) == 1`, an EQUALITY on bit 0 (odd frames). That is genuinely different in kind
 * from the three siblings, which each test a less-than on a wider phase. In the raw bytes the
 * difference is a single opcode — this arm's `ret z` (equality) versus the siblings' `ret m`
 * (the sign of the compare, i.e. less-than) — and it inverts the family at both ends of its
 * range: at FRAME even ONLY this arm skips, and copying a sibling's sign test onto it would
 * flip the decision on every frame. So the exact comparison here is load-bearing and the
 * teeth pin both the polarity (equality, not less-than) and the mask (low bit, not a wider
 * phase).
 *
 * A LEAF — reads one byte, writes nothing, calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3110.test.js.
 * GATE:     exhaustive — pure predicate over all 256 FRAME byte values vs the oracle's
 *           skip decision, cross-checked that neither side writes RAM — PLUS real captured
 *           live dispatches: unlike its siblings this arm IS reached during attract, so the
 *           test replays every natural 0x3110 dispatch over 2000 frames and asserts loc_3110
 *           agrees with the oracle on each live FRAME value.
 * LIVE-OUT: memory-only (writes none) — the control-flow boolean is the whole output; the
 *           residual registers/flags and the two-level Z80 return the oracle leaves are the
 *           dead return mechanism, replaced by a plain JS return the caller reloads past.
 * NAMES:    FRAME (0x601A) from ram.js.
 */

import { FRAME } from "./ram.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {boolean}  true to let the caller proceed this frame; false to make it return at once.
 */
export function loc_3110(m) {
  // Proceed on the odd frames — those where the frame counter's low bit is set; on the even
  // frames (low bit clear) skip the caller for this frame.
  return (m.mem.read8(FRAME) & 1) === 1;
}
