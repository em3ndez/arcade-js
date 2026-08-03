// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1f93 — pick which of five per-frame behaviours an ACTIVE object record gets this
 * pass of the object walk, from two bytes of the record.  ROM 0x1F93.
 *
 * The walk starts at ROM 0x1F72 and runs only while BOARD is 1 (25m): ten OBJ_ARRAY_67
 * records, stride 32. Its per-slot gate at ROM 0x1F83 sends every record whose OBJ_ACTIVE
 * is exactly 1 here, and this routine is the whole of the choice — it reads two bytes,
 * writes nothing, and jumps to one of ROM 0x20EC, 0x1FAC, 0x1FE5, 0x1FEF or 0x2053, each
 * of which does the record's actual work and rejoins the walk. Everything the branches
 * then do is theirs; nothing about it is claimed here.
 *
 * TWO FIELDS, AND THE FIRST OUTRANKS THE SECOND. The select byte (record +1) is tested
 * first and for EQUALITY WITH 1; only if that fails are the low three bits of the mode
 * byte (record +2) tested, lowest first, first-set-bit-wins. Both halves of that sentence
 * are load-bearing rather than pedantic, and both are corroborated outside this body by a
 * write-tap over a plain 3000-frame attract run that attributes every write to these two
 * fields, on all ten records, to the storing instruction:
 *
 *   • The select byte is written 46 times and takes only 0 (33x) and 1 (13x). Its ONLY
 *     non-initialising writers are ROM 0x2D92 and ROM 0x2D9D — the two arms of the record
 *     re-initialiser at ROM 0x2D8C, which writes 1 on one arm and, on the other, writes 0
 *     AND stamps the mode byte with 2. ram.js reaches the same pair of addresses from the
 *     opposite direction: its HAMMER_IN_PLAY note names 0x2D92/0x2D9D as sites where
 *     record +1 carries a role unrelated to the hammer pair's, which is why it refuses to
 *     give +1 a shared OBJ_* name at all.
 *   • The 0x2D92 arm does NOT touch the mode byte, so a record can enter here with the
 *     select byte at 1 and mode bits already set — measured: over 6000 attract frames that
 *     arm fired with the mode byte holding 0 (17x), 8 (2x), 2 (3x) and 5 (1x), and 41 real
 *     dispatches of this routine arrived with select==1 over a non-zero mode byte. So the
 *     priority is not a formality; the initialiser depends on it.
 *   • The mode byte's writers are ROM 0x204C (a constant 8, 25x), ROM 0x209C (4 or 2, 23x),
 *     ROM 0x21B5 — a bare `set 0` on it, 14x — ROM 0x1FC8 (13x), ROM 0x2DA1 (a constant 2,
 *     12x) and ROM 0x212E (clears it, 1x). The values written were 2, 8, 0, 4, 3 and 5 and
 *     nothing else, which is exactly the set this routine's arms separate.
 *
 * BIT 0 IS CONSUMED, NOT A STATE THE RECORD SITS IN. The branch bit 0 selects (ROM 0x1FAC)
 * ends by reading the mode byte back, flipping its low three bits (`xor 7` at ROM 0x1FC6)
 * and storing it — so bit 0, which must have been set for that branch to be picked, is
 * always clear again afterwards, and the other two bits have swapped. Attract shows only
 * the two instances that produces: 3 becomes 4, and 5 becomes 2. Together with ROM 0x21B5,
 * which is a bare `set 0` on the same byte, bit 0 reads as a one-shot request that the
 * 0x1FAC branch answers and clears. That is a derivation from the neighbours' ROM, not a
 * measurement of intent.
 *
 * NOT CLAIMED. What the swept objects ARE, what any of the five branches means in the
 * game, and what the select byte's 1 signifies are all outside this file. The neighbouring
 * pair ROM 0x1FE5 / 0x1FEF increment and decrement the record's OBJ_X, so bits 1 and 2 do
 * separate two opposite horizontal steps — but that rests on those files, not on this one,
 * and nothing here establishes what bit 3 or an empty mode mean beyond "the ROM 0x2053
 * branch". The mode byte's bits above bit 2 are not examined at all: a record with mode 8
 * and one with mode 0 are indistinguishable to this routine.
 *
 * NAME: kept the neutral loc_. The dispatch itself is pinned to the oracle and measured,
 * but naming it would mean naming what it dispatches BETWEEN, and that is precisely what
 * is not established here.
 *
 * THE RECORD STAYS IN THE INDEX REGISTER rather than becoming a parameter. All five
 * branches are still the frozen oracle and every one of them reads the record base out of
 * the index register directly, so a caller passing a different base would be obeyed by the
 * two reads below and ignored one call later. It becomes an honest parameter once those
 * five are decompiled.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1f93.test.js.
 * GATE:     captured + crafted + live, ATTRACT ONLY. This routine needs no input and the
 *           gate MEASURES its reach: 11026 real dispatches in a 6000-frame attract run,
 *           first at frame 613, and EVERY ONE of them is replayed inline (rehost twice at
 *           the dispatch, run oracle and rewrite, compare, discard) — no sampling, so there
 *           is no sampling policy to be wrong about. Asserted coverage: all five branches
 *           are reached by real dispatches (ROM 0x20EC 395x, 0x1FAC 785x, 0x1FE5 4468x,
 *           0x1FEF 3386x, 0x2053 1992x), across 37 distinct entry shapes and record slots
 *           0-7 of the ten, and 41 of those dispatches carry select==1 over a non-zero mode
 *           byte. Each replay also asserts the branch the rewrite picks against the branch
 *           the ORACLE picks, observed by stubbing all five targets — the arm label is
 *           never taken from the rewrite. Three crafted arms cover what attract does not
 *           produce, each poking only the one or two record bytes on a REAL capture: select
 *           1 against mode bits 7 (the priority against a mode BIT rather than against 8),
 *           select 2 (which separates "equal to 1" from "non-zero"), and mode 6 (bits 1 and
 *           2 together). Slots 8-9, credited gameplay, two-player and boards 2-4 are NOT
 *           covered — the walk runs only while BOARD is 1. Teeth: five broken twins, TWO of
 *           which escape all 11026 real captures and are caught only by a crafted arm; both
 *           halves are asserted, so a twin migrating from one half to the other fails.
 * LIVE-OUT: memory-only — this routine writes nothing — plus the branch's return value
 *           propagated unchanged. What it drops relative to the oracle is the accumulator
 *           and the flags at the moment the branch is entered, and NOTHING else: it keeps
 *           the oracle's tail dispatch, so the frozen chain still performs every stack
 *           operation and still leaves pc, SP and the whole register file where the oracle
 *           does. DERIVED: the accumulator and every flag are dead on all five arms, each
 *           overwritten before it is read. ROM 0x1FAC reloads the accumulator at ROM
 *           0x1FB0 and reaches its first conditional (ROM 0x1FB6) through a compare at ROM
 *           0x1FB3 that sets every flag it uses. ROM 0x1FE5 and 0x1FEF reach ROM 0x1FF6,
 *           which overwrites the accumulator at ROM 0x1FFC and sets the flags with the mask
 *           at ROM 0x1FFD, both ahead of its first conditional at ROM 0x2001. ROM 0x2053
 *           and ROM 0x20EC both open with a call to ROM 0x239C, which loads the accumulator
 *           from the record at ROM 0x239C and adds at ROM 0x239F before it tests anything.
 *           MEASURED TWICE, and at the seam rather than after it —
 *           poisoning after the dispatch would only prove the frozen chain overwrote
 *           things: (a) an all-oracle attract run with the accumulator and all eight flags
 *           INVERTED at the instant of the branch dispatch, on all 11026 dispatches, stays
 *           byte-identical to the baseline for 6000 frames including the STACK_SCRATCH
 *           window; and (b) the rewrite itself, wired live at 0x1F93 with the oracle's head
 *           cost restored, is byte-identical over the same 6000 frames, again including
 *           STACK_SCRATCH. The unit arm compares the full state dump, the return value, pc,
 *           SP and the entire register file on every dispatch; the stack window and both
 *           pointers legitimately hold here, so they are asserted as extra teeth rather
 *           than excluded.
 * NAMES:    OBJ_ARRAY_67 and OBJ_ACTIVE from ram.js are named above only to say where the
 *           walk runs; this routine holds no address of its own and reaches its record
 *           through the walk's index register. The two fields it reads have NO registry
 *           name on purpose — see the HAMMER_IN_PLAY note quoted above — so they are
 *           file-local constants here, the same convention as GATHER_DEST in loc_34f3.js.
 *           All five branch targets are still frozen: they belong to the same
 *           mutually-recursive object-walk cluster and are being decompiled alongside this
 *           routine, so dissolving those into direct calls is a later coordinated step.
 */

// Record fields, relative to the walk's current record base. ram.js deliberately gives
// neither a shared OBJ_* name: its HAMMER_IN_PLAY note records that +1 carries unrelated
// roles per array and names this very site as one of them.
const BRANCH_SELECT = 1; // tested for equality with 1, and outranks the mode bits
const BRANCH_MODE_BITS = 2; // low three bits, lowest first, first set bit wins

/**
 * @param {object} m  the machine. The record base is read from the index register rather
 *                    than passed — every branch below is still frozen and reads it there.
 * @returns {*}       the chosen branch's return value, propagated unchanged.
 */
export function loc_1f93(m) {
  const { regs, mem8 } = m;
  const record = regs.ix;

  // The select byte pre-empts the mode bits entirely, and only the exact value 1 counts.
  if (mem8[record + BRANCH_SELECT] === 1) return m.call(0x20ec);

  // Otherwise the lowest set of the three mode bits picks the branch. Every one of these
  // is entered by a jump, so there is no return address to push beside it: this routine's
  // own return IS the branch's return.
  const mode = mem8[record + BRANCH_MODE_BITS];
  if (mode & 1) return m.call(0x1fac);
  if (mode & 2) return m.call(0x1fe5);
  if (mode & 4) return m.call(0x1fef);

  // None of the three set — which includes every record whose mode byte is 8 or 0, the
  // two values attract produces here.
  return m.call(0x2053);
}
