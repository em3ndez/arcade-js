// SPDX-License-Identifier: GPL-3.0-only

/**
 * negateA — two's-complement negate of the accumulator: A = (-A) & 0xff.
 * Assumes binary mode (decimal flag clear). Result written back to register A.
 */
export function negateA(m, a = m.regs.a) {
  return (m.regs.a = (-a) & 0xff);
}
