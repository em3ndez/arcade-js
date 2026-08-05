// SPDX-License-Identifier: GPL-3.0-only

// loc_0f11  (ROM 0x0F11-0x0F19, Time Pilot)
export function loc_0f11(m) {
  const { regs, mem } = m;

  regs.hl = 0xa9ab;
  m.step(0x0f14, 10); // ld hl,0xa9ab

  regs.incMem8(mem, regs.hl);
  m.step(0x0f15, 11); // inc (hl) -- next outer state

  regs.xor(regs.a);
  m.step(0x0f16, 4); // xor a

  mem.write8(0xa9ac, regs.a);
  m.step(0x0f19, 13); // ld (0xa9ac),a -- sub-step back to 0

  m.ret(); // 0f19  ret
}
