// SPDX-License-Identifier: GPL-3.0-only

// loc_075d  (ROM 0x075d-0x0778) -- fill tile-attribute columns (page 0x8000) from the
// per-column source at BC: column l=0x40..0x5e gets one byte down 30 rows (DE=0x20), BC
// advancing per column; stops when (l & 0x1f) == 0x1f. Control flow is data-agnostic.
export function loc_075d(m) {
  const { regs, mem } = m;

  regs.hl = 0x8040;
  m.step(0x0760, 10); // 075d  ld hl,0x8040
  regs.de = 0x0020;
  m.step(0x0763, 10); // 0760  ld de,0x0020

  for (;;) {
    for (;;) {
      // 0763  inner: one byte written down the column until h >= 0x84
      regs.a = mem.read8(regs.bc);
      m.step(0x0764, 7);
      mem.write8(regs.hl, regs.a);
      m.step(0x0765, 7);
      regs.addHl(regs.de);
      m.step(0x0766, 11);
      regs.a = regs.h;
      m.step(0x0767, 4);
      regs.cp(0x84);
      m.step(0x0769, 7);
      if (regs.fC) {
        m.step(0x0763, 12); // 0769  jr c (taken -> next row)
        continue;
      }
      m.step(0x076b, 7); // 0769  jr c (not taken -> column done)
      break;
    }
    regs.h = 0x80;
    m.step(0x076d, 7); // 076b  ld h,0x80
    regs.l = regs.set(6, regs.l);
    m.step(0x076f, 8); // 076d  set 6,l
    regs.bc = (regs.bc + 1) & 0xffff;
    m.step(0x0770, 6); // 076f  inc bc -> next column source
    regs.l = regs.inc8(regs.l);
    m.step(0x0771, 4);
    regs.a = regs.l;
    m.step(0x0772, 4);
    regs.and(0x1f);
    m.step(0x0774, 7);
    regs.cp(0x1f);
    m.step(0x0776, 7);
    if (regs.fC) {
      m.step(0x0763, 12); // 0776  jr c (taken -> next column)
      continue;
    }
    m.step(0x0778, 7);
    break;
  }
  m.ret(); // 0778  ret
}
