// SPDX-License-Identifier: GPL-3.0-only

// loc_418b  (ROM 0x418B-0x4193, Time Pilot)
export function loc_418b(m) {
  const { regs, mem } = m;

  m.push16(0x418e);
  m.step(0x3e6c, 17); // call 0x3e6c
  m.call(0x3e6c);

  regs.decMem8(mem, (regs.ix + 0x0e) & 0xffff);
  m.step(0x4191, 23); // dec (ix+0x0e)

  m.step(0x410b, 10); // jp 0x410b -- tail-jump; its ret returns to OUR caller
  return m.call(0x410b);
}
