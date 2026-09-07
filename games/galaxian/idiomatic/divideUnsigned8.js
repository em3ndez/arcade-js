// SPDX-License-Identifier: GPL-3.0-only
/**
 * divideUnsigned8 (ROM 0x0048) -- 8-bit unsigned divide A / D.
 *
 * WHAT IT IS
 *   The classic restoring divide, done in 8 rounds of compare-subtract-shift with the divisor walked
 *   DOWN one bit per round. Each round: if the running dividend still holds the current divisor,
 *   subtract it and record a 1 quotient bit, else record 0; the bit is rotated into the quotient (C)
 *   and, in the same carry thread, the divisor (D) is rotated right one place. After 8 rounds the
 *   quotient is in C, the remainder in A, the fully-shifted divisor in D, and the round counter B has
 *   been spent to 0. Pure register math -- no memory effect. The three ROM fragments (entry,
 *   compare/subtract, shift-and-loop) collapse into this one JS loop.
 *
 * ROLE IN THE MACHINE
 *   The shared integer divide behind the enemy-aiming math. computeDirectionOctantFromSlope (0x11d0)
 *   divides a vertical drop by a horizontal delta and takes the top three bits as a 0-7 heading octant;
 *   computeJitteredXVelocity (0x1218) divides the same slope to scale an aimed shot's X velocity.
 *   Callers read the quotient out of C.
 *
 * ROM 0x0048.  Grounding: [seen] (names.js cert for 0x0048).
 *
 * LIVE-OUT: C = quotient (the interface value), A = remainder, D = shifted divisor, B = 0.
 */
export function divideUnsigned8(m, dividend = m.regs.a, divisor = m.regs.d) {
  let a = dividend & 0xff; // running dividend / remainder
  let d = divisor & 0xff;  // divisor, shifted down one bit per round
  let quotient = 0;        // C: quotient accumulator
  let carry = 0;           // the Z80 carry flag, threaded rl c -> rr d each round

  for (let round = 0; round < 8; round++) {
    // cp d then (when A>=D) sub d: borrow set iff A<D; subtract only when it fits.
    if (a < d) {
      carry = 1; // A<D: no subtract, borrow stands
    } else {
      a = (a - d) & 0xff; // A>=D: A -= D, no borrow
      carry = 0;
    }

    // ccf: this round's quotient bit is the complemented borrow (1 when the divisor fit).
    carry = carry ? 0 : 1;

    // rl c: shift the quotient bit into C; the carry out is C's old bit 7...
    const cOut = (quotient >> 7) & 1;
    quotient = ((quotient << 1) | carry) & 0xff;
    carry = cOut;

    // ...which rr d then shifts into D's top as it walks the divisor down; carry out = D's old bit 0.
    const dOut = d & 1;
    d = ((d >> 1) | (carry ? 0x80 : 0)) & 0xff;
    carry = dOut;
  }

  // Live-out registers: C=quotient (the interface value callers read), A=remainder, D=shifted divisor, B=0.
  return (m.regs.a = a, m.regs.d = d, m.regs.b = 0, m.regs.c = quotient);
}
