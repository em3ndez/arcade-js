// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1e57  (ROM 0x1E57–0x1E6C).
 */
export function loc_1e57(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6227);
  m.step(0x1e5a, 13); // ld a,(0x6227)
  regs.bit(2, regs.a);
  m.step(0x1e5c, 8); // bit 2,a
  if (regs.fNZ) {
    m.step(0x1e80, 10); // jp nz,0x1e80
    return m.call(0x1e80);
  }
  m.step(0x1e5f, 10); // jp nz not taken
  regs.rra(); // bit 1 -> carry
  m.step(0x1e60, 4);
  regs.a = mem.read8(0x6205); // Y
  m.step(0x1e63, 13);
  if (regs.fC) {
    m.step(0x1e7a, 10); // jp c,0x1e7a
    return m.call(0x1e7a);
  }
  m.step(0x1e66, 10); // jp c not taken
  regs.cp(0x51);
  m.step(0x1e68, 7); // cp 0x51
  if (!regs.fC) {
    m.ret(11); // ret nc -- NORMAL return
    return true;
  }
  m.step(0x1e69, 5); // ret nc not taken
  regs.a = mem.read8(0x6203); // X
  m.step(0x1e6c, 13);
  regs.rla(); // X bit 7 -> carry
  m.step(0x1e6d, 4);
  return m.call(0x1e6d);
}
