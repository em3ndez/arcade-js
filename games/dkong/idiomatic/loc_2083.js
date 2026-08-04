// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2083 — count the object one step further into this sub-state, running the first two steps'
 * own arms; from the third step on, publish the arm-select byte that puts the object on a
 * one-pixel-per-frame horizontal walk in the direction its ballistic step was going, and hand the
 * record to the shared object-sprite tail.
 *
 * One record of OBJ_ARRAY_67, reached with the record's base in the index register. There is
 * exactly ONE way in: the active-movement branch jumps here when the girder-contact probe it runs
 * first reports contact.
 *
 * Three record bytes are involved, none of which has a registry name:
 *   +2   the walk's per-slot ARM-SELECT byte (read, and written only on the third arm)
 *   +14  this sub-state's step counter (read and written on every dispatch)
 *   +16  the whole-pixel half of the record's per-frame horizontal step (read on the third arm)
 *
 * WHY THE ROLE LINE SAYS "WALK", when the body is an increment, two jumps and a stored 2-or-4:
 *   - THE ARM-SELECT BYTE IS THE WALK'S SELECTOR. Once the per-slot dispatcher has ruled out its
 *     own first test it tests that byte's bits in order and sends the record to one arm on bit 0,
 *     another on bit 1, a third on bit 2, and to the active-movement branch when none is set. So
 *     storing 2 selects one arm and 4 the other, for the NEXT frame. The cluster's other two
 *     writers of the byte agree: both store values that leave bits 0-2 clear and so keep the record
 *     on the active-movement branch.
 *   - THE TWO SELECTED ARMS ARE A DIRECTION PAIR: one increments the record's OBJ_X, the other
 *     decrements it. One pixel per frame, right and left.
 *   - +16 IS THE HORIZONTAL STEP'S WHOLE-PIXEL BYTE. It is the byte the ballistic step adds to
 *     OBJ_X every airborne frame as the high half of a big-endian signed 16-bit value, stamped 255
 *     for a leftward whole pixel and 1 for a rightward one. Testing it against 1 therefore asks "is
 *     this object's ballistic step the rightward whole pixel", and the walk it then selects carries
 *     that same direction.
 *
 * WHAT THIS DOES NOT CLAIM. What these records hold, and what game event puts one on this branch,
 * were not derived here, so the routine keeps its loc_ name. The test on +16 is an EQUALITY against
 * 1, not a sign test, and in ordinary play that byte is only ever 0, 1 or 255; for a rightward step
 * of two whole pixels or more the two arms are NOT a direction pair, and nothing observed reaches
 * that case. Steps beyond the third are likewise never produced in ordinary play.
 *
 * NOT A PARAMETER, deliberately: the record base stays in the index register rather than becoming a
 * named argument, because all three continuations re-read that register to reach the rest of the
 * same record. A caller passing a different record would be obeyed by the three lines here and
 * ignored one call later.
 *
 * LIVE-OUT: memory, plus pc, SP, the exit register file and the propagated return value — all of
 * which the continuation produces. What this routine DROPS is the accumulator and the flags at the
 * moment it hands over. Each of the three continuations kills both within two instructions and
 * reads neither first: each reloads the accumulator immediately and overwrites the flags, and the
 * first conditional anywhere past the hand-off reads a register rather than a flag. The carry needs
 * no argument in any case — it arrives here cleared by the caller's own test and nothing here
 * disturbs it.
 */

import { u8 } from "../../../core/int.js";

// Record offsets. None carries a registry name: they are positions inside the walk's record, and
// the registry names object fields only where a field's meaning is settled across the arrays that
// share it. All three names are the ones the sibling files in this cluster already use.
const ARM_SELECT = 2;
const SUBSTATE = 14;
const STEP_WHOLE = 16;

// The whole-pixel horizontal step that counts as rightward here — exactly the value stamped for a
// rightward one pixel per frame. Anything else, leftward or sub-pixel, takes the other arm.
const RIGHTWARD_ONE_PIXEL = 1;

// What the walk's per-slot dispatcher reads out of the arm-select byte: bit 1 puts the record on
// the arm that walks it one pixel right per frame, bit 2 on the arm that walks it one pixel left.
const SELECT_WALK_RIGHT = 2;
const SELECT_WALK_LEFT = 4;

export function loc_2083(m) {
  const { mem8 } = m;
  const at = (offset) => (m.regs.ix + offset) & 0xffff;

  // The counter is read back at its byte width before it is dispatched on, so a record sitting at
  // 255 rolls to 0 and takes the last arm rather than starting the sequence again.
  const step = u8(mem8[at(SUBSTATE)] + 1);
  mem8[at(SUBSTATE)] = step;

  if (step === 1) return m.call(0x20a2);
  if (step === 2) return m.call(0x20c3);

  // Third step onward: hand the object to the walk arm that keeps it moving the way its ballistic
  // step was already taking it, from the next frame on.
  mem8[at(ARM_SELECT)] =
    mem8[at(STEP_WHOLE)] === RIGHTWARD_ONE_PIXEL ? SELECT_WALK_RIGHT : SELECT_WALK_LEFT;

  return m.call(0x21ba);
}
