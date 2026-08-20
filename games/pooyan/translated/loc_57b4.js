// SPDX-License-Identifier: GPL-3.0-only

// loc_57b4  (ROM 0x57b4-0x57c2) -- clamp helper for the spawn-column index in C.
// Bails (C unchanged) when the level counter 0x8901 >= 3, or when 0x8d7d < 0x0c; otherwise
// adds (0x8d7d - 0x0c) into C. Pure leaf: no calls, no memory writes.
export function loc_57b4(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8901);  m.step(0x57b7, 13);
  regs.cp(0x03);               m.step(0x57b9, 7);
  if (regs.fNC) { return m.ret(11); } // ret nc -- 0x8901 >= 3
  m.step(0x57ba, 5);
  regs.a = mem.read8(0x8d7d);  m.step(0x57bd, 13);
  regs.sub(0x0c);              m.step(0x57bf, 7);
  if (regs.fC) { return m.ret(11); }  // ret c -- 0x8d7d < 0x0c
  m.step(0x57c0, 5);
  regs.add(regs.c);            m.step(0x57c1, 4);
  regs.c = regs.a;             m.step(0x57c2, 4);
  m.ret(10);
}
