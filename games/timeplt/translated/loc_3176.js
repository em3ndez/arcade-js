// SPDX-License-Identifier: GPL-3.0-only

// loc_3176  (ROM 0x3176-0x3180, Time Pilot)
export function loc_3176(m) {
  const { regs, mem } = m;

  regs.h = regs.b;
  m.step(0x3177, 4); // ld h,b
  regs.l = regs.b;
  m.step(0x3178, 4); // ld l,b
  regs.h = regs.c;
  m.step(0x3179, 4); // ld h,c
  regs.h = regs.b;
  m.step(0x317a, 4); // ld h,b
  regs.h = regs.c;
  m.step(0x317b, 4); // ld h,c
  regs.h = regs.d;
  m.step(0x317c, 4); // ld h,d
  regs.h = regs.e;
  m.step(0x317d, 4); // ld h,e
  regs.e = regs.h;
  m.step(0x317e, 4); // ld e,h
  mem.write8(regs.hl, regs.h);
  m.step(0x317f, 7); // ld (hl),h
  mem.write8(regs.hl, regs.l);
  m.step(0x3180, 7); // ld (hl),l

  throw new Error("Time Pilot: reached the halt at 0x3180 -- 0x3176 is a data table.");
}
