// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_0030  (ROM 0x0030) — which is `jr 0x0044`
 *
 *   0030  18 12        jr   0x0044
 *   0044  21 27 62     ld   hl,0x6227
 *   0047  46           ld   b,(hl)
 *   0048  0f           rrca                  ; loc_0048
 *   0049  10 fd        djnz 0x0048
 *   004b  d8           ret  c
 *   004c  e1           pop  hl
 *   004d  c9           ret
 *
 * The `rst 0x30` helper. Rotates A right B times, where B is the value at
 * 0x6227, then returns normally if the resulting carry is set and skips the
 * caller otherwise -- so it selects a bit of A by an index held in RAM.
 * Returns true for a normal return.
 */
export function sub_0030(m) {
  const { regs, mem } = m;
  m.step(0x0044, 12); // jr 0x0044
  regs.hl = 0x6227;
  m.step(0x0047, 10);
  regs.b = mem.read8(regs.hl);
  m.step(0x0048, 7);
  do {
    regs.rrca();
    m.step(0x0049, 4);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x0048 : 0x004b, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);
  if (regs.fC) {
    m.ret(11);
    return true;
  }
  m.step(0x004c, 5);
  regs.hl = m.pop16(); // pop hl -- discards this routine's return address
  m.step(0x004d, 10);
  m.ret();
  return false;
}
