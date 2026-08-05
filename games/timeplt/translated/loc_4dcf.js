// SPDX-License-Identifier: GPL-3.0-only

// loc_4dcf  (ROM 0x4DCF-0x4DDD, Time Pilot)
export function loc_4dcf(m) {
  const { regs, mem } = m;

  regs.exDeHl();
  m.step(0x4dd0, 4); // ex de,hl
  mem.write8(regs.hl, regs.b);
  m.step(0x4dd1, 7); // ld (hl),b
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x4dd2, 6); // dec hl -- 16-bit, no flags
  mem.write8(regs.hl, 0xf1);
  m.step(0x4dd4, 10); // ld (hl),0xf1
  regs.h = regs.res(2, regs.h);
  m.step(0x4dd6, 8); // res 2,h -- no flags
  mem.write8(regs.hl, regs.c);
  m.step(0x4dd7, 7); // ld (hl),c
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4dd8, 6); // inc hl -- 16-bit, no flags
  mem.write8(regs.hl, regs.c);
  m.step(0x4dd9, 7); // ld (hl),c
  regs.h = regs.set(2, regs.h);
  m.step(0x4ddb, 8); // set 2,h -- no flags
  regs.exDeHl();
  m.step(0x4ddc, 4); // ex de,hl
  m.push16(0x4ddd);
  m.step(0x0020, 11); // rst 0x20 -- DE -= 0x20
  m.call(0x0020);

  m.ret(); // 4ddd  ret
}
