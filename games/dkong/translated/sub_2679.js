// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_2679  (ROM 0x2679–0x26A6) — sub_25f2's 3rd callee: even-frame 0x62A5 countdown (call 0x26de), publish 0x62A6->0x63A6 (0x26e9), every 32nd frame call 0x26a6.
 */
export function sub_2679(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x601a);
  m.step(0x267c, 13);
  regs.rrca();
  m.step(0x267d, 4);
  if (regs.fC) { m.step(0x268d, 10); return m.call(0x268d); } // odd frame
  m.step(0x2680, 10);
  regs.hl = 0x62a5;
  m.step(0x2683, 10);
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x2684, 11); // dec (0x62A5)
  if (regs.fNZ) { m.step(0x268d, 10); return m.call(0x268d); }
  m.step(0x2687, 10);
  mem.write8(regs.hl, 0xff);
  m.step(0x2689, 10); // reload
  regs.l = regs.inc8(regs.l);
  m.step(0x268a, 4); // -> 0x62A6
  m.push16(0x268d); m.step(0x26de, 17); m.call(0x26de); // call 0x26de
  return m.call(0x268d);
}
