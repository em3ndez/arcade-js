// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0a53  (ROM 0x0A53–0x0A62).
 *
 *   0a53  3e 01        ld   a,0x01
 *   0a55  32 40 77     ld   (0x7740),a
 *   0a58  3e 25        ld   a,0x25
 *   0a5a  32 20 77     ld   (0x7720),a
 *   0a5d  3e 20        ld   a,0x20
 *   0a5f  32 00 77     ld   (0x7700),a
 *   0a62  c9           ret
 *
 * Writes three fixed tiles one row apart (0x7740, 0x7720, 0x7700 -- 0x20
 * apart, one tilemap row) -- the same three cells sub_0315 maintains.
 */
export function loc_0a53(m) {
  const { regs, mem } = m;
  regs.a = 0x01;
  m.step(0x0a55, 7);
  mem.write8(0x7740, regs.a);
  m.step(0x0a58, 13);
  regs.a = 0x25;
  m.step(0x0a5a, 7);
  mem.write8(0x7720, regs.a);
  m.step(0x0a5d, 13);
  regs.a = 0x20;
  m.step(0x0a5f, 7);
  mem.write8(0x7700, regs.a);
  m.step(0x0a62, 13);
  m.ret();
}
