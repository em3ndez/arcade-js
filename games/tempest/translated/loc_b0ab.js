// SPDX-License-Identifier: GPL-3.0-only
// loc_b0ab  (ROM 0xb0ab-0xb0c5) -- reads $0200, calls adce, clamps A to [0..$0127], writes back to $0200 and Y.
export function loc_b0ab(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0200); regs.setNZ(regs.a); m.step(0xb0ae, 4);
  m.push16(0xb0b0); m.step(0xb0b1, 6); m.call(0xadce);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb0b2, 2);
  if (!regs.fN) {
    m.step(0xb0b9, 3);
    regs.cmp(mem.read8(0x0127)); m.step(0xb0bc, 4);
    if (regs.fNC) {
      m.step(0xb0c1, 3);
    } else {
      m.step(0xb0be, 2);
      regs.a = mem.read8(0x0127); regs.setNZ(regs.a); m.step(0xb0c1, 4);
    }
  } else {
    m.step(0xb0b4, 2);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xb0b6, 2);
    regs.clv(); m.step(0xb0b7, 2);
    m.step(0xb0c1, 3);
  }
  mem.write8(0x0200, regs.a); m.step(0xb0c4, 4);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb0c5, 2);
  return m.ret(6);
}
