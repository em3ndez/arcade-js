// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1783  (ROM 0x1783–0x178D) — scan 10 cells (HL stride DE); first non-zero -> jp 0x0026 CALLER-SKIP to grandparent; all clear -> ret. HL/DE/B live-in.
 */
export function loc_1783(m) {
  const { regs, mem } = m;
  regs.b = 0x0a;
  m.step(0x1785, 7);
  do {
    regs.a = mem.read8(regs.hl);
    m.step(0x1786, 7);
    regs.and(regs.a);
    m.step(0x1787, 4);
    if (regs.fNZ) {
      m.step(0x0026, 10); // jp 0x0026 -- caller-skip
      m.pop16(); // pop hl @0x0026 (discard loc_1783's return)
      m.step(0x0027, 10);
      m.ret(10); // ret -> grandparent
      return false; // SKIP -- caller must not continue
    }
    m.step(0x178a, 10);
    regs.addHl(regs.de);
    m.step(0x178b, 11); // add hl,de
    regs.djnz();
    m.step(regs.b ? 0x1785 : 0x178d, regs.b ? 13 : 8);
  } while (regs.b);
  m.ret(10); // all clear
  return true; // normal -- caller continues
}
