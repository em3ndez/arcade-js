// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1f83 — the object walk's per-slot gate: hand an ACTIVE record to the active-slot
 * dispatch, or step the staging cursor past the record this slot leaves alone.  ROM 0x1F83.
 *
 * The walk starts at ROM 0x1F72 and runs only while BOARD is 1 (25m): ten OBJ_ARRAY_67 records,
 * stride 32, each staging one 4-byte record into ACTOR_SPRITES. This routine is the head of every
 * pass round that walk. It reads one byte — the record's OBJ_ACTIVE — and picks between the two
 * halves of the loop body. An active record is handed whole to the active-slot dispatch at ROM
 * 0x1F93, which takes the staging cursor over with it. Anything else is skipped, and the skip's
 * whole job is to move that cursor over the four bytes this slot did not write. It moves three of
 * them; the fourth belongs to the between-slots step at ROM 0x1F8D, which both halves converge on
 * — the same three-then-one split the shared sprite-record tail at ROM 0x21BA takes on the active
 * side. So the cursor arrives on a record boundary whichever half ran, and the gate measures
 * exactly that: at all 6160 captured entries it sits at ACTOR_SPRITES + 4*(10 - slots remaining).
 *
 * THE TEST IS EQUALITY WITH 1, NOT A BIT TEST, and the difference is real rather than pedantic.
 * names.js records this array's flag byte as taking {0,1,2} live under MAME, bit0 = active and bit1 =
 * occupied, so 2 is a slot that is spoken for but not yet running — and this gate skips it exactly
 * as it skips 0. The corroboration is outside this body, in the PRODUCER of that value:
 * releaseBarrelIntoFreeSlot claims a record by stamping OBJ_ACTIVE with 2, watched directly under
 * MAME (see its header), and the walk at ROM 0x2C8F that finds it a free record separates the same
 * three values by rotation — bit0 set, skip; bit1 set, skip; neither, claim. A bit test here would
 * have admitted a claimed-but-not-yet-running record into the animation dispatch, which is a
 * prediction that could have come out the other way and did not. The gate's crafted arm covers a
 * fourth value, 3; attract never produces one, and whether the ROM can is NOT established here.
 *
 * WHAT THIS FILE DOES NOT CLAIM: it writes no memory and interprets no field of the record beyond
 * that one flag, so what the records HOLD and what the staged bytes MEAN are not derivable here.
 * The record layout belongs to the dispatch at ROM 0x1F93 and the field layout to the shared tail
 * at ROM 0x21BA; neither was grounded for this file.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1f83.test.js.
 * GATE:     captured + crafted + live, ATTRACT ONLY. 0x1F83 needs no input: a plain 1200-frame
 *           attract run dispatches it 6160 times, first at frame 586, and the gate replays EVERY
 *           ONE of them inline (clone twice at the dispatch, run oracle and rewrite, compare,
 *           discard) rather than sampling. Asserted coverage: all three flag values attract
 *           produces (0, 1 and 2 — so both arms and the skip-a-claimed-slot case are real
 *           captures), all ten remaining-slot values, all ten OBJ_ARRAY_67 record bases, all ten
 *           staging-cursor positions, and the cursor arithmetic this header rests on. Two crafted
 *           arms cover what attract cannot produce: a flag of 3, and a staging cursor whose step
 *           wraps its page (attract runs it 0x6980-0x69A4 and never wraps). Credited gameplay,
 *           boards 2-4 and two-player are NOT covered — the walk runs only while BOARD is 1.
 *           Teeth: five broken twins, two of which escape every natural capture and are caught
 *           only by a crafted arm — both halves asserted. The gate also MEASURES the ceiling on
 *           what a cursor defect can be seen by at all: the cursor is read by nothing but the
 *           shared tail at ROM 0x21BA, only 1688 of the 6160 replays reach it, and only 96 of
 *           those entered on the arm that moves the cursor — so the two cursor twins are asserted
 *           to be caught on all 96 rather than merely on "more than zero".
 * LIVE-OUT: the staging cursor's low byte, kept in the register because the frozen tail reads it
 *           there; plus the propagated return value. NO accumulator and NO flag.
 *           DERIVED: both call sites in translated/ (ROM 0x1F72 and the loop-back at ROM 0x1F8D)
 *           are `return m.call(...)` tails, so control never comes back to a caller that could
 *           read a register — the only readers are on the two continuations. Each rewrites what
 *           this routine touches within two operations: ROM 0x1F93 reloads the accumulator from
 *           the record's next field and immediately decrements it, and ROM 0x1F8D's own two
 *           register steps — the cursor's fourth move and the record-pointer advance — between
 *           them replace every bit of the flag byte except the carry. The carry needs no argument:
 *           the oracle's four operations here (one decrement, three increments) all leave it
 *           alone, so it is passed through unchanged on both sides. Following the chain out to
 *           where it does return — ROM 0x1F8D's
 *           exhausted loop, back through ROM 0x1F72 to the per-frame cascade at ROM 0x197A —
 *           the next act there is a call to ROM 0x2C8F, which loads a constant before it tests
 *           anything.
 *           MEASURED, twice. The unit arm compares the FULL state dump including STACK_SCRATCH,
 *           plus pc and SP, on every one of those 6160 dispatches: this rewrite keeps the oracle's
 *           stack shape exactly (the oracle pushes nothing here — both exits are jumps — and the
 *           frozen tail chain performs the single `ret` on both sides), so the stack region and
 *           both pointers legitimately hold, and asserting them is free teeth rather than a false
 *           contract. The live arm then wires the rewrite at 0x1F83 for a 1200-frame cycle-free
 *           attract run and diffs every frame against the all-oracle baseline; it counts its own
 *           dispatches and asserts the count, so it cannot pass by never running.
 * NAMES:    OBJ_ACTIVE (+0) imported from names.js. OBJ_ARRAY_67 and ACTOR_SPRITES name the arrays
 *           the walk runs over and are used by the gate rather than here — this routine reaches
 *           its record only through the walk's pointer and holds no address of its own. Both
 *           m.call targets are still frozen: they belong to the same mutually-recursive
 *           object-walk cluster and are being decompiled alongside this routine, so dissolving
 *           those calls into direct calls is a later coordinated step.
 */

import { OBJ_ACTIVE } from "./names.js";

export function loc_1f83(m) {
  const { regs, mem8 } = m;

  // An active record — and only a flag of exactly 1 counts — is animated and staged by the
  // active-slot dispatch, which advances the staging cursor itself as it writes.
  if (mem8[regs.ix + OBJ_ACTIVE] === 1) return m.call(0x1f93);

  // Otherwise this slot stages nothing, so its four sprite bytes keep whatever they held and the
  // cursor simply steps over them. Three moves here, the fourth in the between-slots step. Only
  // the cursor's low byte moves, so it can never leave the page it is in.
  regs.l = regs.l + 3;
  return m.call(0x1f8d);
}
