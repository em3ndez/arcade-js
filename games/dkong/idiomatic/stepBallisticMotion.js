// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBallisticMotion — advance an airborne actor one frame along its ballistic arc.
 *
 * The actor is an object record the caller points at. Two of its fields are 16-bit
 * fixed-point coordinates (big-endian: high byte at the lower offset, fractional
 * low byte next), each with its own 16-bit signed per-frame velocity, plus a
 * one-byte "frames airborne" counter that drives a ramping gravity term:
 *
 *   +0x03:+0x04  coordinate A (horizontal)  += velocity A (+0x10:+0x11)
 *   +0x05:+0x06  coordinate B (vertical)    -= velocity B (+0x12:+0x13), then += gravity(t)
 *   +0x14        t = frames airborne        incremented after use
 *
 * gravity(t) = (2·t + 1)·8 = 16·t + 8 — the discrete integral of a constant
 * downward acceleration, so coordinate B follows a parabola: velocity B first
 * carries it one way (a jump rising: B decreases), the accumulating gravity term
 * overtakes it, and it falls back. Coordinate A just drifts at constant velocity.
 * The counter t is bumped every frame so the gravity term grows linearly.
 *
 * The same shape serves Mario and the airborne objects alike; nothing here depends on WHICH
 * record it is handed, because every access is relative to the pointer the caller sets and no
 * fixed address is referenced at all.
 *
 * A LEAF: it reads and writes only that record — five bytes written — and calls nothing.
 *
 * LIVE-OUT: memory (the five written bytes: the two coordinate halves of each of A and B, and the
 * airborne counter) plus the new coordinate-B value, which is handed back for the caller to test.
 */
export function stepBallisticMotion(m) {
  const { regs, mem } = m;
  const at = (d) => (regs.ix + d) & 0xffff;

  // Coordinate A += velocity A (16-bit, big-endian: hi at the lower offset).
  const posA = (mem.read8(at(0x03)) << 8) | mem.read8(at(0x04));
  const velA = (mem.read8(at(0x10)) << 8) | mem.read8(at(0x11));
  const newA = (posA + velA) & 0xffff;
  mem.write8(at(0x03), newA >> 8);
  mem.write8(at(0x04), newA & 0xff);

  // Coordinate B -= velocity B, then += the ramping gravity term.
  const posB = (mem.read8(at(0x05)) << 8) | mem.read8(at(0x06));
  const velB = (mem.read8(at(0x12)) << 8) | mem.read8(at(0x13));
  const t = mem.read8(at(0x14));        // frames airborne, read BEFORE the bump
  const gravity = 16 * t + 8;           // (2·t+1)·8; still fits 16 bits at the largest counter
  const newB = (posB - velB + gravity) & 0xffff;
  mem.write8(at(0x05), newB >> 8);
  mem.write8(at(0x06), newB & 0xff);
  mem.write8(at(0x14), (t + 1) & 0xff); // bump the airborne-frame counter

  // Hand the new coordinate-B value back; the caller tests its high half.
  regs.h = newB >> 8;
  regs.l = newB & 0xff;
}
