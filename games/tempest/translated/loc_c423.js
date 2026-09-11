// SPDX-License-Identifier: GPL-3.0-only
// loc_c423  (ROM 0xc423-0xc43b) -- copies four $03xx,x table cells into $61-$64, then jmp $c3ba (tail).
export function loc_c423(m) {
  const { regs, mem } = m;
  regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xc425, 3);
  regs.a = mem.read8((0x032a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc428, 4);
  mem.write8(0x61, regs.a); m.step(0xc42a, 3);
  regs.a = mem.read8((0x031a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc42d, 4);
  mem.write8(0x62, regs.a); m.step(0xc42f, 3);
  regs.a = mem.read8((0x034a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc432, 4);
  mem.write8(0x63, regs.a); m.step(0xc434, 3);
  regs.a = mem.read8((0x033a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc437, 4);
  mem.write8(0x64, regs.a); m.step(0xc439, 3);
  m.step(0xc3ba, 3); return m.call(0xc3ba);
}
