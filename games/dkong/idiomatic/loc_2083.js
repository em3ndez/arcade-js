// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2083 — count the object one step further into this sub-state, running the first two steps'
 * own arms; from the third step on, publish the arm-select byte that puts the object on a
 * one-pixel-per-frame horizontal walk in the direction its ballistic step was going, and hand the
 * record to the shared object-sprite tail.  ROM 0x2083.
 *
 * One record of OBJ_ARRAY_67, walked by the ten-slot loop at ROM 0x1F72 (which runs only while
 * BOARD is 1) with the record's base in the index register. There is exactly ONE caller, the
 * active-movement branch at ROM 0x2053, which jumps here when the girder-contact probe it runs
 * first (ROM 0x2A2F) reports contact.
 *
 * Three record bytes are involved, none of which has a registry name. The file-local names are the
 * ones the sibling files in this cluster already use (ARM_SELECT and SUBSTATE in loc_2038,
 * STEP_WHOLE in loc_20b5):
 *   +2   the walk's per-slot ARM-SELECT byte (read, and written only on the third arm)
 *   +14  this sub-state's step counter (read and written on every dispatch)
 *   +16  the whole-pixel half of the record's per-frame horizontal step (read on the third arm)
 *
 * WHAT THE ROLE LINE RESTS ON, and it is not this routine's own body — an increment, two jumps and
 * a stored 2-or-4 say nothing on their own:
 *   - +2 IS THE WALK'S ARM SELECTOR, read from ROM 0x1F93 and not from here. Once that
 *     dispatcher has ruled out its own first test (record byte +1 equal to 1, which takes ROM
 *     0x20EC) it tests the arm-select byte's bits in order and sends the record to ROM 0x1FAC on
 *     bit 0, ROM 0x1FE5 on bit 1, ROM 0x1FEF on bit 2, and to the active-movement branch at ROM
 *     0x2053 when none is set. So storing 2 selects 0x1FE5 and 4 selects 0x1FEF, for the NEXT
 *     frame.
 *     The other two writers of the byte in this cluster agree with that reading: ROM 0x2038 stores
 *     8 and ROM 0x2118 stores 0, both of which leave bits 0-2 clear and so keep the record on the
 *     active-movement branch.
 *   - THE TWO SELECTED ARMS ARE A DIRECTION PAIR. ROM 0x1FE5 increments the record's OBJ_X; ROM
 *     0x1FEF decrements it. One pixel per frame, right and left.
 *   - +16 IS THE HORIZONTAL STEP'S WHOLE-PIXEL BYTE, fixed from outside this body: it is the byte
 *     stepBallisticMotion (ROM 0x239C) adds to the record's OBJ_X every airborne frame as the high
 *     half of a big-endian signed 16-bit value, the byte loc_20b5 stamps 255 into for a leftward
 *     whole pixel, and the byte ROM 0x20E1 stamps 1 into for a rightward one. Testing it against 1
 *     therefore asks "is this object's ballistic step the rightward whole pixel", and the walk it
 *     then selects carries that same direction.
 *   - MEASURED, and it could have come out the other way: over a 4000-frame attract run this
 *     routine wrote the arm-select byte 23 times, and on all 23 the record's very next dispatch was
 *     the predicted arm, with the predicted one-pixel move — 2 was followed by ROM 0x1FE5 and
 *     OBJ_X + 1 (11 times), 4 by ROM 0x1FEF and OBJ_X - 1 (12 times), no exceptions and none left
 *     unfollowed. The same run shows the counter running 1, 2, 3 per episode and never further,
 *     which is what the third arm's own store predicts: once the arm-select byte is set the walk
 *     stops routing the record to ROM 0x2053, so it cannot come back until something clears it.
 *
 * WHAT THIS DOES NOT CLAIM. What these records hold, and what game event puts one on this branch,
 * were not derived here — the girder-contact probe the caller gates on is still frozen — so the
 * routine keeps its loc_ name. The test on +16 is an EQUALITY against 1, not a sign test, and
 * attract only ever presents that byte as 0, 1 or 255; for a rightward step of two whole pixels or
 * more the two arms are NOT a direction pair, and nothing observed here reaches that case. Steps
 * beyond the third are likewise never produced by attract (the gate crafts them).
 *
 * NOT A PARAMETER, deliberately: the record base stays in the index register rather than becoming a
 * named argument, because all three continuations are still frozen and each re-reads that register
 * to reach the rest of the same record. A caller passing a different record would be obeyed by the
 * three lines here and ignored one call later. It becomes an honest parameter when ROM 0x20A2,
 * 0x20C3 and 0x21BA are decompiled, not before.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2083.test.js.
 * GATE:     captured + crafted + live; ATTRACT only, and there is no other board to be missing —
 *           the walk this hangs off returns immediately unless BOARD is 1. EVERY real dispatch is
 *           replayed, inline at the dispatch rather than sampled: 72 of 72 in a 4000-frame attract
 *           run, covering all three arms, both branches of the third arm, all 8 distinct entry
 *           shapes and all 7 record bases attract presents. Each replay is REHOSTED into a fresh
 *           override-free machine first, because the tail chain continues the object walk and
 *           re-enters this address — replaying on a plain clone re-enters the capturing hook and
 *           corrupts the count while still reporting green. The replayed count is cross-checked
 *           against an independent reachability probe. The comparison is stronger than the usual
 *           contract because both sides run the identical frozen continuation: the FULL state dump
 *           WITH STACK_SCRATCH INCLUDED, the whole exit register file, pc, SP and the propagated
 *           return value. Crafted on real captures, one poked byte at a time: all 256 step-counter
 *           values and all 256 values of +16, each crossed with one real capture per arm — 768
 *           entries apiece. That is the only place steps past the third, the 255 -> 0 counter wrap,
 *           and the whole-pixel bytes 2..254 are reached at all. A HANDOFF arm stubs the three
 *           frozen tails and compares the state at the moment control leaves this routine. Also
 *           wired live at 0x2083 under the cycle-free engine for a 4000-frame attract run
 *           (67 dispatches, asserted, not merely non-zero), byte-identical to the all-oracle
 *           baseline over the full dump. Teeth: five broken twins — four caught by the captured
 *           replay, and one that ESCAPES all 72 natural dispatches and is caught only by the
 *           crafted wrap, asserted in BOTH directions so the coverage hole is documented rather
 *           than assumed.
 * LIVE-OUT: memory, plus pc, SP, the exit register file and the propagated return value — all of
 *           which the frozen continuation produces identically on both sides, so the gate asserts
 *           them outright rather than excluding them. What this rewrite DROPS is what the oracle
 *           leaves in the accumulator and the flags at the moment it hands over: the oracle reaches
 *           ROM 0x20A2 and ROM 0x20C3 with a zeroed accumulator and the zero flag set, and ROM
 *           0x21BA with the arm-select byte it just stored and the flags of testing +16.
 *           DERIVED — each of the three continuations kills both within two instructions, and
 *           reads neither of them first:
 *           ROM 0x20A2's own first instruction reloads the accumulator and its second writes every
 *           flag; ROM 0x20C3 calls ROM 0x2407, whose first instruction reloads the accumulator and
 *           whose mask at ROM 0x240F writes every flag (the only flag anything on that path reads
 *           is the carry into ROM 0x241C's subtract, and ROM 0x2413 clears it immediately before);
 *           ROM 0x21BA reloads the accumulator at ROM 0x21BE and overwrites all but the carry at
 *           ROM 0x21C0, with the carry itself overwritten at ROM 0x1F90 — and the first conditional
 *           anywhere past the hand-off is the walk's loop counter, which reads a register and not a
 *           flag. The carry needs no argument in any case: it arrives here cleared by the caller's
 *           own test at ROM 0x205B and nothing here disturbs it. MEASURED, because "dead" is a
 *           claim and not an observation: the drop is not hypothetical but present in every one of
 *           the 72 replays — this rewrite hands the tail whatever the caller left, and the gate's
 *           HANDOFF arm asserts that those values genuinely DIFFER from the oracle's on real
 *           captures (so the equality is not vacuous) while every other byte at the hand-off is
 *           identical; the full replays then run the real continuation on top and stay equal, and a
 *           4000-frame attract run with this routine wired live is byte-identical to the all-oracle
 *           baseline over the whole dumped state.
 * NAMES:    OBJ_ARRAY_67, OBJ_X, BOARD and stepBallisticMotion are named in the prose above and
 *           come from ram.js and the idiomatic layer; nothing is imported, because every access
 *           here is an offset from the record base the walk maintains and none of the three offsets
 *           has a registry entry of its own. The lead may want entries for +2 (the walk's branch
 *           selector, also written at ROM 0x2038 and ROM 0x2118 and read at ROM 0x1F93) and +14.
 *           +16 is the field loc_20b5 and stepBallisticMotion already carry as a bare offset, and
 *           it stays one here for the same reason. All three continuations — ROM 0x20A2, 0x20C3 and
 *           0x21BA — have no idiomatic file yet and are reached through the registry; they belong
 *           to the same mutually-recursive object-walk cluster as this routine and are being
 *           decompiled alongside it, so dissolving those three is a later coordinated step.
 */

import { u8 } from "../../../core/int.js";

// Record offsets. None is named in ram.js: they are positions inside the walk's record, and the
// registry names object fields only where a field's meaning is settled across the arrays that
// share it. All three names are taken from the siblings that already carry them — ARM_SELECT and
// SUBSTATE from loc_2038, STEP_WHOLE from loc_20b5 — rather than invented here.
const ARM_SELECT = 2;
const SUBSTATE = 14;
const STEP_WHOLE = 16;

// The whole-pixel horizontal step that counts as rightward here: exactly the value ROM 0x20E1
// stamps for a rightward one pixel per frame. Anything else — leftward, or a sub-pixel step —
// takes the other arm.
const RIGHTWARD_ONE_PIXEL = 1;

// What the walk's per-slot dispatcher at ROM 0x1F93 reads out of the arm-select byte: bit 1 sends
// the record to ROM 0x1FE5, which walks it one pixel right per frame; bit 2 to ROM 0x1FEF, one
// pixel left.
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
