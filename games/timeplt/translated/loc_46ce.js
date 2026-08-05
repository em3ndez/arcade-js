// SPDX-License-Identifier: GPL-3.0-only

// loc_46ce  (ROM 0x46CE-0x46DA, Time Pilot)
export function loc_46ce(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;

  mem.write8(X(0x0c), regs.d);
  m.step(0x46d1, 19); // ld (ix+0x0c),d
  mem.write8(X(0x0d), regs.e);
  m.step(0x46d4, 19); // ld (ix+0x0d),e
  mem.write8(X(0x1c), regs.b);
  m.step(0x46d7, 19); // ld (ix+0x1c),b
  mem.write8(X(0x1d), regs.c);
  m.step(0x46da, 19); // ld (ix+0x1d),c
  m.ret(10); // 46da  ret
}
