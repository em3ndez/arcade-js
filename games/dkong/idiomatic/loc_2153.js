// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2153 — clear an object record's fractional X/Y sub-pixel remainders and its airborne
 * elapsed-frame counter, then hand the record to the shared object-sprite tail.
 *
 * The record is whichever one the caller left in the index register. The three fields are the
 * ones the ballistic integrator consumes on this record shape: +4 and +6 are the fractional
 * low halves of the 16-bit coordinates whose high bytes are OBJ_X and OBJ_Y, and +20 is the
 * elapsed-frame counter that scales the gravity term and is bumped once per frame. Clearing
 * all three restarts the arc from a whole-pixel position with gravity back at its first step —
 * the object-record form of what a fall reset does to Mario, whose own X/Y fraction and
 * airborne-frame cells sit at exactly these three offsets of his record. Both callers clear
 * the stored value immediately before jumping here, so in practice this is a clear: 0 on every
 * observed dispatch. Exactly these three offsets are also written together, from one value, at
 * two other sites in the same cluster — they are a SET, not three fields that happen to sit
 * next to each other.
 *
 * WHAT THIS DOES NOT CLAIM: the +20 reading is scoped to the records this cluster walks. The
 * same offset carries an unrelated role on another object array, where it is run as a
 * reload-2 sub-timer, so nothing here establishes one meaning for the offset across arrays.
 * Which game event puts an object on a fresh arc is the caller's business and is not derived
 * here.
 *
 * LIVE-OUT: memory — the three record bytes — plus everything the shared tail produces,
 * including its return value, which this routine hands straight back because both callers
 * arrive by a jump and need it to travel.
 */

// Object-record fields, addressed off the record pointer. None of the three carries a shared
// cross-array offset name, so they stay local; the names given here are the ballistic
// integrator's reading of them, since that is what reads all three back.
const AIRBORNE_FRAMES = 20; // elapsed airborne frames; scales the gravity term
const X_FRAC = 4; //          fractional low half of the coordinate whose high byte is OBJ_X
const Y_FRAC = 6; //          fractional low half of the coordinate whose high byte is OBJ_Y

export function loc_2153(
  m,
  // Both callers clear the accumulator immediately before jumping here, and the live engine
  // dispatches this routine with no argument, so that is the default.
  stored = m.regs.a,
) {
  const { mem8 } = m;
  const record = m.regs.ix;

  mem8[record + AIRBORNE_FRAMES] = stored;
  mem8[record + X_FRAC] = stored;
  mem8[record + Y_FRAC] = stored;

  // The shared object-sprite tail, reached by a jump, so its result is this routine's result.
  return m.call(0x21ba);
}
