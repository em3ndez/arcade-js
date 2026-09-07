// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceObjectFlightCurve -- the shared swoop generator: a cross-coupled fixed-point rotation.
 *
 * WHAT IT IS
 *   A motion-planning primitive that sits beneath the dive/flight state handlers (advanceObjectDiveStep
 *   state 4, advanceObjectFlightAndFire state 3, advanceHomingObjectFlightAndFire state 9). It runs a
 *   small integer rotation over two 16-bit accumulators stored inside the object record, producing the
 *   curved sweep an attacker traces as it peels off the formation. It writes no screen Y itself; the
 *   caller adds the accumulator high bytes into the object's Y.
 *
 * ROLE IN THE MACHINE
 *   The step count is data-driven: ((record+0x18 seed) & 3) + 1, so between one and four integration
 *   steps run per call. Each step nudges one accumulator by twice the OTHER accumulator's sign-extended
 *   high byte -- the classic cheap sine/cosine oscillator -- which rotates the (acc1, acc2) vector a small
 *   angle. Because 2*hi can be negative, its high byte sign-extends to -1 (the `borrow`). A resulting high
 *   byte of exactly 128 is treated as an overflow and that step's high byte is reverted to its pre-step
 *   value, clamping the swing. The two accumulators' high bytes become the swoop/flight offset the dive AI
 *   folds into screen Y.
 *
 * ROM 0x116b.  Grounding: [seen] (write-tap confirmed; drives the visible swoop trajectory vs MAME).
 *
 * LIVE-OUT: the two accumulators in the object record -- hi/lo at record+0x19/+0x1b (acc1) and
 * record+0x1a/+0x1c (acc2).
 */

// Object-record layout: the step-count seed and two 16-bit accumulators, each as (hi, lo).
const STEP_SEED = 24;
const ACC1_HI = 25, ACC1_LO = 27;
const ACC2_HI = 26, ACC2_LO = 28;

// One step: add sign-extended 2*srcHi into the hi:lo accumulator, with the high-byte==128 overflow guard.
function integrate(hi, lo, srcHi) {
  const doubled = (srcHi << 1) & 0xff;      // low byte of 2*srcHi
  const borrow = srcHi & 0x80 ? 1 : 0;      // 2*srcHi negative -> its high byte is -1
  // 16-bit add of the sign-extended 2*srcHi into hi:lo: low byte first, carry the high byte, apply borrow.
  const sum = doubled + lo;
  const loNext = sum & 0xff;
  const carry = sum > 0xff ? 1 : 0;
  const hiNext = (hi - borrow + carry) & 0xff;
  // Overflow guard: a high byte of exactly 128 reverts to the pre-step value (clamps the swing).
  return { hi: hiNext === 128 ? hi : hiNext, lo: loNext };
}

export function advanceObjectFlightCurve(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Data-driven step count: ((seed record+0x18) & 3) + 1, i.e. one to four rotation steps this call.
  const steps = (mem8[obj + STEP_SEED] & 3) + 1;

  // Load both accumulators (hi:lo pairs) out of the object record into locals for the loop.
  let hi1 = mem8[obj + ACC1_HI], lo1 = mem8[obj + ACC1_LO];
  let hi2 = mem8[obj + ACC2_HI], lo2 = mem8[obj + ACC2_LO];

  // Cross-coupled rotation: each step feeds the other accumulator's high byte through the integrator.
  for (let i = 0; i < steps; i++) {
    ({ hi: hi1, lo: lo1 } = integrate(hi1, lo1, hi2));           // acc1 += 2 * acc2 high byte
    ({ hi: hi2, lo: lo2 } = integrate(hi2, lo2, -hi1 & 0xff));   // acc2 -= 2 * acc1 high byte
  }

  // Store the rotated accumulators back; the high bytes are what the flight/dive handlers read as Y offset.
  mem8[obj + ACC1_HI] = hi1;
  mem8[obj + ACC2_HI] = hi2;
  mem8[obj + ACC1_LO] = lo1;
  mem8[obj + ACC2_LO] = lo2;
}
