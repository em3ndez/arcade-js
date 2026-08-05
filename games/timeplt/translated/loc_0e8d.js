// SPDX-License-Identifier: GPL-3.0-only

// loc_0e8d  (ROM 0x0e8d-0x0e9b, Time Pilot)
export function loc_0e8d(m) {
  const { regs, mem } = m;

  regs.exDeHl();
  m.step(0x0e8e, 4); // 0e8d  ex de,hl

  mem.write8(regs.hl, regs.b);
  m.step(0x0e8f, 7); // 0e8e  ld (hl),b

  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x0e90, 6); // 0e8f  dec hl

  mem.write8(regs.hl, 0xf1);
  m.step(0x0e92, 10); // 0e90  ld (hl),0xf1

  regs.h = regs.res(2, regs.h); // no flags
  m.step(0x0e94, 8); // 0e92  res 2,h -- video RAM -> colour RAM

  mem.write8(regs.hl, regs.c);
  m.step(0x0e95, 7); // 0e94  ld (hl),c

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0e96, 6); // 0e95  inc hl

  mem.write8(regs.hl, regs.c);
  m.step(0x0e97, 7); // 0e96  ld (hl),c

  regs.h = regs.set(2, regs.h); // no flags
  m.step(0x0e99, 8); // 0e97  set 2,h -- back to video RAM

  regs.exDeHl();
  m.step(0x0e9a, 4); // 0e99  ex de,hl

  m.push16(0x0e9b);
  m.step(0x0028, 11); // 0e9a  rst 0x28 -- DE += 0x20; returns to 0x0e9b
  m.call(0x0028);

  m.ret(); // 0e9b  ret
}
