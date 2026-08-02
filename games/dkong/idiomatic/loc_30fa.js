// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_30fa — pick this difficulty's frame gate and hand its proceed/skip decision to the
 * caller.  ROM 0x30FA.
 *
 * The selector in front of the four-gate family at ROM 0x3110-0x313B. It reads DIFFICULTY,
 * clamps it to the six entries its ROM table has (anything at or above 6 uses the last one),
 * and runs the gate that entry names. Each gate reads the low bits of the frame counter and
 * answers whether the caller should do its work this frame, so the pair paces a per-frame
 * action to a duty cycle that widens as difficulty climbs:
 *
 *   difficulty 0, 1 -> loc_3110  every other frame  (1/2)
 *   difficulty 2    -> loc_311b  five frames in 8   (5/8)
 *   difficulty 3, 4 -> loc_3126  three frames in 4  (3/4)
 *   difficulty 5+   -> loc_3131  seven frames in 8  (7/8)
 *
 * The mapping is the ROM's own six-entry table, not a re-derivation: two of the six entries
 * are duplicates, which is why four gates cover six difficulties. The equivalence test
 * re-derives the whole mapping from the oracle by fingerprinting which gate the oracle
 * actually reaches at each of the 256 possible difficulty bytes, so this table is checked
 * against the ROM rather than transcribed on trust.
 *
 * The clamp is a genuine guard but never fires in normal play: DIFFICULTY's own writer
 * already caps it at 5, so only a corrupted or out-of-range value can reach the top entry
 * through the clamp rather than through its own table slot.
 *
 * SKIP-CAPABLE, AND TRANSPARENTLY SO. The gate's answer is not consumed here — it is the
 * caller's. A false means the gate wants the caller's remaining work skipped for this frame,
 * and this routine sits so directly on top of the gate that the skip lands one level further
 * out than the gate itself: the caller of loc_30fa is the one that gets skipped, and ITS
 * caller resumes. So the decision is simply returned unchanged, and a caller consumes it as
 * an early return: `if (!loc_30fa(m)) return;`. true = proceed, false = return at once.
 *
 * NOT RECURSIVE, stated because it is easy to assume of a dispatcher: the six table entries
 * are 0x3110/0x3110/0x311b/0x3126/0x3126/0x3131 and nothing in that family calls back here,
 * so this routine runs its selected gate exactly once and returns. (Verified against the ROM
 * bytes at 0x3104-0x310F and the four gate bodies, all of which are leaves.)
 *
 * The oracle reaches the gate indirectly, through the shared inline-table dispatcher at
 * ROM 0x0028: it lays its six-entry table in ROM right behind itself and lets that dispatcher
 * index it. The dispatcher's index arithmetic wraps at a byte, which cannot matter here — the
 * clamp keeps the index at 5 or below — so the whole of it reduces to the direct table of
 * gate functions used here.
 *
 * Memory-equivalent to the frozen oracle — equivalence-30fa.test.js.
 * GATE:     crafted-entry + exhaustive, in three arms. (1) LIVE: every natural dispatch in a
 *           2000-frame attract run is compared against the oracle as it happens — measured
 *           1197 of them, the first at frame ~585, every one of them at difficulty 1.
 *           (2) CRAFTED: 24 real entry states captured from a separate 900-frame run, each
 *           replayed with DIFFICULTY poked identically on both sides over all six table slots
 *           and past the clamp (240 replays), compared on RAM - STACK_SCRATCH and the
 *           returned decision. (3) EXHAUSTIVE: all 65536 difficulty x frame byte pairs, plus
 *           a mapping check that fingerprints which gate the oracle actually reaches at every
 *           one of the 256 difficulty bytes. Attract only ever presents difficulty 1, so arm
 *           (1) alone covers just the 1/2 gate — arms (2) and (3) are what cover the other
 *           three and the clamp. Teeth: a clamp one short, a table without the ROM's
 *           duplicated slots, and a wrap in place of the clamp, all three caught.
 * LIVE-OUT: the proceed/skip decision, and no memory of its own — neither this routine nor
 *           any gate it selects writes RAM. The oracle's stack churn and its two-word
 *           caller-skip discard are the Z80 return mechanism the boolean replaces; they land
 *           in STACK_SCRATCH and are dead.
 * NAMES:    DIFFICULTY (0x6380) from ram.js; the gates read FRAME (0x601A) themselves.
 */

import { DIFFICULTY } from "./ram.js";
import { loc_3110 } from "./loc_3110.js";
import { loc_311b } from "./loc_311b.js";
import { loc_3126 } from "./loc_3126.js";
import { loc_3131 } from "./loc_3131.js";

/**
 * The ROM's six-entry table, one slot per difficulty, transcribed as the gate functions it
 * names: 1/2, 1/2, 5/8, 3/4, 3/4, 7/8. The duplicated slots are the ROM's, and they are what
 * make the duty cycle widen in four steps over six difficulties.
 */
const FRAME_GATE_BY_DIFFICULTY = [loc_3110, loc_3110, loc_311b, loc_3126, loc_3126, loc_3131];

/**
 * @param {object} m  the machine.
 * @returns {boolean}  true to let the caller proceed this frame; false to make it return at once.
 */
export function loc_30fa(m) {
  // Any difficulty past the end of the table shares the last (widest) gate.
  const difficulty = Math.min(m.mem.read8(DIFFICULTY), FRAME_GATE_BY_DIFFICULTY.length - 1);

  // The gate's decision is the caller's, not ours — pass it up untouched.
  return FRAME_GATE_BY_DIFFICULTY[difficulty](m);
}
