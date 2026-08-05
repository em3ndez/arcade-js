// SPDX-License-Identifier: GPL-3.0-only

// loc_0f8d  (ROM 0x0F8D-0x0F96, Time Pilot)
export function loc_0f8d(m) {
  const { regs } = m;

  regs.af = m.pop16();
  m.step(0x0f8e, 10); // pop af

  regs.bc = 0x02f1;
  m.step(0x0f91, 10); // ld bc,0x02f1

  regs.af = m.pop16();
  m.step(0x0f92, 10); // pop af

  regs.bc = (regs.bc + 1) & 0xffff;
  m.step(0x0f93, 6); // inc bc -- 16-bit inc sets no flags

  regs.af = m.pop16();
  m.step(0x0f94, 10); // pop af

  regs.b = regs.inc8(regs.b);
  m.step(0x0f95, 4); // inc b

  regs.af = m.pop16();
  m.step(0x0f96, 10); // pop af

  regs.b = regs.dec8(regs.b);
  m.step(0x0f97, 4); // dec b

  return m.call(0x0f97);
}
