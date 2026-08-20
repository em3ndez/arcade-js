// SPDX-License-Identifier: GPL-3.0-only

// loc_362d  (ROM 0x362d-0x365c) -- state dispatch on the actor's (ix+0x06) phase byte. Phase < 7
// tail-jumps to loc_361d, phase >= 0x14 tail-jumps to loc_3625. Between those, a global timer
// (0x8d7d) gate lets phase 0x13 ret early. Then a per-actor delay (0x8d6b) counts down (ret while
// non-zero); once it hits 0 and B < 0x80, look up an offset from table 0x368e via rst 0x20 (index
// = 0x8907 & 7), store it into the saved pointer (DE), and fall through into loc_365d.
export function loc_362d(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x3630, 19); // 362d ld a,(ix+0x06)
  regs.cp(0x07);                                 m.step(0x3632, 7);
  if (regs.fC) { m.step(0x361d, 12); return m.call(0x361d); }        // 3632 jr c,loc_361d (tail)
  m.step(0x3634, 7);                                                 // jr c not taken
  regs.cp(0x14);                                 m.step(0x3636, 7);
  if (regs.fNC) { m.step(0x3625, 12); return m.call(0x3625); }       // 3636 jr nc,loc_3625 (tail)
  m.step(0x3638, 7);                                                 // jr nc not taken
  regs.a = mem.read8(0x8d7d);                    m.step(0x363b, 13);  // 3638 ld a,(0x8d7d)
  regs.cp(0x0e);                                 m.step(0x363d, 7);
  if (regs.fC) {
    m.step(0x3645, 12);                                              // 363d jr c,0x3645 taken
  } else {
    m.step(0x363f, 7);
    regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x3642, 19); // 363f ld a,(ix+0x06)
    regs.cp(0x13);                               m.step(0x3644, 7);
    if (regs.fC) { return m.ret(11); }                              // 3644 ret c
    m.step(0x3645, 5);                                              // ret c not taken
  }

  // loc_3645: per-actor delay countdown at 0x8d6b
  regs.hl = 0x8d6b;                              m.step(0x3648, 10);
  regs.a = mem.read8(regs.hl);                   m.step(0x3649, 7);
  regs.and(regs.a);                              m.step(0x364a, 4);
  if (regs.fZ) {
    m.step(0x364e, 12);                                             // 364a jr z,0x364e taken
  } else {
    m.step(0x364c, 7);                                             // jr z not taken
    mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl))); m.step(0x364d, 11); // 364c dec (hl)
    return m.ret(10);                                              // 364d ret
  }

  // loc_364e: delay elapsed -- table lookup then store into DE, fall through to loc_365d
  regs.a = regs.b;                               m.step(0x364f, 4);
  regs.cp(0x80);                                 m.step(0x3651, 7);
  if (regs.fNC) { return m.ret(11); }                              // 3651 ret nc
  m.step(0x3652, 5);                                               // ret nc not taken
  regs.exDeHl();                                 m.step(0x3653, 4); // DE = 0x8d6b (saved pointer)
  regs.hl = 0x368e;                              m.step(0x3656, 10);
  regs.a = mem.read8(0x8907);                    m.step(0x3659, 13);
  regs.and(0x07);                                m.step(0x365b, 7);
  m.push16(0x365c); m.step(0x0020, 11); m.call(0x0020);            // 365b rst 0x20: A = table[HL+A]
  mem.write8(regs.de, regs.a);                   m.step(0x365d, 7); // 365c ld (de),a -> falls through
  return m.call(0x365d);
}
