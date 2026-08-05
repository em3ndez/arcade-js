// SPDX-License-Identifier: GPL-3.0-only

// loc_0f1f  (ROM 0x0F1F-0x0F28)
export function loc_0f1f(m) {
  const { regs, mem } = m;

  regs.hl = 0x0f54;
  m.step(0x0f22, 10); // ld hl,0x0f54
  m.push16(regs.hl);
  m.step(0x0f23, 11); // push hl -- the arm's ret lands on 0x0F54
  regs.a = mem.read8(0xa9ac);
  m.step(0x0f26, 13); // ld a,(0xa9ac)
  regs.and(0x0f);
  m.step(0x0f28, 7); // and 0x0f -- A is the table index

  m.push16(0x0f29); // rst 0x30 pushes the address AFTER it -- the table base
  m.step(0x0030, 11); // rst 0x30
  m.call(0x0030, "0x0f29 ((0xa9ac)&0x0f sequence)"); // inline jump table dispatch

  return m.call(0x0f54);
}
