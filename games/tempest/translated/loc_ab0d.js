// SPDX-License-Identifier: GPL-3.0-only
// loc_ab0d  (ROM 0xab0d-0xab13) -- loads A=0x20, X=0x80, then jmp $df57 (tail-call).
export function loc_ab0d(m) {
  const { regs } = m;
  regs.a = 0x20; regs.setNZ(regs.a); m.step(0xab0f, 2);
  regs.x = 0x80; regs.setNZ(regs.x); m.step(0xab11, 2);
  m.step(0xdf57, 3); return m.call(0xdf57);
}
