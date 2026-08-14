// SPDX-License-Identifier: GPL-3.0-only

// loc_07c1  (ROM 0x07C1-0x07CD) — start-flag helper: if (0x83fd)==1 delegate to loc_07ce, else set
// the start flag (0x825b)=1 and return. Reached from loc_0425 (loc_040b dispatcher).
export function loc_07c1(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fd);
  m.step(0x07c4, 13); // active player number
  regs.a = regs.dec8(regs.a);
  m.step(0x07c5, 4); // Z iff (0x83fd) == 1
  if (regs.fZ) {
    m.step(0x07ce, 10); // jp z,0x07ce
    return m.call(0x07ce);
  }
  m.step(0x07c8, 10);

  regs.a = 0x01;
  m.step(0x07ca, 7);
  mem.write8(0x825b, regs.a);
  m.step(0x07cd, 13); // (0x825b) = 1

  m.ret();
}
