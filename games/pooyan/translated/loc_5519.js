// SPDX-License-Identifier: GPL-3.0-only

// loc_5519  (ROM 0x5519-0x5543) -- spawn scheduler B. Gates on 0x8907 (>=2 skips the 0x8820 check;
// <2 requires 0x8820 >= 2 or returns). Decrements countdown 0x8d05; only when it reaches 0 reloads it
// from table 0x55ff indexed by 0x8d13&0x0f (via rst 0x20), advances that index, seeds IX=0x8c48 /
// DE=0x0018 (stride) / B=1, and falls through into the spawn loop loc_5544.
export function loc_5519(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8907);                  m.step(0x551c, 13);  // 5519  ld a,(0x8907)
  regs.cp(0x02);                               m.step(0x551e, 7);
  if (regs.fNC) {
    m.step(0x5526, 12);                                             // 551e  jr nc,0x5526 taken
  } else {
    m.step(0x5520, 7);
    regs.a = mem.read8(0x8820);                m.step(0x5523, 13);  // 5520  ld a,(0x8820)
    regs.cp(0x02);                             m.step(0x5525, 7);
    if (regs.fC) { return m.ret(11); }                             // 5525  ret c
    m.step(0x5526, 5);
  }

  // 5526: per-type spawn countdown -- proceed only when it hits zero
  regs.hl = 0x8d05;                            m.step(0x5529, 10);
  regs.decMem8(mem, regs.hl);                  m.step(0x552a, 11);  // 5529  dec (hl)
  if (regs.fNZ) { return m.ret(11); }                              // 552a  ret nz
  m.step(0x552b, 5);
  regs.hl = 0x55ff;                            m.step(0x552e, 10);
  regs.a = mem.read8(0x8d13);                  m.step(0x5531, 13);
  regs.and(0x0f);                              m.step(0x5533, 7);
  m.push16(0x5534); m.step(0x0020, 11); m.call(0x0020);            // 5533  rst 0x20 (A = table[0x55ff + A])
  mem.write8(0x8d05, regs.a);                  m.step(0x5537, 13);  // 5534  ld (0x8d05),a -- reload countdown
  regs.hl = 0x8d13;                            m.step(0x553a, 10);
  regs.incMem8(mem, regs.hl);                  m.step(0x553b, 11);  // 5537  inc (hl) -- advance table index
  regs.ix = 0x8c48;                            m.step(0x553f, 14);
  regs.de = 0x0018;                            m.step(0x5542, 10);
  regs.b = 0x01;                               m.step(0x5544, 7);
  return m.call(0x5544);                                            // fall through into loc_5544
}
