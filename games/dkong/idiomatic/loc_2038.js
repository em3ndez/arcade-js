// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2038 — start one object record falling, and hand on to the shared sprite tail.
 *
 * The record is one slot of the ten-slot object array the 25m board object sweep walks, and
 * the sweep keeps the record's base in the index register. Seven bytes of that record are
 * written and nothing else: the initial vertical velocity pair, the two coordinate fraction
 * bytes, the airborne frame counter, the sub-state counter, and the sweep's per-record arm
 * selector. Control then continues into the shared object-sprite tail.
 *
 * WHY THIS IS A LAUNCH, and it is not visible in the seven stores themselves:
 *   - The reader of four of those fields steps ballistic motion. It subtracts the velocity
 *     pair from the vertical position every frame, treats the two fraction bytes as the low
 *     halves of the 16.8 horizontal and vertical positions, and widens the gravity slice it
 *     adds back as the frame counter grows. So blanking the counters and fractions and
 *     stamping a velocity is an initialisation of an arc, not an update within one.
 *   - Mario's record shares this shape at the same offsets, and the same field set is what
 *     Mario's own fall init clears before raising his airborne flag.
 *   - WHICH WAY it launches follows from the sign. A jump stamps a large positive value into
 *     the velocity pair and a plain fall stamps zero; this routine stamps a signed −16, past
 *     the fall end and nowhere near the jump end. Under the motion step's arithmetic a
 *     negative value there makes the gravity term and the velocity term push the position the
 *     SAME way from frame one, so the motion never turns over.
 *   - The arm selector is read by the sweep's dispatcher, which tests three bits in turn and
 *     falls through to the ballistic arm when none is set. The value written here sets none of
 *     them, so arming the fall and selecting the falling arm are the same act.
 *   - The sub-state counter belongs to that arm, which counts it up and on its later values
 *     returns the record to one of the two arms that step the object's X one pixel per frame.
 *     The analogy with Mario's record STOPS at this offset: on his it is the Y he became
 *     airborne from, written rather than cleared, so reading a start-Y here would be wrong.
 *
 * WHAT THIS DOES NOT CLAIM: which way the motion reads ON SCREEN — "falling" rests on the sign
 * of the velocity armed here, read against the grounded jump and fall values of the same field
 * on Mario's record, not on watching a pixel. Nor does this file say what makes an object start
 * falling; both callers arrive only after their own tests.
 *
 * NOT A PARAMETER, deliberately: the record base stays in the index register instead of
 * becoming a named argument, because the shared sprite tail reads that same register directly.
 * A caller passing a different record would be obeyed by these seven stores and ignored one
 * hand-off later.
 *
 * LIVE-OUT: memory only — the seven written record bytes — plus whatever the sprite tail
 * returns, forwarded unchanged. The seven stores touch no register and no flag, so what
 * callers see in the register file afterwards belongs entirely to that tail and the sweep
 * below it.
 */

// Record fields written here. None has a shared registry name; offsets this high are in-record
// only for the stride-32 arrays, which is what this object array is.
const ARM_SELECT = 2; // the sweep dispatcher tests bits 0, 1 and 2 of this byte
const X_FRACTION = 4; // low half of the 16.8 horizontal position the motion step advances
const Y_FRACTION = 6; // low half of the 16.8 vertical position the motion step advances
const SUBSTATE = 14; // counter the falling arm's own sub-state machine advances
const INITIAL_VY_HI = 18; // initial vertical velocity, high byte first
const INITIAL_VY_LO = 19;
const AIRBORNE_FRAMES = 20; // frames since launch; the gravity slice widens with it

/** The initial vertical velocity this routine arms: signed 16-bit, in 1/256-pixel units. */
const INITIAL_VY = -16;

/** No arm-selector bit set, so the sweep dispatcher falls through to the falling arm. */
const FALLING_ARM = 8;

/** The shared object-sprite tail. */
const SPRITE_TAIL = 0x21ba;

/**
 * @param {object} m  the machine (memory, and the register file the sprite tail reads).
 * @param {number} resetValue  the value blanked into the four counter/fraction fields. Both
 *   callers clear the accumulator before reaching here, so in play it is 0; it is a parameter
 *   because they hand it over in a register. Unlike the record base it is honestly variable —
 *   the sprite tail overwrites the accumulator before reading it, so nothing downstream
 *   re-derives this value from the register.
 * @returns whatever the sprite tail returns, unchanged.
 */
export function loc_2038(
  m,
  resetValue = m.regs.a /* the callers hand this over in a register */,
) {
  const { mem8 } = m;
  const record = m.regs.ix;

  // Launch downhill rather than upward: with this velocity negative, the gravity term and the
  // velocity term push the position the same way from frame one, so the motion never turns over.
  mem8[record + INITIAL_VY_HI] = INITIAL_VY >> 8;
  mem8[record + INITIAL_VY_LO] = INITIAL_VY;

  // Start the fall from a clean slate: no frames elapsed, no sub-state progress, and both
  // positions exact on their whole pixel.
  mem8[record + AIRBORNE_FRAMES] = resetValue;
  mem8[record + SUBSTATE] = resetValue;
  mem8[record + X_FRACTION] = resetValue;
  mem8[record + Y_FRACTION] = resetValue;

  // Move the record onto the arm that steps that motion every frame.
  mem8[record + ARM_SELECT] = FALLING_ARM;

  return m.call(SPRITE_TAIL);
}
