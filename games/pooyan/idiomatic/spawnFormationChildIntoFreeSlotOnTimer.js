// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { FORMATION_TABLE } from "./names.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { loc_3cae } from "./loc_3cae.js";
/**
 * spawnFormationChildIntoFreeSlotOnTimer — formation-object state-7 handler: keep the parent
 * animating, then on a timer release exactly one child into the first free formation slot.
 *
 * WHAT IT IS
 *   ROM 0x3c92-0x3cad. One per-state handler inside the formation-object state machine. The
 *   formation dispatcher sweeps the four records of FORMATION_TABLE (0x8c30, stride 0x18) every
 *   frame and routes each record to the handler for its current state byte; a record sitting in
 *   state 7 lands here. `parent` is that record — the formation actor (a hunter/parent bird) that is
 *   due to drop a child.
 *
 * ROLE IN THE MACHINE
 *   State 7 is the "wait a while, then release a child" behaviour. On every frame it advances the
 *   parent's own animation so the actor keeps moving on screen, and it counts down a private frame
 *   timer. Nothing more happens until that timer reaches zero. When it does, the handler tries to
 *   release one child: it walks the four formation slots hunting for a free one, hands each slot to
 *   the per-record spawn body, and the first free slot found is seated with a freshly launched child
 *   — then the scan stops so exactly one child is dropped per elapse. If every slot was already
 *   occupied, nothing is released and the timer is simply re-armed to try again later.
 *
 *   The parent record fields this handler touches are in the common actor layout:
 *     +0x0e  animation frame-hold (advanced by the animation stepper, not written here directly)
 *     +0x11  the frame timer that gates the child release (counted down and reseeded here)
 *
 * GROUNDING
 *   [seen] — the formation-spawn path this drives is confirmed: FORMATION_TABLE (0x8c30), the
 *   per-object animation stepper it ticks (advanceObjectAnimationFrame, 0x4006), and the per-record
 *   spawn body it scans each slot with all carry [seen] tags in the name registry.
 *
 * LIVE-OUT: none the caller reads back. Every effect is in memory — the parent's advanced animation
 *   fields, the decremented-or-reseeded frame timer at +0x11, and (when a child is released) the new
 *   child record plus the parent's launch state, written by the per-record spawn body.
 */

const TIMER_FIELD = 0x11; // parent frame-timer field (record +0x11) that gates the child release
const TIMER_RELOAD = 0x10; // timer value reseeded after a full scan that launched nothing
const RECORD_STRIDE = 0x18; // distance between records in FORMATION_TABLE
const RECORD_COUNT = 0x04; // number of formation slots scanned for a free one

export function spawnFormationChildIntoFreeSlotOnTimer(m, parent = m.regs.ix) {
  const { mem8 } = m;

  // --- Keep the parent animating, and tick its spawn timer ---------------------------------------
  // First step the parent's own animation one frame (0x4006 walks this record's animation script /
  // frame-hold) so the on-screen actor stays alive while it waits. Then decrement the private frame
  // timer at record +0x11. While that timer is still non-zero the parent is not yet due to drop a
  // child, so the handler returns and the record stays in state 7 for another frame.
  advanceObjectAnimationFrame(m, parent); // advance the parent's animation
  mem8[parent + TIMER_FIELD] = u8(mem8[parent + TIMER_FIELD] - 1);
  if (mem8[parent + TIMER_FIELD] !== 0) return; // timer not elapsed

  // --- Timer elapsed: hunt for a free formation slot ---------------------------------------------
  // Walk the four formation records from the base of FORMATION_TABLE (0x8c30), stepping one 0x18
  // stride per iteration. Each record is handed to the per-record spawn body: it reports true when
  // that slot is already occupied (keep scanning) and false the moment it seats a fresh child into a
  // free slot — at which point one child has been released, so the scan is abandoned immediately.
  let record = FORMATION_TABLE;
  for (let n = RECORD_COUNT; n > 0; n--) {
    if (!loc_3cae(m, record, parent)) return; // child seated here -> release just one, stop scanning
    record = u16(record + RECORD_STRIDE); // advance to the next formation record
  }

  // --- Every slot was full: nothing released this pass -------------------------------------------
  // The scan ran through all four records without finding a free slot, so no child was dropped this
  // frame. Re-arm the frame timer to 0x10 so the parent waits that many frames and attempts the
  // release again on a later pass.
  mem8[parent + TIMER_FIELD] = TIMER_RELOAD; // no launch this frame -> reseed the timer
}
