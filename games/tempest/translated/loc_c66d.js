// SPDX-License-Identifier: GPL-3.0-only
// loc_c66d  (ROM 0xc66d-0xc6c6) -- averages sprite-slot $38 with the next ($38+1 & 0x0f): 16-bit signed
// (>>1) of $036a/$035a[x]+[y] into $61/$62 and $038a/$037a[x]+[y] into $63/$64, then writes 4 bytes via
// ($74),y into the display list (masking $1f on the high bytes), mirrors them to $6a-$6d, updates $a9.
export function loc_c66d(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x38); regs.setNZ(regs.a); m.step(0xc66f, 3);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xc670, 2);
  regs.clc(); m.step(0xc671, 2);
  regs.adc(0x01); m.step(0xc673, 2);
  regs.and(0x0f); m.step(0xc675, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xc676, 2);
  regs.a = mem.read8((0x036a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc679, 4);
  regs.sec(); m.step(0xc67a, 2);
  regs.adc(mem.read8((0x036a + regs.y) & 0xffff)); m.step(0xc67d, 4);
  mem.write8(0x61, regs.a); m.step(0xc67f, 3);
  regs.a = mem.read8((0x035a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc682, 4);
  regs.adc(mem.read8((0x035a + regs.y) & 0xffff)); m.step(0xc685, 4);
  mem.write8(0x62, regs.a); m.step(0xc687, 3);
  regs.a = regs.asl(regs.a); m.step(0xc688, 2);
  mem.write8(0x62, regs.ror(mem.read8(0x62))); m.step(0xc68a, 5);
  mem.write8(0x61, regs.ror(mem.read8(0x61))); m.step(0xc68c, 5);
  regs.a = mem.read8((0x038a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc68f, 4);
  regs.sec(); m.step(0xc690, 2);
  regs.adc(mem.read8((0x038a + regs.y) & 0xffff)); m.step(0xc693, 4);
  mem.write8(0x63, regs.a); m.step(0xc695, 3);
  regs.a = mem.read8((0x037a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xc698, 4);
  regs.adc(mem.read8((0x037a + regs.y) & 0xffff)); m.step(0xc69b, 4);
  mem.write8(0x64, regs.a); m.step(0xc69d, 3);
  regs.a = regs.asl(regs.a); m.step(0xc69e, 2);
  mem.write8(0x64, regs.ror(mem.read8(0x64))); m.step(0xc6a0, 5);
  mem.write8(0x63, regs.ror(mem.read8(0x63))); m.step(0xc6a2, 5);
  regs.y = mem.read8(0xa9); regs.setNZ(regs.y); m.step(0xc6a4, 3);
  regs.a = mem.read8(0x63); regs.setNZ(regs.a); m.step(0xc6a6, 3);
  { const ptr = mem.read16(0x0074); mem.write8((ptr + regs.y) & 0xffff, regs.a); m.step(0xc6a8, 6); }
  regs.y = regs.inc8(regs.y); m.step(0xc6a9, 2);
  mem.write8(0x6c, regs.a); m.step(0xc6ab, 3);
  regs.a = mem.read8(0x64); regs.setNZ(regs.a); m.step(0xc6ad, 3);
  mem.write8(0x6d, regs.a); m.step(0xc6af, 3);
  regs.and(0x1f); m.step(0xc6b1, 2);
  { const ptr = mem.read16(0x0074); mem.write8((ptr + regs.y) & 0xffff, regs.a); m.step(0xc6b3, 6); }
  regs.y = regs.inc8(regs.y); m.step(0xc6b4, 2);
  regs.a = mem.read8(0x61); regs.setNZ(regs.a); m.step(0xc6b6, 3);
  { const ptr = mem.read16(0x0074); mem.write8((ptr + regs.y) & 0xffff, regs.a); m.step(0xc6b8, 6); }
  regs.y = regs.inc8(regs.y); m.step(0xc6b9, 2);
  mem.write8(0x6a, regs.a); m.step(0xc6bb, 3);
  regs.a = mem.read8(0x62); regs.setNZ(regs.a); m.step(0xc6bd, 3);
  mem.write8(0x6b, regs.a); m.step(0xc6bf, 3);
  regs.and(0x1f); m.step(0xc6c1, 2);
  { const ptr = mem.read16(0x0074); mem.write8((ptr + regs.y) & 0xffff, regs.a); m.step(0xc6c3, 6); }
  regs.y = regs.inc8(regs.y); m.step(0xc6c4, 2);
  mem.write8(0xa9, regs.y); m.step(0xc6c6, 3);
  return m.ret(6);
}
