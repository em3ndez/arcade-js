// SPDX-License-Identifier: GPL-3.0-only
// loc_b7eb  (ROM 0xb7eb-0xb829) -- loads $56/$58 from tables $0435/$0445,Y (Y=$29), jsr $c098, jsr $c765
// (X=0x61). Counts down $013c; on wrap bumps $013b and reloads $013c from table $b82a,x. If $b83d,x>=0
// jsr $b84e. Then Y=(($013b<<1)+0x28), loads X/A from $cec9/$cec8,y and JMP $df57 (tail).
export function loc_b7eb(m) {
  const { regs, mem } = m;
  regs.y = mem.read8(0x29); regs.setNZ(regs.y); m.step(0xb7ed, 3);
  { const a = (0x0435 + regs.y) & 0xffff;
    regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb7f0, 4 + ((0x0435 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
  mem.write8(0x56, regs.a); m.step(0xb7f2, 3);
  { const a = (0x0445 + regs.y) & 0xffff;
    regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb7f5, 4 + ((0x0445 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
  mem.write8(0x58, regs.a); m.step(0xb7f7, 3);
  m.push16(0xb7f9); m.step(0xb7fa, 6); m.call(0xc098);
  regs.x = 0x61; regs.setNZ(regs.x); m.step(0xb7fc, 2);
  m.push16(0xb7fe); m.step(0xb7ff, 6); m.call(0xc765);
  regs.x = mem.read8(0x013b); regs.setNZ(regs.x); m.step(0xb802, 4);
  { const dv = (mem.read8(0x013c) - 1) & 0xff; mem.write8(0x013c, dv); regs.setNZ(dv); m.step(0xb805, 6); }
  if (regs.fNZ) {
    m.step(0xb811, 3);
  } else {
    m.step(0xb807, 2);
    regs.x = (regs.x + 1) & 0xff; regs.setNZ(regs.x); m.step(0xb808, 2);
    mem.write8(0x013b, regs.x); m.step(0xb80b, 4);
    { const a = (0xb82a + regs.x) & 0xffff;
      regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb80e, 4 + ((0xb82a & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
    mem.write8(0x013c, regs.a); m.step(0xb811, 4);
  }
  { const a = (0xb83d + regs.x) & 0xffff;
    regs.y = mem.read8(a); regs.setNZ(regs.y); m.step(0xb814, 4 + ((0xb83d & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
  if (regs.fN) {
    m.step(0xb819, 3);
  } else {
    m.step(0xb816, 2);
    m.push16(0xb818); m.step(0xb819, 6); m.call(0xb84e);
  }
  regs.a = mem.read8(0x013b); regs.setNZ(regs.a); m.step(0xb81c, 4);
  regs.a = regs.asl(regs.a); m.step(0xb81d, 2);
  regs.clc(); m.step(0xb81e, 2);
  regs.adc(0x28); m.step(0xb820, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb821, 2);
  { const a = (0xcec9 + regs.y) & 0xffff;
    regs.x = mem.read8(a); regs.setNZ(regs.x); m.step(0xb824, 4 + ((0xcec9 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
  { const a = (0xcec8 + regs.y) & 0xffff;
    regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb827, 4 + ((0xcec8 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
  m.step(0xdf57, 3); return m.call(0xdf57);
}
