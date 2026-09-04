// SPDX-License-Identifier: GPL-3.0-only

/**
 * advanceRecordTotals — a shared running-total accumulator over a four-byte record.
 *
 * WHAT IT IS
 *   A tiny bookkeeping primitive that folds two increments into a four-byte record pointed at by HL.
 *   The record is laid out as: [HL+0] unused here, [HL+1] a per-record "delta" byte, [HL+2] a first
 *   running total, and [HL+3] a second running total. Each call adds the caller's C into the first
 *   total and adds the record's own delta byte into the second total, then hands the second total back
 *   in A. It is pure arithmetic over memory — no drawing, no IO, no control flow.
 *
 * ROLE IN THE MACHINE
 *   This is a generic record-walking helper, not tied to one object. Its named caller is the scripted-
 *   animation stepper stepAnimationFrame (ROM 0x1868), which walks an animation's two running coordinate
 *   totals with it (see mechanisms.md, "Sprite drawing"): C carries the frame's coordinate step, the
 *   record's delta byte carries the per-frame advance, and the two totals track the animation's position.
 *   The 8080 original loads the delta into B; here it is a local named `delta`.
 *
 * ROM 0x01d9-0x01e3.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: A = the second running total ([HL+3] after the add). The two totals are updated in place.
 */
export function advanceRecordTotals(m, hl = m.regs.hl, c = m.regs.c) {
  const { mem8 } = m;

  // The record's per-record advance byte lives one past the pointer ([HL+1]). It is the amount folded
  // into the SECOND total below (the 8080 code reads it into B before touching either total).
  const delta = mem8[hl + 1];

  // First total ([HL+2]) += C. The Uint8Array store wraps to 8 bits, matching the 8080 `add`/`mov m,a`.
  mem8[hl + 2] = c + mem8[hl + 2];

  // Second total ([HL+3]) += delta, kept to 8 bits. This is the value returned to the caller in A.
  const total2 = (delta + mem8[hl + 3]) & 0xff;
  mem8[hl + 3] = total2;

  // Publish the second total in A (the 8080 leaves it in the accumulator for the caller to test).
  return (m.regs.a = total2);
}
