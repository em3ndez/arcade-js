// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampObjectAndDecCounter — read a control byte, decrement a shared one-byte counter in
 * place, and stamp two fixed state bytes into an object record.
 *
 * PURE LEAF: reads one byte via BC, read-modify-write decrements the byte at (HL), writes
 * two bytes into the record at IX, and calls nothing. The decremented counter determines
 * the caller's exit flags (Z exactly when it reached 0).
 *
 * LIVE-OUT: returns { a, counter } plus the (HL) decrement and two IX stamps in memory.
 */
export function stampObjectAndDecCounter(m, record = m.regs.ix, counterPtr = m.regs.hl, sourcePtr = m.regs.bc) {
  const { mem8 } = m;

  const a = mem8[sourcePtr];
  const counter = (mem8[counterPtr] - 1) & 0xff;
  mem8[counterPtr] = counter;

  const base = record;
  mem8[base + 0x13] = 0x01; // stamp the two object state bytes
  mem8[base + 0x16] = 0xc1;

  return { a, counter };
}
