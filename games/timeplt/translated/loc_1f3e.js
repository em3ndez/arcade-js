// SPDX-License-Identifier: GPL-3.0-only

// loc_1f3e  (ROM 0x1F3E-0x1F54, Time Pilot)
export function loc_1f3e(m) {
  const { regs, mem } = m;

  regs.a = regs.b;
  m.step(0x1f3f, 4); // ld a,b
  mem.write8(0xa802, regs.a);
  m.step(0x1f42, 13); // ld (0xa802),a

  return m.call(0x1f42);
}
