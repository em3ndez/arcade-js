// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceToNextObject — the per-object update loop's shared tail: advance both scan cursors by one
 * record (the object-record cursor by its 16-byte stride, the paired sprite/animation cursor by 4)
 * and leave 4 in de as the loop's step scratch. Writes no memory; the loop consumes the cursors
 * and count from registers on its next pass.
 *
 * LIVE-OUT: registers, NOT memory — the two advanced cursors, the preserved count, and the
 * leftover step value.
 */

export function advanceToNextObject(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { regs } = m;

  regs.ix = ix + 16;
  regs.iy = iy + 4;

  regs.de = 4;
}
