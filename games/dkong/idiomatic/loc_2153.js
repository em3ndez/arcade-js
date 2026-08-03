// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2153 — clear an object record's fractional X/Y sub-pixel remainders and its airborne
 * elapsed-frame counter, then hand the record to the shared object-sprite tail.  ROM 0x2153.
 *
 * The record is whichever one the caller left in the index register; every attract dispatch is
 * an OBJ_ARRAY_67 record. The three fields are the ones stepBallisticMotion consumes on the
 * same record shape: +4 and +6 are the fractional low halves of the 16-bit coordinates whose
 * high bytes are OBJ_X and OBJ_Y, and +20 is the elapsed-frame counter that scales its gravity
 * term and that it bumps once per frame. Clearing all three restarts the arc from a whole-pixel
 * position with gravity back at its first step — the object-record form of what beginMarioFall
 * does to Mario, whose MARIO_X_FRAC, MARIO_Y_FRAC and MARIO_AIR_FRAMES sit at exactly these
 * three offsets of the record based at MARIO_ACTIVE. Both frozen callers clear the accumulator
 * immediately before jumping here, so in the ROM this is a clear — measured 0 on every captured
 * dispatch. Exactly these three offsets are also written together, from one value, at two
 * sibling sites in the same cluster (ROM 0x2038 and ROM 0x20C3): they are a set, not three
 * fields that happen to be adjacent in the ROM.
 *
 * WHAT THIS DOES NOT CLAIM: the +20 reading is scoped to the records this cluster walks. The
 * same offset carries an unrelated role on the OBJ_ARRAY_64 records, where ROM 0x33E7 runs it
 * as a reload-2 sub-timer, so nothing here establishes one meaning for the offset across
 * arrays. Which game event puts an object on a fresh arc is the caller's business and is not
 * derived here.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2153.test.js.
 * GATE:     ATTRACT captures + crafted stored values. A 6000-frame attract run dispatches this
 *           13 times and ALL 13 are replayed oracle-vs-rewrite on RAM − STACK_SCRATCH plus the
 *           return value; the 13 cover both frozen callers (11 via ROM 0x2146, 2 via ROM
 *           0x2118) and both records attract exercises. Attract only ever stores 0, so the
 *           parameter itself is pinned by a crafted sweep of all 256 stored values on a real
 *           captured entry of each of the three shapes — 768 in all. Also wired live for a
 *           2000-frame attract run with the oracle's T-states restored, compared frame-by-frame
 *           against the all-oracle baseline (and a control arm asserts the un-restored wiring
 *           DOES fork, so that comparison is sensitive rather than lenient).
 *           NOT covered: credited play, boards other than 25m, and OBJ_ARRAY_67
 *           records past the second — attract reaches none of those. Teeth: four broken twins —
 *           one of them (a hard-coded zero) invisible to the captured arm, one (a swallowed
 *           tail result) invisible to the RAM diff.
 * LIVE-OUT: memory — the three record bytes — plus everything the frozen tail at ROM 0x21BA
 *           produces, which the rewrite still reaches through that same frozen tail and returns
 *           on. Nothing is dropped: this routine writes no register and no flag of its own, so
 *           the register file, the flags and the returned value at exit belong entirely to the
 *           tail. Both callers (ROM 0x2118 and ROM 0x2146 — the only two, and each arrives by a
 *           jump rather than a call) hand their own return straight through it, so the value has
 *           to travel; the gate asserts it on every replay.
 * NAMES:    none imported — every access is relative to the caller's record pointer. The three
 *           offsets have no shared OBJ_* name in ram.js and stay local consts here.
 */

// Object-record fields, addressed off the record pointer. None of the three carries a shared
// OBJ_* offset name in ram.js, so they stay local consts here; the names are stepBallisticMotion's
// reading of them, since that is what reads all three back.
const AIRBORNE_FRAMES = 20; // elapsed airborne frames; scales the gravity term
const X_FRAC = 4; //          fractional low half of the coordinate whose high byte is OBJ_X
const Y_FRAC = 6; //          fractional low half of the coordinate whose high byte is OBJ_Y

export function loc_2153(
  m,
  // oracle-boundary default: both frozen callers (ROM 0x2118 and ROM 0x2146) clear the
  // accumulator immediately before jumping here, and the live engine dispatches this as fn(m).
  stored = m.regs.a,
) {
  const { mem8 } = m;
  const record = m.regs.ix;

  mem8[record + AIRBORNE_FRAMES] = stored;
  mem8[record + X_FRAC] = stored;
  mem8[record + Y_FRAC] = stored;

  // The shared object-sprite tail — still the frozen oracle, and reached by a jump, so its
  // result is this routine's result.
  return m.call(0x21ba);
}
