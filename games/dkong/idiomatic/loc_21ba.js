// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_21ba — swap the object walk's registers back in, stage one object's four sprite bytes,
 * and hand on to the between-slots step.  ROM 0x21BA.
 *
 * This is the join every active-slot arm of the object walk arrives at. The walk starts at ROM
 * 0x1F72 and runs only while BOARD is 1 (25m): ten OBJ_ARRAY_67 records, stride 32, each staging
 * one 4-byte record into ACTOR_SPRITES. An active record is animated by the dispatch at ROM
 * 0x1F93, which splits into a family of arms; whichever arm ran, it ends up here, and here is
 * where the record's four sprite bytes are actually written.
 *
 * Reads four fields of the record the walk's index register points at — OBJ_X (+3),
 * OBJ_SPRITE_CODE (+7), OBJ_SPRITE_ATTR (+8), OBJ_Y (+5) — and writes them to four consecutive
 * bytes at the staging cursor, in the sprite record's own field order: SPRITE_X, SPRITE_CODE,
 * SPRITE_ATTR, SPRITE_Y. It is a PERMUTING GATHER, not a block copy — +5 is read after +7/+8,
 * and +4/+6 are never read — and the permutation is the whole point, because it is what turns
 * an object record into the byte layout the sprite hardware reads.
 *
 * THE LEADING EXCHANGE IS A CONTRACT ACROSS THE WHOLE CLUSTER, and it is why this cannot be
 * written as a plain gather. The arms that jump here have swapped the walk's registers out to
 * get a working set of their own, and none of them swaps back; this routine's first act is that
 * swap back, so the cursor, the record pointer, the stride and the remaining-slot count are the
 * walk's again by the time anything is read. It is done unconditionally, not per caller — the
 * arms that never swapped out reach here through arms that did.
 *
 * The cursor moves three of the four bytes it just wrote; the fourth move belongs to the
 * between-slots step at ROM 0x1F8D, which this routine jumps to and which both halves of the
 * walk converge on — the inactive-slot half at ROM 0x1F83 makes the same 3 + 1 split. Only the
 * cursor's low byte moves, so it can never leave the page it is in.
 *
 * CORROBORATION OUTSIDE THIS BODY, because the field meanings are not derivable from four
 * indexed loads: ROM 0x11D3 (gatherSpriteRecords) runs this identical permutation — the same
 * four source offsets in the same order, the same four consecutive destination bytes, the same
 * page-confined cursor step — as a counted loop, and its five call sites all aim at
 * SPRITE_BUFFER. names.js records the same mapping measured live under MAME on each of the four
 * cells: OBJ_X and OBJ_Y as live coordinate sweeps on this very array (0x6703 swept 223 distinct
 * values, 0x6705 158) and OBJ_SPRITE_CODE as 11 distinct animation frames on it. A gather that
 * meant something else would have had to leave those cells doing something other than driving
 * what is drawn. OBJ_SPRITE_ATTR is the weakest of the four: its live observation was taken on
 * the OTHER stride-32 object array, not this one, where it read as two-valued — this gate
 * measures four distinct values arriving here, so the two runs are describing different arrays
 * and only the offset is shared.
 *
 * WHAT THIS FILE DOES NOT CLAIM: what the arms upstream of it computed, and why thirteen entry
 * points in the ROM converge on one 23-byte tail, are not derived here. Nor is anything about the
 * records past the fifth: the walk covers ten, attract activates five, and the rest are untested
 * (see GATE). That the staged bytes survive to the sprite DMA unmodified is likewise outside
 * this routine — it writes them and nothing here establishes that no later pass rewrites them.
 *
 * Memory-equivalent to the frozen oracle — equivalence-21ba.test.js.
 * GATE:     captured + crafted + live, ATTRACT ONLY. A 1200-frame cycle-free attract run
 *           dispatches this 1665 times, first at frame 607, and the gate replays EVERY ONE of
 *           them inline (clone twice at the dispatch, run oracle and rewrite, compare, discard)
 *           rather than sampling. Because both sides jump on into the still-frozen between-slots
 *           step, each replay carries the rest of the walk with it, so the comparison is made
 *           after the whole tail chain has run. Asserted coverage: all five OBJ_ARRAY_67 records
 *           attract activates, all five staging-cursor positions, all five remaining-slot counts,
 *           and the record/cursor correspondence this header rests on — including that the walk's
 *           state is PARKED IN THE ALTERNATE BANK on every one of them, which is what makes the
 *           leading exchange a checked contract rather than a restatement. Two crafted arms cover
 *           what attract cannot produce: a staging cursor whose four writes WRAP its page
 *           (attract runs it at 0x6980-0x6990 and never wraps), and a source payload swept across
 *           all 256 values in each of the four fields (attract produces 8 distinct sprite codes
 *           and 4 attributes, and never a zero in either). Records 5-9 of the walk, credited
 *           gameplay, boards 2-4 and two-player are NOT covered — attract activates none of them.
 *           Teeth: six broken twins, TWO of which escape every natural capture — a full-width
 *           destination, caught only by the wrapping arm, and a skipped store on a zero sprite
 *           code, caught only by the payload arm. Both halves of both are asserted.
 * LIVE-OUT: memory — the four staged bytes — plus everything the frozen between-slots step and
 *           the rest of the walk produce, which this rewrite still reaches through that same
 *           frozen step and returns on. What this routine itself owes the tail is the register
 *           state the exchange restores plus the cursor's advanced low byte, and both are kept
 *           in the registers rather than passed, because the tail reads them there.
 *           DROPPED, and derived twice rather than assumed: the accumulator. The oracle leaves
 *           the last gathered byte in it; both continuations overwrite it before reading it —
 *           the walk's per-slot gate at ROM 0x1F83 opens by loading the next record's
 *           OBJ_ACTIVE, and on the exhausted-loop path control returns through ROM 0x1F72 to the
 *           per-frame cascade at ROM 0x197A, whose next act is a call to ROM 0x2C8F, which loads
 *           a constant before it tests anything. FLAGS need no argument: the oracle's own
 *           increments here leave the carry alone and the tail's first act rebuilds every other
 *           flag from the carry and the cursor it just stepped, so both sides arrive at the same
 *           flag byte whether or not the intermediate steps set flags.
 *           MEASURED, twice. The unit arm compares the FULL state dump INCLUDING STACK_SCRATCH,
 *           plus pc, SP, the whole register file (both banks) and the propagated return value,
 *           on every one of those 1665 dispatches: this rewrite performs the oracle's stack
 *           operations exactly — the oracle pushes nothing here, its exit is a jump, and the
 *           frozen tail chain performs the same single return on both sides — so the stack
 *           region and both pointers legitimately hold, and asserting them is free teeth rather
 *           than a false contract. The live arm then wires the rewrite at 0x21BA for a
 *           1200-frame cycle-free attract run and diffs every frame against the all-oracle
 *           baseline; it counts its own dispatches and asserts the count, so it cannot pass by
 *           never running.
 * NAMES:    OBJ_X (+3), OBJ_SPRITE_CODE (+7), OBJ_SPRITE_ATTR (+8) and OBJ_Y (+5) name the
 *           source fields; SPRITE_X, SPRITE_CODE, SPRITE_ATTR and SPRITE_Y name the four
 *           destination bytes, so the permutation is readable as what it is. OBJ_ARRAY_67 and
 *           ACTOR_SPRITES name the arrays the walk runs over and are used by the gate rather
 *           than here — this routine reaches both only through the walk's pointers and holds no
 *           address of its own. The between-slots step at ROM 0x1F8D is still frozen: it belongs
 *           to the same mutually-recursive object-walk cluster and is being decompiled alongside
 *           this routine, so dissolving that jump into a direct call is a later coordinated step.
 */

import { u8 } from "../../../core/int.js";
import {
  OBJ_SPRITE_ATTR, OBJ_SPRITE_CODE, OBJ_X, OBJ_Y,
  SPRITE_ATTR, SPRITE_CODE, SPRITE_X, SPRITE_Y,
} from "./names.js";

export function loc_21ba(m) {
  const { regs, mem8 } = m;

  // Put the walk's own registers back in play. Whichever arm jumped here left its working set
  // active; from this point the record pointer, the staging cursor, the stride and the
  // remaining-slot count are the walk's again.
  regs.exx();

  const record = regs.ix;
  const page = regs.h * 256; // the cursor's high byte never moves
  const cursor = regs.l;

  // The permuting gather: four object fields into one hardware sprite record. Each store lands
  // on the cursor's page, so a cursor near the top of its page wraps rather than running on into
  // the next one.
  mem8[page + u8(cursor + SPRITE_X)] = mem8[record + OBJ_X];
  mem8[page + u8(cursor + SPRITE_CODE)] = mem8[record + OBJ_SPRITE_CODE];
  mem8[page + u8(cursor + SPRITE_ATTR)] = mem8[record + OBJ_SPRITE_ATTR];
  mem8[page + u8(cursor + SPRITE_Y)] = mem8[record + OBJ_Y];

  // Three of the four cursor steps; the fourth is the first thing the between-slots step does,
  // which is what leaves the cursor on a record boundary for the next slot.
  regs.l = cursor + 3;

  // The between-slots step — still the frozen oracle, and reached by a jump, so its result is
  // this routine's result.
  return m.call(0x1f8d);
}
