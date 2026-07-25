// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_16d5  (ROM 0x16D5–0x16DF) — call 0x2602, rst 0x38, ret.
 */
export function loc_16d5(m) {
  const { regs, mem } = m;
  m.push16(0x16d8); m.step(0x2602, 17); m.call(0x2602); // call 0x2602
  regs.a = mem.read8(0x63a3);
  m.step(0x16db, 13);
  regs.c = regs.a;
  m.step(0x16dc, 4);
  regs.hl = 0x6908;
  m.step(0x16df, 10);
  m.push16(0x16e0); m.step(0x0038, 11); m.call(0x0038); // rst 0x38
  m.ret(10);
}
