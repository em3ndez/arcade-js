// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_09ee  (ROM 0x09EE–0x09FD).
 *
 *   09ee  3e 02        ld   a,0x02
 *   09f0  32 e0 74     ld   (0x74e0),a
 *   09f3  3e 25        ld   a,0x25
 *   09f5  32 c0 74     ld   (0x74c0),a
 *   09f8  3e 20        ld   a,0x20
 *   09fa  32 a0 74     ld   (0x74a0),a
 *   09fd  c9           ret
 *
 * Three video RAM stores 0x20 apart -- one tilemap column, three rows apart
 * in the rotated layout. Called from two places (0x07A0 conditionally, and
 * 0x0A2E unconditionally), so it is a shared drawing fragment rather than
 * part of either caller.
 */
export function sub_09ee(m) {
  const { regs, mem } = m;

  regs.a = 0x02;
  m.step(0x09f0, 7);
  mem.write8(0x74e0, regs.a);
  m.step(0x09f3, 13);
  regs.a = 0x25;
  m.step(0x09f5, 7);
  mem.write8(0x74c0, regs.a);
  m.step(0x09f8, 13);
  regs.a = 0x20;
  m.step(0x09fa, 7);
  mem.write8(0x74a0, regs.a);
  m.step(0x09fd, 13);
  m.ret();
}
