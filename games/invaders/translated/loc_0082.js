// SPDX-License-Identifier: GPL-3.0-only
// loc_0082  (ROM 0x0082-0x0087) -- shared interrupt epilogue, jmp'd to from loc_0010 (RST2)
// and loc_008c (RST1 body). Restores HL/DE/BC/PSW, re-enables interrupts, returns.
export function loc_0082(m) {
  const { regs } = m;

  regs.hl = m.pop16(); m.step(0x0083, 10); // 0082  pop h
  regs.de = m.pop16(); m.step(0x0084, 10); // 0083  pop d
  regs.bc = m.pop16(); m.step(0x0085, 10); // 0084  pop b
  regs.af = m.pop16(); m.step(0x0086, 10); // 0085  pop psw
  m.io.setInte(true); m.step(0x0087, 4); // 0086  ei
  return m.ret(10); // 0087  ret
}
