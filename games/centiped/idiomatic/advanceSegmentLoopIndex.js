// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { moveCentipedeSegment } from "./moveCentipedeSegment.js";

/**
 * advanceSegmentLoopIndex -- the tail (loop-back) of the per-segment centipede walk.
 *
 * ROM 0x2ac7. Grounding: [code] (read from behaviour; the slot cursor X it manipulates is a bare
 * register/loop index, not a MAME-confirmed cell).
 *
 * ROLE IN THE MACHINE. The centipede is a chain of body segments held in per-slot zero-page arrays
 * (heading `loc_44+X`, coordinate `loc_54+X`, state `loc_64+X`, ...). `moveCentipedeSegment` advances
 * ONE slot X and then, depending on its wall/edge tests, hands off to one of several sibling step
 * handlers; this routine is the one they all fall into to advance the loop. On the 6502 the walk was
 * a `DEX` / `BMI done` / `JMP loop-head` at the bottom of the per-segment loop, walking the slot
 * cursor from the last segment down toward the first. Because `moveCentipedeSegment` re-enters itself
 * here, a single top-level entry walks the entire strip via this tail recursion.
 *
 * LIVE-OUT. Republishes the decremented cursor into `m.regs.x` (so the next iteration's handlers
 * read the right slot) and returns the recursive walk's value; on the terminal pass it returns with
 * nothing (the port's return-seam supplies the machine's RTS).
 */
export function advanceSegmentLoopIndex(m, x = m.regs.x) {
  // Step the slot cursor to the previous (lower-indexed) segment. u8() models the 6502 DEX wrap:
  // decrementing 0x00 yields 0xff, whose sign bit (0x80) is the loop's terminal signal.
  const nx = u8(x - 1);
  if (nx & 0x80) return; // stepped past the first slot -> strip done
  // Still inside the strip: republish the cursor and re-enter the per-segment loop head so the
  // next-lower segment is advanced by the same machinery.
  return (m.regs.x = nx), moveCentipedeSegment(m);
}
