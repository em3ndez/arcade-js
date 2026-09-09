// SPDX-License-Identifier: GPL-3.0-only

/**
 * foldSignedMagnitude -- conditionally negate A so the caller holds a magnitude;
 * the tail of the classic 6502 "abs" idiom. Non-negative A passes through; negative
 * A drops into a two's-complement negate ((-A) & 0xff). The sign is threaded in as
 * the N-flag input rather than recomputed, so with N reflecting A the effect is
 * abs(A). Assumes binary mode (decimal flag clear).
 *
 * Live-out: register A (m.regs.a) = negative ? (-A) & 0xff : A. No memory writes.
 */
export function foldSignedMagnitude(m, a = m.regs.a, negative = m.regs.fN) {
  return (m.regs.a = negative ? (-a & 0xff) : (a & 0xff));
}
