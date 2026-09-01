// SPDX-License-Identifier: GPL-3.0-only
// loc_08d8  (ROM 0x08d8-0x08e3) -- called from 0x0838. If the counter at 0x2082 is >= 9 it just
// returns (rnc); otherwise it seats 0x207e = 0xfb and returns.
export function loc_08d8(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2082); m.step(0x08db, 13); // 08d8  lda 0x2082
  regs.cp(0x09); m.step(0x08dd, 7); // 08db  cpi 0x09
  if (regs.fNC) { return m.ret(11); } // 08dd  rnc (taken: 0x2082 >= 9)
  m.step(0x08de, 5); // 08dd  rnc (not taken)
  regs.a = 0xfb; m.step(0x08e0, 7); // 08de  mvi a,0xfb
  mem.write8(0x207e, regs.a); m.step(0x08e3, 13); // 08e0  sta 0x207e
  return m.ret(10); // 08e3  ret
}
