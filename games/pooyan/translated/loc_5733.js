// SPDX-License-Identifier: GPL-3.0-only

// loc_5733  (ROM 0x5733-0x57b3) -- spawn-an-actor entry (the body of loc_572b, entered directly
// without its "slot live?" prologue). Initialises the IX slot (state/timer/anim fields), computes
// a clamped, level-shifted column index in C (optionally biased via loc_57b4), looks up two byte
// tables via rst 0x20, sets the animation (loc_381e) and start-of-scan state (loc_57c3), then
// `pop af` discards its own return address and `ret`s ONE frame up (aborting the caller's loop).
export function loc_5733(m) {
  const { regs, mem } = m;

  regs.b = regs.c;                                 m.step(0x5734, 4);
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);     m.step(0x5738, 19);
  mem.write8((regs.ix + 0x02) & 0xffff, 0x03);     m.step(0x573c, 19);
  mem.write8((regs.ix + 0x04) & 0xffff, regs.e);   m.step(0x573f, 19);
  regs.xor(regs.a);                                m.step(0x5740, 4);
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a);   m.step(0x5743, 19);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a);   m.step(0x5746, 19);
  mem.write8((regs.ix + 0x06) & 0xffff, regs.a);   m.step(0x5749, 19);
  mem.write8((regs.ix + 0x08) & 0xffff, regs.a);   m.step(0x574c, 19);
  mem.write8((regs.ix + 0x07) & 0xffff, 0x01);     m.step(0x5750, 19);
  mem.write8((regs.ix + 0x0b) & 0xffff, regs.a);   m.step(0x5753, 19);

  regs.hl = 0x58e0;                                m.step(0x5756, 10);
  regs.a = mem.read8(0x8907);                      m.step(0x5759, 13);
  regs.and(0x01);                                  m.step(0x575b, 7);
  if (regs.fNZ) {
    m.step(0x5760, 12);                            // jr nz taken
  } else {
    m.step(0x575d, 7);
    regs.hl = 0x5902;                              m.step(0x5760, 10);
  }
  regs.a = mem.read8(0x8820);                      m.step(0x5763, 13);
  regs.cp(0x03);                                   m.step(0x5765, 7);
  if (regs.fC) {
    m.step(0x5769, 12);                            // jr c taken -- 0x8820 < 3
  } else {
    m.step(0x5767, 7);
    regs.a = 0x03;                                 m.step(0x5769, 7);
  }
  regs.c = regs.a;                                 m.step(0x576a, 4);
  regs.a = mem.read8(0x8908);                      m.step(0x576d, 13);
  regs.cp(0x04);                                   m.step(0x576f, 7);
  if (regs.fC) {
    m.step(0x5776, 12);                            // jr c taken -- skip the 0x8d4c bias
  } else {
    m.step(0x5771, 7);
    regs.a = mem.read8(0x8d4c);                    m.step(0x5774, 13);
    regs.add(regs.c);                              m.step(0x5775, 4);
    regs.c = regs.a;                               m.step(0x5776, 4);
  }
  regs.a = mem.read8(0x8907);                      m.step(0x5779, 13);
  regs.bit(0, regs.a);                             m.step(0x577b, 8);
  if (regs.fZ) {
    m.push16(0x577e);
    m.step(0x57b4, 17);                            // call z,0x57b4 taken
    m.call(0x57b4);
  } else {
    m.step(0x577e, 10);                            // call z not taken
  }
  regs.a = mem.read8(0x8907);                      m.step(0x5781, 13);
  regs.add(regs.c);                                m.step(0x5782, 4);
  regs.c = regs.a;                                 m.step(0x5783, 4);
  regs.cp(0x20);                                   m.step(0x5785, 7);
  if (regs.fC) {
    m.step(0x5789, 12);                            // jr c taken -- C < 0x20
  } else {
    m.step(0x5787, 7);
    regs.a = 0x1f;                                 m.step(0x5789, 7);
  }
  regs.c = regs.a;                                 m.step(0x578a, 4);

  m.push16(0x578b); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 -- A = table[HL+A]
  mem.write8((regs.ix + 0x09) & 0xffff, regs.a);   m.step(0x578e, 19);
  regs.neg();                                      m.step(0x5790, 8);
  mem.write8((regs.ix + 0x0a) & 0xffff, regs.a);   m.step(0x5793, 19);
  regs.de = 0x3829;                                m.step(0x5796, 10);
  m.push16(0x5799); m.step(0x381e, 17); m.call(0x381e); // set animation

  regs.hl = 0x589b;                                m.step(0x579c, 10);
  regs.a = mem.read8(0x8907);                      m.step(0x579f, 13);
  regs.and(0x01);                                  m.step(0x57a1, 7);
  if (regs.fNZ) {
    m.step(0x57a6, 12);                            // jr nz taken
  } else {
    m.step(0x57a3, 7);
    regs.hl = 0x58c0;                              m.step(0x57a6, 10);
  }
  regs.a = regs.c;                                 m.step(0x57a7, 4);
  m.push16(0x57a8); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 -- A = table[HL+A]
  mem.write8(0x8d07, regs.a);                      m.step(0x57ab, 13);
  regs.hl = 0x8d40;                                m.step(0x57ae, 10);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); m.step(0x57af, 11); // inc (0x8d40)
  m.push16(0x57b2); m.step(0x57c3, 17); m.call(0x57c3);

  regs.af = m.pop16();                             m.step(0x57b3, 10); // discard own return addr
  m.ret(10); // skip-return: aborts the caller's spawn loop (one actor per scan)
}
