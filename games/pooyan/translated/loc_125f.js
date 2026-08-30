// SPDX-License-Identifier: GPL-3.0-only

// loc_125f  (ROM 0x125f-0x126f) -- countdown-driven state transition for the object at IX.
// Decrements the per-object timer (ix+0x11); while it is non-zero, ret's to the caller (no change).
// On the tick it reaches zero, it advances the object's phase field (ix+0x02), sets up DE=0x3838 and
// (ix+0x08)=1, then tail-jumps into 0x381e (its ret returns to loc_125f's caller).
export function loc_125f(m) {
  const { regs, mem } = m;

  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff);
  m.step(0x1262, 23); // 125f  dec (ix+0x11)

  if (regs.fNZ) {
    return m.ret(11); // 1262  ret nz -- timer not yet expired
  }
  m.step(0x1263, 5); // 1262  ret nz (not taken)

  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff);
  m.step(0x1266, 23); // 1263  inc (ix+0x02)

  regs.de = 0x3838;
  m.step(0x1269, 10); // 1266  ld de,0x3838

  mem.write8((regs.ix + 0x08) & 0xffff, 0x01);
  m.step(0x126d, 19); // 1269  ld (ix+0x08),0x01

  m.step(0x381e, 10); return m.call(0x381e); // 126d  jp 0x381e -- tail (its ret is ours)
}
