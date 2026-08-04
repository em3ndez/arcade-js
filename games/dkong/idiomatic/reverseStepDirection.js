// SPDX-License-Identifier: GPL-3.0-only
/**
 * reverseStepDirection — reverse the travel direction of a timed sprite object by flipping the
 * sign of the one-byte signed step that steers it.
 *
 * The caller hands over a pointer to that step byte. Bit 7 of the byte is the direction: set
 * means the object is stepping one way, clear the other. The byte is rewritten to +2 when it was
 * negative and to -2 when it was not, so the sign always comes out opposite to what went in.
 *
 * The MAGNITUDE is always reset to 2 whatever it was, and no reader of the byte looks at it —
 * the readers take the sign alone, to choose which of two movement offsets to apply and which
 * way to publish the object's step. So the observable effect is a direction reversal and nothing
 * else, even when the incoming step had some other size.
 *
 * A LEAF: it calls nothing and touches exactly one byte — one read and one write, both at the
 * pointer it was handed. The callers reload a paired countdown around the call and read nothing
 * this routine leaves behind.
 *
 * LIVE-OUT: memory-only — the one byte at the caller's pointer.
 */
export function reverseStepDirection(m) {
  const { regs, mem } = m;
  const v = mem.read8(regs.hl);
  // bit 7 set (currently moving "negative") -> +2; else -> -2 (0xFE as a byte).
  // Reverses the direction; only the resulting sign is read downstream.
  mem.write8(regs.hl, (v & 0x80) ? 0x02 : 0xfe);
}
