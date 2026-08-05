// SPDX-License-Identifier: GPL-3.0-only

// loc_41ec  (ROM 0x41EC-0x41F0, Time Pilot)
export function loc_41ec(m) {
  const { regs, mem } = m;

  mem.write8((regs.ix + 0x04) & 0xffff, 0x00);
  m.step(0x41f0, 19); // ld (ix+0x04),0x00
  m.ret(10); // 41f0  ret
}
