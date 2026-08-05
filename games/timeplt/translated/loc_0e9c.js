// SPDX-License-Identifier: GPL-3.0-only

// loc_0e9c  (ROM 0x0e9c-0x0eab, Time Pilot)
export function loc_0e9c(m) {
  const { regs, mem } = m;

  regs.exDeHl();
  m.step(0x0e9d, 4); // 0e9c  ex de,hl

  regs.b = regs.inc8(regs.b);
  m.step(0x0e9e, 4); // 0e9d  inc b
  mem.write8(regs.hl, regs.b);
  m.step(0x0e9f, 7); // 0e9e  ld (hl),b
  regs.b = regs.dec8(regs.b);
  m.step(0x0ea0, 4); // 0e9f  dec b
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x0ea1, 6); // 0ea0  dec hl
  mem.write8(regs.hl, regs.b);
  m.step(0x0ea2, 7); // 0ea1  ld (hl),b

  regs.h = regs.res(2, regs.h); // no flags
  m.step(0x0ea4, 8); // 0ea2  res 2,h -- video RAM -> colour RAM

  mem.write8(regs.hl, regs.c);
  m.step(0x0ea5, 7); // 0ea4  ld (hl),c
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0ea6, 6); // 0ea5  inc hl
  mem.write8(regs.hl, regs.c);
  m.step(0x0ea7, 7); // 0ea6  ld (hl),c

  regs.h = regs.set(2, regs.h); // no flags
  m.step(0x0ea9, 8); // 0ea7  set 2,h -- back to video RAM

  regs.exDeHl();
  m.step(0x0eaa, 4); // 0ea9  ex de,hl

  m.push16(0x0eab);
  m.step(0x0028, 11); // 0eaa  rst 0x28 -- DE += 0x20; returns to 0x0eab
  m.call(0x0028);

  m.ret(); // 0eab  ret
}
