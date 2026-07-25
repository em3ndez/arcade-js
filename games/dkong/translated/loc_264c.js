// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_264c  (ROM 0x264C–0x266E) — sub_262f shared tail.
 */
export function loc_264c(m) {
  const { regs, mem } = m;
  regs.hl = 0x62a3;
  m.step(0x264f, 10);
  m.push16(0x2652); m.step(0x26e9, 17); m.call(0x26e9); // -> A
  mem.write8(0x63a5, regs.a);
  m.step(0x2655, 13); // 0x63A5 = +val
  regs.neg();
  m.step(0x2657, 8);
  mem.write8(0x63a4, regs.a);
  m.step(0x265a, 13); // 0x63A4 = -val
  regs.a = mem.read8(0x601a);
  m.step(0x265d, 13);
  regs.and(0x1f);
  m.step(0x265f, 7);
  if (regs.fNZ) { m.ret(11); return; } // ret nz
  m.step(0x2660, 5);
  regs.l = (regs.l - 1) & 0xff;
  m.step(0x2661, 4); // -> 0x62A2
  regs.de = 0x69ec;
  m.step(0x2664, 10);
  regs.exDeHl();
  m.step(0x2665, 4);
  m.push16(0x2668); m.step(0x26a6, 17); m.call(0x26a6); // call 0x26a6 -> A
  regs.and(0x7f);
  m.step(0x266a, 7);
  regs.hl = 0x69ed;
  m.step(0x266d, 10);
  mem.write8(regs.hl, regs.a);
  m.step(0x266e, 10); // 0x69ED = A & 0x7F
  m.ret(10);
}
