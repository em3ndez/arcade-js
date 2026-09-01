// SPDX-License-Identifier: GPL-3.0-only
// loc_1947  (ROM 0x1947-0x194f) -- read 0x20eb into A, seat HL=0x3c01, then tail-jump into
// loc_09b2 -- delegate.
export function loc_1947(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x20eb); m.step(0x194a, 13); // 1947  lda 0x20eb
  regs.hl = 0x3c01; m.step(0x194d, 10); // 194a  lxi h,0x3c01
  m.step(0x09b2, 10); return m.call(0x09b2); // 194d  jmp 0x09b2
}
