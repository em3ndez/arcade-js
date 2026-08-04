// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_20c3 — turn an object's vertical arc around at a quarter of the speed it arrived with,
 * restart the arc from a whole-pixel position, and hand the record to the shared object-sprite
 * tail.
 *
 * A vertical arc is stored on the record as a CONSTANT launch speed plus a count of frames
 * elapsed, and the integrator moves the object down by (16·frames + 8 − launchSpeed) every frame.
 * Because the stored speed is the one the arc STARTED with, an arc cannot be reversed by negating
 * it: the elapsed frames have to be folded back in, as 16·frames − launchSpeed, with the frame
 * count restarted from zero. That reflection is what this routine performs — and then it takes a
 * QUARTER of the result, so the object comes back slower than it arrived. It also clears both
 * coordinate fractions, so the arc resumes from a whole pixel.
 *
 * The five bytes are all it writes; everything else on the record is left alone, and control then
 * passes to the shared object-sprite tail, whose result becomes this routine's result.
 *
 * WHAT IS NOT CLAIMED: which game event brings a record here — that decision is taken before entry
 * — and why the quartering shift discards the sign rather than preserving it. The shift is
 * reproduced as a logical one without any claim that a negative reflection is unreachable.
 *
 * NOT A PARAMETER, deliberately: the record pointer stays in the index register rather than
 * becoming a named argument, because the shared tail re-reads that register itself. A caller
 * passing anything else would be obeyed here and ignored one call later.
 *
 * LIVE-OUT: memory (the five record bytes), the tail's result forwarded unchanged, and the damped
 * speed mirrored into the register pair — see the note at that write for what is and is not known
 * about the mirror.
 */

import { loc_2407 } from "./loc_2407.js";

// Object-record fields, addressed off the record pointer the caller left set. The readings are
// the integrator's, since that is what reads all five back.
const LAUNCH_VY_HI = 0x12; //     upper half of the speed the vertical arc started with
const LAUNCH_VY_LO = 0x13; //     lower half of it
const AIRBORNE_FRAMES = 0x14; //  frames elapsed on this arc; scales the gravity term
const X_FRAC = 0x04; //           fractional low half of the horizontal coordinate
const Y_FRAC = 0x06; //           fractional low half of the vertical coordinate

export function loc_20c3(m) {
  const { regs, mem8 } = m;

  // 16 × elapsed frames minus the launch speed — the arc's own reflection, which is what turns the
  // object around without moving it. Both fields are read off this same record.
  const reflected = loc_2407(m);

  // A quarter of the reflection goes back as the new launch speed, so the return trip is slower
  // than the arrival. The shift drops the low two bits and does not preserve sign.
  const damped = reflected >>> 2;

  const record = regs.ix;
  mem8[record + LAUNCH_VY_HI] = damped >> 8;
  mem8[record + LAUNCH_VY_LO] = damped;

  // Restart the arc: gravity counts from zero again and both coordinates resume from a whole pixel.
  mem8[record + AIRBORNE_FRAMES] = 0;
  mem8[record + X_FRAC] = 0;
  mem8[record + Y_FRAC] = 0;

  // The damped speed is also left in this register pair, where the tail's leading register-set
  // exchange parks it in the alternate bank. NO reader for it was found; it is kept because it is
  // what the hardware sequence leaves behind, not because a consumer is known.
  regs.hl = damped;

  // The shared object-sprite tail, reached by a jump — so its result is this routine's result.
  return m.call(0x21ba);
}
