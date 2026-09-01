// SPDX-License-Identifier: GPL-3.0-only
// loc_0878  (ROM 0x0878-0x0882) -- called from 0x02f8. Loads B from 0x2008 and DE from the
// 16-bit word at 0x2009 (via lhld+xchg), then tail-jumps to loc_0886 to finish.
export function loc_0878(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x2008); m.step(0x087b, 13); // 0878  lda 0x2008
  regs.b = regs.a; m.step(0x087c, 5); // 087b  mov b,a
  regs.hl = mem.read16(0x2009); m.step(0x087f, 16); // 087c  lhld 0x2009
  regs.exDeHl(); m.step(0x0880, 4); // 087f  xchg
  m.step(0x0886, 10); return m.call(0x0886); // 0880  jmp 0x0886
}
