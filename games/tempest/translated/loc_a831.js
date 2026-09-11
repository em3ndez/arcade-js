// SPDX-License-Identifier: GPL-3.0-only
// loc_a831  (ROM 0xa831-0xa839) -- clears $03aa and $0125 (both = 0), then returns.
export function loc_a831(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa833, 2);
  mem.write8(0x03aa, regs.a); m.step(0xa836, 4);
  mem.write8(0x0125, regs.a); m.step(0xa839, 4);
  return m.ret(6);
}
