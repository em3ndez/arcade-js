// SPDX-License-Identifier: GPL-3.0-only

// loc_5e1f  (ROM 0x5e1f-0x5e77) -- proximity trigger. With A=(HL) it skips on state 0 or 5; else it
// builds target coords (e,d) from (ix+0/2) plus a sign offset (0x09/0x00, or 0xf7/0x10 when 0x881f is
// zero), takes |dx| vs (iy+0) and |dy| vs (iy+2)+8, and bails (ret nc) if dx>=2 or dy>=9. On a hit it
// sets flag 0x8d32, retargets IX=HL, installs animation 0x40b4 (loc_381e), seeds the actor fields,
// fires the sound (loc_0f15), then `pop af; ret` -- returning past its immediate caller.
export function loc_5e1f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);   m.step(0x5e20, 7); // 5e1f  ld a,(hl)
  regs.and(regs.a);              m.step(0x5e21, 4);
  if (regs.fZ) { return m.ret(11); } // 5e21  ret z -- state 0
  m.step(0x5e22, 5);
  regs.cp(0x05);                 m.step(0x5e24, 7);
  if (regs.fZ) { return m.ret(11); } // 5e24  ret z -- state 5
  m.step(0x5e25, 5);

  regs.e = 0x09;                 m.step(0x5e27, 7);
  regs.d = 0x00;                 m.step(0x5e29, 7);
  regs.a = mem.read8(0x881f);    m.step(0x5e2c, 13);
  regs.and(regs.a);              m.step(0x5e2d, 4);
  if (regs.fNZ) {
    m.step(0x5e33, 12); // 5e2d  jr nz,0x5e33
  } else {
    m.step(0x5e2f, 7);
    regs.e = 0xf7;               m.step(0x5e31, 7);
    regs.d = 0x10;               m.step(0x5e33, 7);
  }

  regs.a = mem.read8((regs.ix + 0x00) & 0xffff); m.step(0x5e36, 19); // 5e33  ld a,(ix+0x00)
  regs.add(regs.e);              m.step(0x5e37, 4);
  regs.e = regs.a;               m.step(0x5e38, 4);
  regs.a = mem.read8((regs.ix + 0x02) & 0xffff); m.step(0x5e3b, 19); // 5e38  ld a,(ix+0x02)
  regs.add(regs.d);              m.step(0x5e3c, 4);
  regs.d = regs.a;               m.step(0x5e3d, 4);
  regs.a = mem.read8((regs.iy + 0x00) & 0xffff); m.step(0x5e40, 19); // 5e3d  ld a,(iy+0x00)
  regs.sub(regs.e);              m.step(0x5e41, 4);
  if (regs.fC) { m.step(0x5e43, 7); regs.neg(); m.step(0x5e45, 8); } // 5e41 jr nc not taken -> 5e43 neg
  else { m.step(0x5e45, 12); }
  regs.cp(0x02);                 m.step(0x5e47, 7);
  if (regs.fNC) { return m.ret(11); } // 5e47  ret nc -- dx too large
  m.step(0x5e48, 5);

  regs.a = mem.read8((regs.iy + 0x02) & 0xffff); m.step(0x5e4b, 19); // 5e48  ld a,(iy+0x02)
  regs.add(0x08);                m.step(0x5e4d, 7);
  regs.sub(regs.d);              m.step(0x5e4e, 4);
  if (regs.fC) { m.step(0x5e50, 7); regs.neg(); m.step(0x5e52, 8); } // 5e4e jr nc not taken -> 5e50 neg
  else { m.step(0x5e52, 12); }
  regs.cp(0x09);                 m.step(0x5e54, 7);
  if (regs.fNC) { return m.ret(11); } // 5e54  ret nc -- dy too large
  m.step(0x5e55, 5);

  regs.a = 0x01;                 m.step(0x5e57, 7);
  mem.write8(0x8d32, regs.a);    m.step(0x5e5a, 13); // 5e57  ld (0x8d32),a
  m.push16(regs.hl);             m.step(0x5e5b, 11); // 5e5a  push hl
  regs.ix = m.pop16();           m.step(0x5e5d, 14); // 5e5b  pop ix -- IX = HL
  regs.de = 0x40b4;              m.step(0x5e60, 10);
  m.push16(0x5e63);
  m.step(0x381e, 17);            // 5e60  call 0x381e (set animation)
  m.call(0x381e);
  mem.write8((regs.ix + 0x11) & 0xffff, 0x0a); m.step(0x5e67, 19);
  mem.write8((regs.ix + 0x00) & 0xffff, 0x00); m.step(0x5e6b, 19);
  mem.write8((regs.ix + 0x01) & 0xffff, 0x01); m.step(0x5e6f, 19);
  mem.write8((regs.ix + 0x02) & 0xffff, 0x02); m.step(0x5e73, 19);
  m.push16(0x5e76);
  m.step(0x0f15, 17);            // 5e73  call 0x0f15 (sound)
  m.call(0x0f15);
  regs.af = m.pop16();           m.step(0x5e77, 10); // 5e76  pop af -- drop immediate-caller return
  return m.ret(10); // 5e77  ret -- to caller's caller
}
