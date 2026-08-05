// SPDX-License-Identifier: GPL-3.0-only

// loc_1651  (ROM 0x1651-0x1658)
export function loc_1651(m) {
  const { regs, mem } = m;

  regs.hl = 0x167b;
  m.step(0x1654, 10); // 1651  ld hl,0x167b
  m.push16(regs.hl);
  m.step(0x1655, 11); // 1654  push hl -- the arm's ret lands on 0x167B
  regs.a = mem.read8(0xa9ac);
  m.step(0x1658, 13); // 1655  ld a,(0xa9ac) -- the table index, unmasked

  m.push16(0x1659); // rst 0x30 pushes the address AFTER it -- the table base
  m.step(0x0030, 11); // 1658  rst 0x30
  m.call(0x0030, "0x1659 ((0xa9ac) sequence)"); // inline jump table dispatch

  return m.call(0x167b);
}
