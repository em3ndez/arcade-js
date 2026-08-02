// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_268d  (ROM 0x268D–0x26A2) — sub_2679 shared tail: 0x62A6->0x63A6 via 0x26e9; every 32nd frame call 0x26a6(0x69F4).
 */
export function loc_268d(m) {
  const { regs, mem } = m;
  regs.hl = 0x62a6;
  m.step(0x2690, 10);
  m.push16(0x2693); m.step(0x26e9, 17); m.call(0x26e9); // -> A
  mem.write8(0x63a6, regs.a);
  m.step(0x2696, 13);
  regs.a = mem.read8(0x601a);
  m.step(0x2699, 13);
  regs.and(0x1f);
  m.step(0x269b, 7);
  regs.cp(0x02);
  m.step(0x269d, 7);
  if (regs.fNZ) { m.ret(5); return; } // ret nz
  m.step(0x269e, 11);
  regs.de = 0x69f4;
  m.step(0x26a1, 10);
  regs.exDeHl();
  m.step(0x26a2, 4); // HL=0x69F4
  m.push16(0x26a5); m.step(0x26a6, 17); m.call(0x26a6); // call 0x26a6
  m.ret(10);
}
