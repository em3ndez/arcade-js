// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { armSlotWhenObjectInRange } from "./armSlotWhenObjectInRange.js";
import { returnImmediately } from "./returnImmediately.js";
import { loc_44, loc_54, loc_64 } from "./names.js";
import { advanceSegmentLoopIndex } from "./advanceSegmentLoopIndex.js";
import { reverseSegmentDeltaAndStepCoord } from "./reverseSegmentDeltaAndStepCoord.js";

/**
 * advanceSegmentCoordAndArm -- one step handler in the per-segment centipede walk for segment X.
 *
 * ROM 0x2a92. Grounding: [code] (behaviour-read; the per-slot arrays it indexes are bare zero-page
 * placeholders -- coordinate `loc_54+X`, heading delta `loc_44+X`, state field `loc_64+X`).
 *
 * ROLE IN THE MACHINE. Each centipede body segment carries its own signed per-frame delta and its own
 * coordinate. This handler moves segment X forward by that delta and then asks the collision/range
 * probe whether the segment has now reached the reference point it is homing on. The probe returns a
 * 6502-style carry: carry CLEAR means it armed the slot (the segment arrived and is done for this
 * frame), carry SET means still out of range and the walk must continue. When continuing, the low 3
 * bits of the segment's state field select the next stage -- the special value 4 marks a segment that
 * is edge-aligned and must reverse (flip its delta and re-step), everything else just moves on to the
 * next segment via the loop tail.
 *
 * LIVE-OUT. Writes segment X's advanced coordinate into `loc_54+X`; the branch it takes writes no
 * further cell of its own (the callee it tails into owns the rest). Returns that callee's value.
 */
export function advanceSegmentCoordAndArm(m, x = m.regs.x) {
  const { mem8 } = m;
  // The coordinate cell for this slot. (& 0xff keeps the zero-page address in range for wrapped X.)
  const coord = (loc_54 + x) & 0xff;
  // Integrate one motion step: coordinate += this segment's own signed heading delta (loc_44+X).
  // u8() models the 6502 8-bit wrap so the guest coordinate stays byte-exact.
  mem8[coord] = u8(mem8[coord] + mem8[(loc_44 + x) & 0xff]); // advance by the segment delta
  // Probe whether the just-moved segment is now within range of its reference point. The helper
  // returns the guest carry: true == carry set == STILL out of range; false == carry clear == armed.
  const outOfRange = armSlotWhenObjectInRange(m, x);         // carry set == still out of range
  // Armed: the segment reached its target and needs no more work this frame -> shared no-op landing.
  if (!outOfRange) return returnImmediately(m);             // in range -> armed, segment done
  // Still travelling. The low 3 bits of the state field decide the stage: only the code 0x04 means
  // "edge-aligned" and drops into the reverse-and-step handler; any other value just advances the
  // slot cursor to the next segment.
  if ((mem8[(loc_64 + x) & 0xff] & 0x07) !== 0x04) return advanceSegmentLoopIndex(m, x); // -> next segment
  return reverseSegmentDeltaAndStepCoord(m, x);              // aligned -> flip-and-step stage
}
