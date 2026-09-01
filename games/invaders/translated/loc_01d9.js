// SPDX-License-Identifier: GPL-3.0-only
// loc_01d9  (ROM 0x01d9-0x01e3) -- called from 0x01ae/0x186e. With HL pointing just before a
// 4-byte record, loads B from [HL+1], then adds C into [HL+2] and B into [HL+3] (a two-byte
// accumulate of the C,B pair into the record's running totals).
export function loc_01d9(m) {
  const { regs, mem } = m;

  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x01da, 5);
  regs.b = mem.read8(regs.hl); m.step(0x01db, 7); // 01da  mov b,m
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x01dc, 5);
  regs.a = regs.c; m.step(0x01dd, 5);
  regs.add(mem.read8(regs.hl)); m.step(0x01de, 7); // 01dd  add m
  mem.write8(regs.hl, regs.a); m.step(0x01df, 7); // 01de  mov m,a
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x01e0, 5);
  regs.a = regs.b; m.step(0x01e1, 5);
  regs.add(mem.read8(regs.hl)); m.step(0x01e2, 7); // 01e1  add m
  mem.write8(regs.hl, regs.a); m.step(0x01e3, 7); // 01e2  mov m,a
  return m.ret(10); // 01e3  ret
}
