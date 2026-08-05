// SPDX-License-Identifier: GPL-3.0-only

// loc_599d  (ROM 0x599D-0x59C4, Time Pilot)
export function loc_599d(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);
  m.step(0x59a0, 19); // ld a,(ix+0x02) -- the heading

  return m.call(0x59a0);
}
