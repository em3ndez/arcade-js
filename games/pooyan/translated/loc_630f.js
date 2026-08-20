// SPDX-License-Identifier: GPL-3.0-only

// loc_630f  (ROM 0x630f-0x6342) -- bounding-box proximity test between the actor at IX and the
// target at IY (entered via jp z from loc_61b4). E biases IX.x by +6 (0x881f set) or -2 (clear);
// |IX.x+E - IY.x| and |(IY.y+8) - (IX.y+8)| are each tested < 5. Either axis out of range ->
// tail jp 0x60f2 (miss); both within -> tail jp 0x60d9 (hit). No frame of its own (all tail jps).
export function loc_630f(m) {
  const { regs, mem } = m;

  regs.e = 0x06;                                  m.step(0x6311, 7);
  regs.a = mem.read8(0x881f);                      m.step(0x6314, 13);
  regs.and(regs.a);                                m.step(0x6315, 4);
  if (regs.fNZ) {
    m.step(0x6319, 12);                            // jr nz,0x6319 -- keep +6 bias
  } else {
    m.step(0x6317, 7);
    regs.e = 0xfe;                                 m.step(0x6319, 7);  // bias -2
  }
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);   m.step(0x631c, 19);
  regs.add(regs.e);                                m.step(0x631d, 4);
  regs.e = regs.a;                                 m.step(0x631e, 4);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff);   m.step(0x6321, 19);
  regs.add(0x08);                                  m.step(0x6323, 7);
  regs.d = regs.a;                                 m.step(0x6324, 4);
  regs.a = mem.read8((regs.iy + 0x00) & 0xffff);   m.step(0x6327, 19);
  regs.sub(regs.e);                                m.step(0x6328, 4);
  if (regs.fNC) {
    m.step(0x632c, 12);                            // jr nc,0x632c
  } else {
    m.step(0x632a, 7);
    regs.neg();                                    m.step(0x632c, 8);  // -> |dx|
  }
  regs.cp(0x05);                                   m.step(0x632e, 7);
  if (regs.fNC) { m.step(0x60f2, 10); return m.call(0x60f2); }  // jp nc,0x60f2 -- dx>=5 miss

  m.step(0x6331, 10);                              // jp nc not taken
  regs.a = mem.read8((regs.iy + 0x02) & 0xffff);   m.step(0x6334, 19);
  regs.add(0x08);                                  m.step(0x6336, 7);
  regs.sub(regs.d);                                m.step(0x6337, 4);
  if (regs.fNC) {
    m.step(0x633b, 12);                            // jr nc,0x633b
  } else {
    m.step(0x6339, 7);
    regs.neg();                                    m.step(0x633b, 8);  // -> |dy|
  }
  regs.cp(0x05);                                   m.step(0x633d, 7);
  if (regs.fNC) { m.step(0x60f2, 10); return m.call(0x60f2); }  // jp nc,0x60f2 -- dy>=5 miss

  m.step(0x6340, 10);                              // jp nc not taken
  m.step(0x60d9, 10); return m.call(0x60d9);       // jp 0x60d9 -- both axes within range: hit
}
