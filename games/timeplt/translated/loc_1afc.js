// SPDX-License-Identifier: GPL-3.0-only

// loc_1afc  (ROM 0x1AFC–0x1B03)
export function loc_1afc(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);
  m.step(0x1afd, 7); // ld a,(hl)
  mem.write8(regs.de, regs.a);
  m.step(0x1afe, 7); // ld (de),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1aff, 6); // inc de
  regs.h = regs.res(2, regs.h);
  m.step(0x1b01, 8); // res 2,h
  regs.a = mem.read8(regs.hl);
  m.step(0x1b02, 7); // ld a,(hl)
  mem.write8(regs.de, regs.a);
  m.step(0x1b03, 7); // ld (de),a

  m.ret(10); // ret (0x1B03)
}
