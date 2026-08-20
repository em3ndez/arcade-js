// SPDX-License-Identifier: GPL-3.0-only

// loc_3536  (ROM 0x3536-0x3552, tail into loc_3553) -- actor frame-hold tick. Animates via loc_4006,
// decrements the (IX+11h) hold and returns nz while still holding. On expiry, if (IX+07h)&0xf0 is set
// it bumps the 0x8d76 counter, wrapping at 3 (dec l -> clear 0x8d75 and 0x8f20). Every non-holding
// exit falls into loc_3553 to blank the sprite band.
export function loc_3536(m) {
  const { regs, mem } = m;

  m.push16(0x3539); m.step(0x4006, 17); m.call(0x4006); // 3536  call 0x4006
  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x353c, 23); // 3539  dec (ix+11h)
  if (regs.fNZ) { return m.ret(11); } // 353c  ret nz -- still holding
  m.step(0x353d, 5);
  regs.a = mem.read8((regs.ix + 0x07) & 0xffff); m.step(0x3540, 19); // 353d  ld a,(ix+07h)
  regs.and(0xf0);                               m.step(0x3542, 7);
  if (regs.fZ) { m.step(0x3553, 12); return m.call(0x3553); } // 3542  jr z,0x3553 (tail)
  m.step(0x3544, 7);
  regs.hl = 0x8d76;                             m.step(0x3547, 10);
  regs.incMem8(mem, regs.hl);                   m.step(0x3548, 11); // 3547  inc (hl)
  regs.a = mem.read8(regs.hl);                  m.step(0x3549, 7);
  regs.cp(0x03);                                m.step(0x354b, 7);
  if (regs.fC) { m.step(0x3553, 12); return m.call(0x3553); } // 354b  jr c,0x3553 (tail)
  m.step(0x354d, 7);
  regs.l = regs.dec8(regs.l);                   m.step(0x354e, 4); // 354d  dec l -- HL -> 0x8d75
  regs.xor(regs.a);                             m.step(0x354f, 4);
  mem.write8(regs.hl, regs.a);                  m.step(0x3550, 7); // 354f  ld (hl),a
  mem.write8(0x8f20, regs.a);                   m.step(0x3553, 13); // 3550  ld (0x8f20),a
  return m.call(0x3553); // fall through into loc_3553 (tail)
}
