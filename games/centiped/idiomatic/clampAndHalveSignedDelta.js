// SPDX-License-Identifier: GPL-3.0-only

/**
 * clampAndHalveSignedDelta -- take a signed byte (a coordinate delta), clamp its
 * magnitude to the playfield rails, then arithmetic-halve it, spilling the bit that
 * falls off the bottom into a separate sign/remainder byte.
 *
 * ROLE IN THE MACHINE: this is a velocity/step conditioner used when an actor's
 * movement delta must be tamed before it is applied. A raw delta can point far past
 * the legal play area; halving it turns a full step into a half-step (a smoothing /
 * ease used when nudging an object toward a target lane), and the clamp guarantees the
 * value never represents a jump larger than one rail-to-rail span. On the 6502 this is
 * a CMP-branch clamp followed by a `CMP #$80 / ROR A` arithmetic-shift-right that
 * preserves the sign; the shifted-out LSB is captured because the caller uses it as a
 * rounding/sign token. Behaviour-derived, no distinct ROM label. [code]
 *
 * MECHANISM, stage 1 (clamp): only values STRICTLY inside the band 0x08..0xf8 get
 * snapped to the nearer rail -- a positive-ish mid value (< 0x80) collapses to 0x08,
 * a negative-ish one (>= 0x80) to 0xf8. Values already at or beyond the extremes
 * (< 0x08 or >= 0xf8) are small enough to pass through untouched. In signed terms this
 * bounds the magnitude: nothing between the two guard rails survives, so the delta is
 * forced to the edge of the safe range.
 *
 * MECHANISM, stage 2 (arithmetic halve): the clamped byte is shifted right one place
 * with its sign bit REPLICATED into the vacated bit 7 (a true arithmetic >> that keeps
 * negatives negative), and that result goes to Y. The single bit shifted off the
 * bottom is repackaged as A's bit 7 -- the caller reads it as the halving's dropped
 * LSB / rounding remainder. The 6502 ROR would set carry from that LSB, but here the
 * routine deliberately hands the caller a CLEAR carry so the caller's following ADC
 * adds cleanly.
 *
 * LIVE-OUT: returns [A, Y, carry]. A = the packed dropped-LSB byte (0x00 or 0x80),
 * Y = the sign-preserved half, carry = false. No RAM or hardware is touched.
 */
export function clampAndHalveSignedDelta(m, a = m.regs.a) {
  // Work on a clean 8-bit copy of the incoming delta.
  a &= 0xff;
  // Stage 1: snap only the mid-range to the nearer rail; both extremes pass through untouched.
  // Inside the band, sign (bit 7) picks which rail -- positive-ish -> low rail 0x08,
  // negative-ish -> high rail 0xf8 -- bounding the delta's magnitude to the safe span.
  let clamped;
  if (a < 0x08 || a >= 0xf8) {
    clamped = a;
  } else {
    clamped = a < 0x80 ? 0x08 : 0xf8;
  }
  // Stage 2a: arithmetic halve into Y — replicate the sign bit into the vacated bit7.
  // signIn carries bit 7 back in after the >> so a negative value stays negative
  // (arithmetic shift right, not logical), i.e. halve while preserving sign.
  const signIn = clamped >= 0x80 ? 0x80 : 0x00;
  const y = ((clamped >> 1) | signIn) & 0xff;
  // Stage 2b: the LSB rotated out of that halve becomes A's bit7 (carry-out clears).
  // The caller consumes this as the halving's dropped low bit / rounding token.
  const aOut = clamped & 0x01 ? 0x80 : 0x00;
  // Register + flag live-outs: the callers read A and Y and consume the clear carry.
  // Carry is forced FALSE so the caller's subsequent ADC starts from a clean borrow.
  return [(m.regs.a = aOut), (m.regs.y = y), (m.regs.fC = false)];
}
