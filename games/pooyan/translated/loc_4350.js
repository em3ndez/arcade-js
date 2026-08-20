// SPDX-License-Identifier: GPL-3.0-only

// loc_4350  (ROM 0x4350-0x4361) -- object state handler: tick loc_4006, count down the (ix+0x11)
// phase timer and return until it lapses, then step (ix+0x02) and re-arm the animation script via
// loc_4221's shared tails -- 0x425c (script 0x4203) when (ix+0x08) bit0 is clear, else 0x423a
// (script 0x4212). 0x425c and 0x423a are interior labels of loc_4221 reached here by an external
// jp -> flagged as boundaries (the merge registers them or splits loc_4221).
export function loc_4350(m) {
  const { regs, mem } = m;

  m.push16(0x4353);
  m.step(0x4006, 17);                    // 4350  call 0x4006
  m.call(0x4006);
  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x4356, 23); // 4353  dec (ix+0x11)
  if (regs.fNZ) { return m.ret(11); }    // 4356  ret nz (timer still running)
  m.step(0x4357, 5);
  regs.decMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x435a, 23); // 4357  dec (ix+0x02)
  regs.bit(0, mem.read8((regs.ix + 0x08) & 0xffff), ((regs.ix + 0x08) >> 8) & 0xff);
  m.step(0x435e, 20);                    // 435a  bit 0,(ix+0x08)
  if (regs.fZ) {                         // 435e  jp z,0x425c
    m.step(0x425c, 10);
    return m.call(0x425c);               // BOUNDARY (loc_4221 interior)
  }
  m.step(0x4361, 10);                    // jp z not taken
  m.step(0x423a, 10);                    // 4361  jp 0x423a
  return m.call(0x423a);                 // BOUNDARY (loc_4221 interior)
}
