// SPDX-License-Identifier: GPL-3.0-only
// loc_1815  (ROM 0x1815-0x1833, interior loop loc_1828) -- called from 0x0b11. Prints a string
// (0x08f3), sets the 0x206c pace to 0x0a, then walks the 0x1dbe script via 0x1856: each entry is
// drawn by 0x1844 until 0x1856 flags carry (end), then delegates to loc_1837.
export function loc_1815(m) {
  const { regs, mem } = m;

  regs.hl = 0x2810; m.step(0x1818, 10); // 1815  lxi h,0x2810
  regs.de = 0x1ca3; m.step(0x181b, 10); // 1818  lxi d,0x1ca3
  regs.c = 0x15; m.step(0x181d, 7); // 181b  mvi c,0x15
  m.push16(0x1820); m.step(0x08f3, 17); m.call(0x08f3); // 181d  call 0x08f3
  regs.a = 0x0a; m.step(0x1822, 7); // 1820  mvi a,0x0a
  mem.write8(0x206c, regs.a); m.step(0x1825, 13); // 1822  sta 0x206c
  regs.bc = 0x1dbe; m.step(0x1828, 10); // 1825  lxi b,0x1dbe
  for (;;) { // loc_1828
    m.push16(0x182b); m.step(0x1856, 17); m.call(0x1856); // 1828  call 0x1856
    if (regs.fC) { m.step(0x1837, 10); return m.call(0x1837); } // 182b  jc 0x1837
    m.step(0x182e, 10);
    m.push16(0x1831); m.step(0x1844, 17); m.call(0x1844); // 182e  call 0x1844
    m.step(0x1828, 10); // 1831  jmp 0x1828 (loop)
  }
}
