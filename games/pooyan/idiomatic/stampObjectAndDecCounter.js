// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampObjectAndDecCounter — read a control byte, count a shared one-byte counter down by
 * one in place, and stamp two fixed state bytes into an object record.  ROM 0x57e5-0x57ef.
 *
 * A short leaf the engine reuses whenever it activates or re-arms one of these object
 * records: it primes the record's two fixed control fields to a known "just started" state
 * while simultaneously drawing down a caller-chosen population counter (barrels/enemies/
 * shots outstanding, etc.) so the caller can tell — from the counter reaching zero — when
 * the last one has been handled.  The three pointers all arrive in registers: the record
 * base in IX, the counter's address in HL, and the address of the control byte to sample in
 * BC.  It touches nothing else and calls nothing (a PURE LEAF).  [seen]
 *
 * The two stamped bytes are the record's own state fields, not scratch: +0x13 is set to 0x01
 * and +0x16 to 0xc1.  0xc1 has its top two bits set (a common "active + high-priority/kind"
 * encoding in these records) and 0x01 marks the record live; the routine writes them
 * unconditionally, so it always drives the record into this one fixed starting state.
 *
 * LIVE-OUT: in memory, the counter at (HL) is one lower (8-bit wrap: 0x00 -> 0xff) and the
 * record has its two control bytes stamped.  In registers, A holds the byte just sampled
 * from (BC), and the Z flag is set exactly when the decremented counter reached 0 — the
 * caller branches on that Z to detect "that was the last one".
 */
export function stampObjectAndDecCounter(m, record = m.regs.ix, counterPtr = m.regs.hl, sourcePtr = m.regs.bc) {
  const { mem8 } = m;

  // Sample the control byte the caller pointed BC at.  It is only READ here — this routine
  // does not act on it; it hands the value back so the caller can inspect it after the stamp.
  const a = mem8[sourcePtr];

  // Read-modify-write the shared population counter DOWN by one, in place, 8-bit (so 0x00
  // wraps to 0xff).  This is the counter whose zero-crossing tells the caller the run of
  // objects is exhausted.
  const counter = (mem8[counterPtr] - 1) & 0xff;
  mem8[counterPtr] = counter;

  // Stamp the record's two fixed control fields into their "freshly activated" state:
  // +0x13 := 0x01 (record live) and +0x16 := 0xc1 (active, high bits set).  Always written.
  const base = record;
  mem8[base + 0x13] = 0x01; // stamp the two object state bytes
  mem8[base + 0x16] = 0xc1;

  // Expose A (the sampled byte) and the Z flag (counter reached 0) for the caller's branch.
  return { a: (m.regs.a = a), counter: ((m.regs.fZ = counter === 0), counter) };
}
