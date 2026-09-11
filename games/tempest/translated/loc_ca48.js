// SPDX-License-Identifier: GPL-3.0-only
// loc_ca48  (ROM 0xca48-0xca61) -- picks (A,Y) = (0,0x10) or (via $0117 & $3d) (0x04,0x08), then folds bit 2
// of A into $a1 (eor/and #$04/eor read-modify-write) and stores Y to $b4; rts.
export function loc_ca48(m) {
  const { regs, mem } = m;
  regs.y = 0x10; regs.setNZ(regs.y); m.step(0xca4a, 2);
  regs.a = mem.read8(0x0117); regs.setNZ(regs.a); m.step(0xca4d, 4);
  if (regs.fZ) {
    m.step(0xca57, 3);
  } else {
    m.step(0xca4f, 2);
    regs.a = mem.read8(0x3d); regs.setNZ(regs.a); m.step(0xca51, 3);
    if (regs.fZ) {
      m.step(0xca57, 3);
    } else {
      m.step(0xca53, 2);
      regs.a = 0x04; regs.setNZ(regs.a); m.step(0xca55, 2);
      regs.y = 0x08; regs.setNZ(regs.y); m.step(0xca57, 2);
    }
  }
  regs.eor(mem.read8(0xa1)); m.step(0xca59, 3);
  regs.and(0x04); m.step(0xca5b, 2);
  regs.eor(mem.read8(0xa1)); m.step(0xca5d, 3);
  mem.write8(0xa1, regs.a); m.step(0xca5f, 3);
  mem.write8(0xb4, regs.y); m.step(0xca61, 3);
  return m.ret(6);
}
