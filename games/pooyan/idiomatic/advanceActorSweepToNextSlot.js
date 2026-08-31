// SPDX-License-Identifier: GPL-3.0-only
import { testAndCatchActorSlotOnOverlap } from "./testAndCatchActorSlotOnOverlap.js";
import { u16 } from "../../../core/int.js";

// ============================================================================
// advanceActorSweepToNextSlot -- the loop TAIL of the odd-round actor overlap sweep.
//
// WHAT IT IS
//   The bottom of a counted loop. Each pass of the sweep tests one actor slot
//   for a collision against the current target; when a pass finishes (whether
//   it caught the slot or skipped it) it drops here to step the cursors onto the
//   next slot and decide whether another pass is due. There is no work of its
//   own beyond pointer arithmetic and the loop count -- it exists so every exit
//   of the loop body converges on a single "advance and continue" step.
//
// ROLE IN THE MACHINE
//   Collision. The frame's actor updater fires a bank of proximity sweeps; one
//   of them, run only on odd rounds, walks the enemy/actor records looking for
//   any that overlap the current target box. That sweep is a chain:
//     sweepActorRecordSlotsBothParitiesOnOddRound (ROM 0x5e78, the gated driver)
//       -> dispatchTargetPairCollisionSweep       (ROM 0x5e98, one parity pair)
//         -> testAndCatchActorSlotOnOverlap        (ROM 0x5ebd, the loop BODY)
//           -> advanceActorSweepToNextSlot         (ROM 0x5f06, this TAIL)
//             -> testAndCatchActorSlotOnOverlap    (back to the body, next slot)
//   The body hands control here on every path it can take -- empty slot, busy
//   slot, off-screen, gap too wide, or a completed catch -- so this routine is
//   the sole place the loop counts down and steps forward.
//
//   Two cursors walk in lockstep, one step per slot:
//     * IX -> the actor's stride-4 record in the sprite display list. The body's
//       bounds precheck reads this to derive the actor's on-screen X/Y.
//     * HL -> the matching 24-byte (0x18) enemy/object state record. The body
//       reads its lead byte (occupancy) and state byte from here.
//   IY (the target pointer) and B (the remaining-slot count) ride through the
//   loop unchanged except for B's decrement here.
//
// ROM ADDRESS
//   0x5f06-0x5f10.  IX += 4 at 0x5f09-0x5f0b; HL += 0x18 at 0x5f0d-0x5f0e;
//   the DJNZ at 0x5f0e branches back to the loop body (0x5ebd) while B remains,
//   and falls through to the return at 0x5f10 when B reaches zero.
//
// Grounding: [seen]
//
// LIVE-OUT
//   none. This tail commits nothing to memory -- it only steps the two cursors
//   and the loop count before re-entering the body. Every memory effect of the
//   sweep (a caught slot, a zeroed target record, a queued hit sound) is written
//   by the loop body, not here. The advanced cursors it passes forward are
//   consumed inside the loop and are dead once the sweep ends.
// ============================================================================

// The two lockstep cursor steps, one slot's worth each. DE carries 4 for the IX
// step and 0x18 for the HL step in the original instruction stream; here they are
// the two fixed strides the loop advances by.
const ACTOR_STRIDE = 0x04; // IX advance: one actor record (stride-4 sprite display-list slot)
const RECORD_STRIDE = 0x18; // HL advance: one enemy/object row (the 24-byte state record)

export function advanceActorSweepToNextSlot(m, hl = m.regs.hl, ix = m.regs.ix, count = m.regs.b, iy = m.regs.iy) {
  // Count down one slot. B held the number of records still to visit; the DJNZ
  // at ROM 0x5f0e decrements it and, when it lands on zero, the sweep is done --
  // control returns to the driver and nothing further is stepped.
  const remaining = (count - 1) & 0xff; // djnz
  if (remaining === 0) return;
  // Slots remain: step both cursors onto the next record -- the sprite display
  // slot forward by ACTOR_STRIDE (IX + 4) and the state record forward by
  // RECORD_STRIDE (HL + 0x18) -- and re-enter the loop body to test that slot,
  // carrying the unchanged target pointer (IY) and the decremented count.
  return testAndCatchActorSlotOnOverlap(m, u16(hl + RECORD_STRIDE), u16(ix + ACTOR_STRIDE), iy, remaining);
}
