// SPDX-License-Identifier: GPL-3.0-only
// loc_079b  (ROM 0x079b-0x07f8) -- reached by `jmp 0x079b` at 0x086f and fallen into from
// loc_0798. Adjusts the credit tally at 0x20eb by B in BCD (daa), seeds score/HUD RAM cells and
// the two per-player sprite records (0x21fc/0x22fc etc.), runs the init subroutines, then falls
// through into loc_07f9. Comments are sparse; each m.step landing address carries the flow.
export function loc_079b(m) {
  const { regs, mem } = m;

  mem.write8(0x20ce, regs.a); m.step(0x079e, 13);
  regs.a = mem.read8(0x20eb); m.step(0x07a1, 13);
  regs.add(regs.b); m.step(0x07a2, 4);
  regs.daa(); m.step(0x07a3, 4); // BCD-adjust the credit tally
  mem.write8(0x20eb, regs.a); m.step(0x07a6, 13);
  m.push16(0x07a9); m.step(0x1947, 17); m.call(0x1947);
  regs.hl = 0x0000; m.step(0x07ac, 10);
  mem.write16(0x20f8, regs.hl); m.step(0x07af, 16);
  mem.write16(0x20fc, regs.hl); m.step(0x07b2, 16);
  m.push16(0x07b5); m.step(0x1925, 17); m.call(0x1925);
  m.push16(0x07b8); m.step(0x192b, 17); m.call(0x192b);
  m.push16(0x07bb); m.step(0x19d7, 17); m.call(0x19d7);
  regs.hl = 0x0101; m.step(0x07be, 10);
  regs.a = regs.h; m.step(0x07bf, 5);
  mem.write8(0x20ef, regs.a); m.step(0x07c2, 13);
  mem.write16(0x20e7, regs.hl); m.step(0x07c5, 16);
  mem.write16(0x20e5, regs.hl); m.step(0x07c8, 16);
  m.push16(0x07cb); m.step(0x1956, 17); m.call(0x1956);
  m.push16(0x07ce); m.step(0x01ef, 17); m.call(0x01ef);
  m.push16(0x07d1); m.step(0x01f5, 17); m.call(0x01f5);
  m.push16(0x07d4); m.step(0x08d1, 17); m.call(0x08d1);
  mem.write8(0x21ff, regs.a); m.step(0x07d7, 13);
  mem.write8(0x22ff, regs.a); m.step(0x07da, 13);
  m.push16(0x07dd); m.step(0x00d7, 17); m.call(0x00d7);
  regs.xor(regs.a); m.step(0x07de, 4);
  mem.write8(0x21fe, regs.a); m.step(0x07e1, 13);
  mem.write8(0x22fe, regs.a); m.step(0x07e4, 13);
  m.push16(0x07e7); m.step(0x01c0, 17); m.call(0x01c0);
  m.push16(0x07ea); m.step(0x1904, 17); m.call(0x1904);
  regs.hl = 0x3878; m.step(0x07ed, 10);
  mem.write16(0x21fc, regs.hl); m.step(0x07f0, 16);
  mem.write16(0x22fc, regs.hl); m.step(0x07f3, 16);
  m.push16(0x07f6); m.step(0x01e4, 17); m.call(0x01e4);
  m.push16(0x07f9); m.step(0x1a7f, 17); m.call(0x1a7f);
  return m.call(0x07f9); // fall through into loc_07f9
}
