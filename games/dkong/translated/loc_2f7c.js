// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2f7c  (ROM 0x2F7C–0x2F96) — THE RECORD WRITE (convergence): DE->HL, write x/B/C/y, mirror x/y to (ix+3)/(ix+5).
 */
export function loc_2f7c(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;
  regs.exDeHl();
  m.step(0x2f7d, 4); // ex de,hl -- HL = record dest
  regs.a = mem.read8(0x6203);
  m.step(0x2f80, 13); // ld a,(0x6203)
  regs.add(mem.read8(R(0x0e)));
  m.step(0x2f83, 19); // add a,(ix+0x0e)
  mem.write8(regs.hl, regs.a);
  m.step(0x2f84, 7); // ld (hl),a -- record[0] = X
  mem.write8(R(0x03), regs.a);
  m.step(0x2f87, 19); // ld (ix+0x03),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2f88, 6); // inc hl
  mem.write8(regs.hl, regs.b);
  m.step(0x2f89, 7); // ld (hl),b -- record[1] = B
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2f8a, 6); // inc hl
  mem.write8(regs.hl, regs.c);
  m.step(0x2f8b, 7); // ld (hl),c -- record[2] = C
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x2f8c, 6); // inc hl
  regs.a = mem.read8(0x6205);
  m.step(0x2f8f, 13); // ld a,(0x6205)
  regs.add(mem.read8(R(0x0f)));
  m.step(0x2f92, 19); // add a,(ix+0x0f)
  mem.write8(regs.hl, regs.a);
  m.step(0x2f93, 7); // ld (hl),a -- record[3] = Y
  mem.write8(R(0x05), regs.a);
  m.step(0x2f96, 19); // ld (ix+0x05),a
  m.ret(); // 0x2F96 (EXIT-1)
}
