// SPDX-License-Identifier: GPL-3.0-only
// loc_df6c  (ROM 0xdf6c-0xdf72) -- A|=0x70 -> X (the $70 header byte), A=Y, jmp $df57 (emit the {A,X} word).
export function loc_df6c(m) {
  const { regs, mem } = m;
  regs.ora(0x70); m.step(0xdf6e, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xdf6f, 2);
  regs.a = regs.y; regs.setNZ(regs.a); m.step(0xdf70, 2);
  m.step(0xdf57, 3); return m.call(0xdf57);
}
