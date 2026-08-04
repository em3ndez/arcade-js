// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceFallingBarrel — carry a barrel one frame further down its fall between girders, and
 * decide whether this is a frame on which it is allowed to test the girder underneath it. The
 * gravity ramp restarts at each landing, which is what makes this a fall rather than a bounce.
 *
 * One of the five branches the barrel dispatcher selects for an active slot, and like its four
 * siblings it opens by swapping to the shadow register set. That swap is the object loop's register
 * contract, not decoration: the loop keeps its cursor, record pointer, stride and slot counter in
 * the main set, each branch works in the shadow set without swapping back, and the shared tail
 * swaps them home for the next slot. Dropping it does not merely change a register — a run wired
 * that way stops partway through and starts writing into read-only address space, because the
 * loop's own cursor has been overwritten.
 *
 * After the ballistic step it picks one of three continuations:
 *
 *   - the barrel has not yet moved CONTACT_REARM_DISTANCE of OBJ_Y past the point where it last
 *     registered a girder contact  ->  the end-of-range retirement check, which only asks whether
 *     the barrel has run off the edge
 *   - it has moved that far and the tile under it is a slope it touches  ->  the contact arm
 *   - it has moved that far and there is no contact  ->  the no-contact arm
 *
 * THE RE-ARM GATE. Record byte OBJ_CONTACT_Y is a snapshot of where the barrel was when it last
 * registered a contact, and this comparison holds the contact probe off until OBJ_Y has moved
 * CONTACT_REARM_DISTANCE past that snapshot — a re-arm distance, so a barrel cannot immediately
 * re-detect the girder it has just landed on.
 *
 * NOT CLAIMED: why the distance is 26 and not some other number; what distinguishes the two
 * probe-passed continuations for the barrel (that is their own business); and whether the 8-bit
 * wrap below is intended. The subtraction is 8-bit, so a barrel whose OBJ_Y is under the re-arm
 * distance wraps to a large value and PASSES the gate instead of failing it. That arm is reached
 * only by a crafted entry, and whether the game relies on it or merely never meets it is unknown.
 *
 * Reads OBJ_CONTACT_Y and nothing else of its own; writes no memory. Every cell that changes is
 * written by the ballistic step, by the slope probe, or by the continuation. The record pointer
 * stays in the index register rather than becoming a parameter: all three continuations read it
 * straight off the machine, and so do both callees, so a caller passing anything else would be
 * obeyed by nobody.
 *
 * LIVE-OUT: the return value only. The residual accumulator (the gate's difference) and shadow B
 * (the contact snapshot) are dropped rather than modelled.
 */

import { u8 } from "../../../core/int.js";
import { loc_2a2f } from "./loc_2a2f.js"; // the girder/slope probe
import { stepBallisticMotion } from "./stepBallisticMotion.js";

/** Object-record byte +25: the OBJ_Y the barrel had at its last registered contact. It carries no
 *  registered name — its single writer is not yet a readable routine, so the field is not grounded
 *  well enough to earn one. */
const OBJ_CONTACT_Y = 25;

/** How far OBJ_Y must move past that snapshot before the contact probe is armed again. */
const CONTACT_REARM_DISTANCE = 26;

export function advanceFallingBarrel(m) {
  const { regs, mem8 } = m;
  const record = regs.ix;

  // Into the shadow set for the whole branch; the shared tail swaps back. See the header.
  regs.exx();

  // Advance the barrel one frame along its arc. It hands the new OBJ_Y back in a register as well
  // as storing it into the record — this is the call site that consumes that live-out.
  stepBallisticMotion(m);
  const objectY = regs.h;

  // Still too close to where the barrel last touched down: skip the probe entirely and let the
  // end-of-range check have it. The subtraction wraps at 8 bits (see NOT CLAIMED in the header).
  const lastContactY = mem8[record + OBJ_CONTACT_Y];
  if (u8(objectY - CONTACT_REARM_DISTANCE) < lastContactY) return m.call(0x2104);

  // Far enough: probe the tile under the barrel, and split on whether it made contact.
  if (loc_2a2f(m)) return m.call(0x2118);
  return m.call(0x2101);
}
