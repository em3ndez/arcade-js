// SPDX-License-Identifier: GPL-3.0-only

// loc_2856  (ROM 0x2856-0x286C) — when (0x83FE)==2, zero the dive-state bytes
// (0x814F)(0x814E)(0x8145)(0x8146)(0x8147); otherwise return without touching them.
export function loc_2856(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83fe);
  m.step(0x2859, 13); // ld a,(0x83fe) -- the play/mode flag
  regs.cp(0x02);
  m.step(0x285b, 7); // cp 0x02
  if (regs.fNZ) {
    m.ret(11); // ret nz (taken) -- not mode 2
    return;
  }
  m.step(0x285c, 5);
  regs.xor(regs.a);
  m.step(0x285d, 4); // A = 0
  mem.write8(0x814f, regs.a);
  m.step(0x2860, 13);
  mem.write8(0x814e, regs.a);
  m.step(0x2863, 13);
  mem.write8(0x8145, regs.a);
  m.step(0x2866, 13);
  mem.write8(0x8146, regs.a);
  m.step(0x2869, 13);
  mem.write8(0x8147, regs.a);
  m.step(0x286c, 13);
  m.ret();
}
