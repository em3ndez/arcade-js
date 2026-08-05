// SPDX-License-Identifier: GPL-3.0-only

// loc_17fe  (ROM 0x17FE-0x1805)
export function loc_17fe(m) {
  const { regs, mem } = m;

  regs.hl = 0x181d;
  m.step(0x1801, 10); // 17fe  ld hl,0x181d
  m.push16(regs.hl);
  m.step(0x1802, 11); // 1801  push hl -- the arm's ret lands on 0x181D
  regs.a = mem.read8(0xa9ac);
  m.step(0x1805, 13); // 1802  ld a,(0xa9ac) -- the table index, unmasked

  m.push16(0x1806); // rst 0x30 pushes the address AFTER it -- the table base
  m.step(0x0030, 11); // 1805  rst 0x30
  m.call(0x0030, "0x1806 ((0xa9ac) sequence)"); // inline jump table dispatch

  return m.call(0x181d);
}
