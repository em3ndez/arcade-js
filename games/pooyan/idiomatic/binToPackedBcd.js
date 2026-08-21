// SPDX-License-Identifier: GPL-3.0-only
/**
 * binToPackedBcd — convert a binary count to packed BCD: the low two decimal digits plus a hundreds
 * tally. Counting up in BCD `count` times, the low two digits land packed in `a` (count mod 100) and
 * every 99->00 rollover bumps `hundreds` (count div 100). A count of 0 means a full 256 passes (the
 * loop is exit-tested, so a zero counter wraps to 256), giving a=0x56, hundreds=2.
 *
 * LIVE-OUT: returns { a, hundreds } -> A (the packed-BCD digits, drawn as a 2-digit HUD field) and C
 * (the hundreds count, folded into the hundreds slot); both are consumed by the caller. Memory untouched.
 */
export function binToPackedBcd(m, count = m.regs.b) {
  const iters = count === 0 ? 256 : count; // a zero counter counts a full wrap (256), not zero passes
  const low = iters % 100;
  const a = (Math.floor(low / 10) << 4) | (low % 10);
  const hundreds = Math.floor(iters / 100);
  return { a: (m.regs.a = a), hundreds: (m.regs.c = hundreds) };
}
