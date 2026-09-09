// SPDX-License-Identifier: GPL-3.0-only

/**
 * foldSignedMagnitude -- conditionally negate A so the caller ends up holding the
 * MAGNITUDE (absolute value) of a signed byte. This is the tail half of the classic
 * 6502 "absolute value" idiom: the caller has already computed a signed difference
 * (typically SEC / SBC of two coordinates) and set the processor's N (negative) flag
 * from bit 7 of that result; this routine is the "if it came out negative, negate it"
 * step, factored out because so many distance comparisons in the segment/head motion
 * code want "how far apart, sign discarded".
 *
 * ROLE IN THE MACHINE: the centipede's motion routines constantly ask "is the head
 * within N of this slot?" in both X and Y. They subtract two positions, then fold the
 * signed delta down to a magnitude here, then compare that magnitude to a small window
 * (e.g. < 5, < 6, < 0x0a). Callers like routeSegmentByRange and stepHeadSegment lean
 * on this. It has no ROM label of its own -- it is the inlined ABS tail that appears
 * at many negate sites; behaviour-derived. [code]
 *
 * MECHANISM: on the 6502 a two's-complement negate is `EOR #$ff` + `ADC #1`, i.e.
 * (-a) & 0xff. Non-negative inputs must pass through unchanged. Crucially the sign is
 * threaded in as the `negative` (N-flag) PARAMETER rather than re-derived from `a`
 * here, faithfully mirroring the hardware: the caller's N flag, set by whatever
 * arithmetic produced `a`, is what decides the branch. When N reflects bit 7 of `a`
 * the net effect is exactly abs(a). Assumes the CPU's decimal (BCD) mode is clear, as
 * it always is in this game's binary arithmetic.
 *
 * LIVE-OUT: register A (m.regs.a) = negative ? (-a) & 0xff : (a & 0xff). No memory
 * (RAM/hardware) is written -- this is a pure register transform.
 */
export function foldSignedMagnitude(m, a = m.regs.a, negative = m.regs.fN) {
  // If the caller flagged the value negative, two's-complement negate it into the
  // positive magnitude ((-a) & 0xff wraps to a byte); otherwise just mask to 8 bits
  // and pass it through. The result is written back to A, the sole live-out.
  return (m.regs.a = negative ? (-a & 0xff) : (a & 0xff));
}
