// SPDX-License-Identifier: GPL-3.0-only

/**
 * clampAndHalveSignedDelta — clamp a byte to the playfield rails, then arithmetic-halve it,
 * packing the shifted-out low bit into a separate sign/remainder byte.
 *
 * Stage 1 snaps only mid-range values (strictly inside 0x08..0xf8) to the nearer rail; the
 * extremes pass through. Stage 2 halves with the sign preserved into Y and packs the dropped
 * LSB as A's bit7. Returns [A, Y, carry], leaving carry clear for the caller's ADC. No RAM
 * is touched. [code]
 */
export function clampAndHalveSignedDelta(m, a = m.regs.a) {
  a &= 0xff;
  // Stage 1: snap only the mid-range to the nearer rail; both extremes pass through untouched.
  let clamped;
  if (a < 0x08 || a >= 0xf8) {
    clamped = a;
  } else {
    clamped = a < 0x80 ? 0x08 : 0xf8;
  }
  // Stage 2a: arithmetic halve into Y — replicate the sign bit into the vacated bit7.
  const signIn = clamped >= 0x80 ? 0x80 : 0x00;
  const y = ((clamped >> 1) | signIn) & 0xff;
  // Stage 2b: the LSB rotated out of that halve becomes A's bit7 (carry-out clears).
  const aOut = clamped & 0x01 ? 0x80 : 0x00;
  // Register + flag live-outs: the callers read A and Y and consume the clear carry.
  return [(m.regs.a = aOut), (m.regs.y = y), (m.regs.fC = false)];
}
