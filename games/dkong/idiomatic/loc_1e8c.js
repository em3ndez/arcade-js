// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1e8c — the per-frame gate on the hit-effect latch: while an effect is playing, spend the
 * frame on one beat of that effect INSTEAD of the gameplay update, and tell the caller to
 * abandon the rest of its cascade.  ROM 0x1E8C.
 *
 * Called once per frame from the shared per-frame update cascade (loc_197a, at ROM 0x197D) and
 * from nowhere else — a scan of the whole 16KB ROM finds exactly one reference to this address,
 * that call, and no jump-table word pointing here. It reads one byte, the hit-effect latch at
 * 0x6350, and branches on it:
 *
 *   - latch clear -> return true, and the caller runs its ordinary frame: the twenty-two updates
 *     that follow, starting with the player movement/climb/jump machine.
 *   - latch set -> hand the frame to the effect-sequence router (dispatchEffectSequenceStep),
 *     which advances whichever of the three effect steps is current, then take the unconditional
 *     caller-skip tail (loc_1e94) the oracle falls into, which answers false. The caller returns
 *     immediately, so NONE of the rest of that frame's gameplay update runs.
 *
 * So the latch suspends gameplay for the duration of an effect: while it is set, the only work
 * the cascade does each frame is one beat of the effect animation, and play resumes on the frame
 * the effect tears itself down.
 *
 * ANY nonzero value counts as set — the gate is a plain zero/nonzero test, not a bit test and not
 * a comparison against 1, even though play only ever puts 0 or 1 in the cell (below). The
 * equivalence sweep over all 256 latch values is what holds that reading honest rather than
 * incidental; the one other reader of this cell does test only bit0, so the distinction is real.
 *
 * THE LATCH (0x6350) — established by ROM scan and by measurement, not assumed. Exactly four
 * instructions in the ROM touch the cell: two writers and two readers.
 *   - SET at ROM 0x2840, inside recordHammerHitOnObject, with the board collision handler's
 *     hit byte — and only after that byte has tested nonzero two instructions earlier, so the
 *     write is always nonzero. It means "the swung hammer just struck a hazard". That routine
 *     runs LATER in the same cascade this one gates (ROM 0x19B6, well past 0x197D), so a hit
 *     recorded on one frame first suspends play on the NEXT.
 *   - CLEARED at ROM 0x1F38, on the teardown beat of animateEffectSpriteThenRearmEffect (the
 *     effect sequence's step 2) — the same beat that resets the sequence to step 0 and re-arms
 *     the parent effect state machine. That clear is what hands play back, and it is the only
 *     way this gate ever reopens.
 *   - READ here, and at ROM 0x03A6 (loc_03a2), which gates on bit0 alone.
 * Measured in play: over 4000 frames of plain attract this routine is dispatched 1970 times, the
 * latch holding 0 on 1532 of them and 1 on the other 438 — and those 438 are exactly the effect
 * router's own 438 recorded dispatches, i.e. every skip here is one effect beat and nothing else
 * reaches the router.
 *
 * WIRED LIVE, WITH ITS SEAM ENTRY. 0x1E8C is a ROUTINES key and machine.js's SEAM_CALLER_SKIP
 * lists it, because the oracle consumes TWO stack words on the skip arm and one on the proceed
 * arm — measured on an instrumented pure-oracle run: SP +4 on 438 skips against +2 on 1532
 * proceeds (an independent 8000-frame run reproduced it at +4 x657 of 4455). Without that entry
 * a still-translated caller leaks two bytes per skip.
 * ★ HONEST LIMIT ON THAT ENTRY: it is currently UNGATED. Under the entropy pin the go-live gate
 * uses, this routine never takes its false arm (0 skips in 8000 pinned frames), so removing the
 * table entry leaves every gate green. It rests on the measurement above, not on a failing test.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1e8c.test.js.
 * GATE:     strict, and REACHABLE NATURALLY ON BOTH ARMS — no crafting needed for coverage.
 *           Hooking 0x1E8C in a plain 4000-frame attract run (no coin, no pokes) captures all
 *           1970 real dispatches, 1532 on the proceed arm and 438 on the skip arm; each is
 *           replayed oracle-vs-idiomatic on fresh clones and compared on game-visible RAM minus
 *           STACK_SCRATCH plus the caller-skip boolean. On top of that, an exhaustive sweep pokes
 *           the latch to all 256 values identically onto three real bases — a latch-set one and
 *           two latch-clear ones, from before and after an effect has ever played — which pins
 *           the gate as zero/nonzero; play alone could not tell that from "== 1", since play only
 *           ever produces 0 and 1. Four teeth: an inverted gate, a "== 1" gate (invisible to all
 *           1970 captures, caught only by the sweep), a dropped effect beat, and a skip that
 *           forgets to skip — each caught, and each named at the cell or the return value it
 *           diverges on.
 * LIVE-OUT: the caller-skip boolean, plus whatever memory the effect beat writes through the
 *           router. No register or flag is live: the proceed arm's successor (dispatchMarioMovement, ROM
 *           0x1AC3) reloads the accumulator from memory as its first act, and the skip arm
 *           returns past the caller altogether. SP/pc are the dropped stack model — the oracle's
 *           skip arm discards the caller's return address and returns a level higher, all inside
 *           STACK_SCRATCH; the boolean carries that decision instead.
 * NAMES:    none imported. The only cell touched is the hit-effect latch at 0x6350, which is
 *           deliberately unnamed in ram.js (shared engine scratch: the effect sequence's gate and
 *           loc_03a2's bit0 gate read the same byte) and kept hex here, exactly as its two
 *           sibling routines recordHammerHitOnObject and animateEffectSpriteThenRearmEffect keep
 *           it. Direct-called: dispatchEffectSequenceStep (ROM 0x1E96), loc_1e94 (ROM 0x1E94).
 */

import { dispatchEffectSequenceStep } from "./dispatchEffectSequenceStep.js"; // ROM 0x1E96 — the effect-step router
import { loc_1e94 } from "./loc_1e94.js"; // ROM 0x1E94 — the unconditional caller-skip tail

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {boolean} true = proceed (the caller runs the rest of its per-frame cascade);
 *   false = skip (the caller abandons the frame's remaining gameplay update).
 */
export function loc_1e8c(m) {
  // Nothing playing — the caller gets its ordinary frame.
  if (m.mem.read8(0x6350) === 0) return true; // hit-effect latch, unnamed shared engine scratch

  // An effect is playing: this frame belongs to it. Advance the effect's current step, then take
  // the skip tail, which always answers "abandon the caller's remaining work".
  dispatchEffectSequenceStep(m);
  return loc_1e94(m);
}
