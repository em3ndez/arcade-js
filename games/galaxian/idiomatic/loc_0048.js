// SPDX-License-Identifier: GPL-3.0-only
// 8-bit unsigned divide A / D by 8 rounds of compare-subtract-shift (the classic restoring divide, with
// the divisor walked DOWN one bit per round). Each round: if the dividend still holds the current divisor,
// subtract it and record a 1 quotient bit, else record 0; shift the bit into the quotient and shift the
// divisor right. After 8 rounds the quotient is in C, the remainder in A and the (fully shifted) divisor in
// D, with the round counter B spent to 0. Pure register math -- no memory effect. Callers read the quotient
// out of C. The three restoring-divide fragments (entry, compare/subtract, shift-and-loop) collapse into
// this one JS loop.
export function loc_0048(m, dividend = m.regs.a, divisor = m.regs.d) {
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
