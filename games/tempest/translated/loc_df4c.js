// SPDX-License-Identifier: GPL-3.0-only
// loc_df4c  (ROM 0xdf4c-0xdf52) -- A|=0x60 -> X (the $60 header byte), A=Y, jmp $df57 (emit the {A,X} word).
export function loc_df4c(m) {
  const { regs, mem } = m;
  regs.ora(0x60); m.step(0xdf4e, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xdf4f, 2);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xdf50, 2);
  m.step(0xdf57, 3); return m.call(0xdf57);
}
