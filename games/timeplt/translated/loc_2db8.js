// SPDX-License-Identifier: GPL-3.0-only

// loc_2db8  (ROM 0x2DB8-0x2DF3, Time Pilot)
export function loc_2db8(m) {
  const { regs, mem } = m;

  regs.hl = 0xad01;
  m.step(0x2dbb, 10); // ld hl,0xad01
  regs.incMem8(mem, regs.hl);
  m.step(0x2dbc, 11); // inc (hl) -- the wave counter

  regs.hl = 0xad04;
  m.step(0x2dbf, 10); // ld hl,0xad04
  regs.a = mem.read8(regs.hl);
  m.step(0x2dc0, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a);
  m.step(0x2dc1, 4); // inc a
  regs.cp(0x05);
  m.step(0x2dc3, 7); // cp 0x05
  if (regs.fC) {
    m.step(0x2dc6, 12); // jr c,0x2dc6 taken -- under 5, keep it
  } else {
    m.step(0x2dc5, 7); // jr c not taken
    regs.xor(regs.a);
    m.step(0x2dc6, 4); // xor a -- wrap to 0
  }

  mem.write8(regs.hl, regs.a);
  m.step(0x2dc7, 7); // ld (hl),a -- HL is still 0xad04

  regs.a = mem.read8(0xad01);
  m.step(0x2dca, 13); // ld a,(0xad01)
  regs.cp(0x06);
  m.step(0x2dcc, 7); // cp 0x06
  if (regs.fC) {
    m.step(0x2dd7, 12); // jr c,0x2dd7 taken
    regs.a = mem.read8(0xa9d3);
    m.step(0x2dda, 13); // ld a,(0xa9d3)
    m.step(0x2ddf, 12); // jr 0x2ddf
  } else {
    m.step(0x2dce, 7); // jr c not taken
    regs.cp(0x0b);
    m.step(0x2dd0, 7); // cp 0x0b
    if (regs.fC) {
      m.step(0x2ddc, 12); // jr c,0x2ddc taken
      regs.a = mem.read8(0xa9d4);
      m.step(0x2ddf, 13); // ld a,(0xa9d4) -- falls into 0x2ddf
    } else {
      m.step(0x2dd2, 7); // jr c not taken
      regs.a = mem.read8(0xa9d5);
      m.step(0x2dd5, 13); // ld a,(0xa9d5)
      m.step(0x2ddf, 12); // jr 0x2ddf
    }
  }

  mem.write8(0xad0a, regs.a);
  m.step(0x2de2, 13); // ld (0xad0a),a
  regs.a = mem.read8(0xa9cd);
  m.step(0x2de5, 13); // ld a,(0xa9cd)
  mem.write8(0xad02, regs.a);
  m.step(0x2de8, 13); // ld (0xad02),a
  regs.xor(regs.a);
  m.step(0x2de9, 4); // xor a
  mem.write8(0xad0d, regs.a);
  m.step(0x2dec, 13); // ld (0xad0d),a
  mem.write8(0xacc6, regs.a);
  m.step(0x2def, 13); // ld (0xacc6),a
  regs.a = regs.dec8(regs.a);
  m.step(0x2df0, 4); // dec a -- A = 0xff
  mem.write8(0xad0e, regs.a);
  m.step(0x2df3, 13); // ld (0xad0e),a

  m.ret(); // 0x2df3
}
