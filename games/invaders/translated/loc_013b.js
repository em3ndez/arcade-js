// SPDX-License-Identifier: GPL-3.0-only
// loc_013b  (ROM 0x013b-0x0140) -- DE := DE + 0x0030 (computed through HL), bumping the sprite
// pointer to the second bank; called via `cnz 0x013b` from loc_0100.
export function loc_013b(m) {
  const { regs } = m;

  regs.hl = 0x0030; m.step(0x013e, 10); // 013b  lxi h,0x0030
  regs.addHl(regs.de); m.step(0x013f, 10); // 013e  dad d
  regs.exDeHl(); m.step(0x0140, 4); // 013f  xchg
  return m.ret(10); // 0140  ret
}
