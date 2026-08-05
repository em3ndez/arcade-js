// SPDX-License-Identifier: GPL-3.0-only

// loc_172a  (ROM 0x172A-0x1733)
export function loc_172a(m) {
  const { regs, mem } = m;

  regs.a = 0x03;
  m.step(0x172c, 7); // 172a  ld a,0x03
  mem.write8(0xa9ab, regs.a);
  m.step(0x172f, 13); // 172c  ld (0xa9ab),a
  regs.xor(regs.a);
  m.step(0x1730, 4); // 172f  xor a
  mem.write8(0xa9ac, regs.a);
  m.step(0x1733, 13); // 1730  ld (0xa9ac),a

  m.ret(10); // 1733  ret
}
