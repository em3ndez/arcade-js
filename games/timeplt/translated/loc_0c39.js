// SPDX-License-Identifier: GPL-3.0-only

// loc_0c39  (ROM 0x0C39-0x0C4F)
export function loc_0c39(m) {
  const { regs, mem } = m;

  regs.hl = 0x0c50;
  m.step(0x0c3c, 10); // 0c39  ld hl,0x0c50
  m.push16(0x0c3f);
  m.step(0x018c, 17); // 0c3c  call 0x018c
  m.call(0x018c);

  regs.exDeHl();
  m.step(0x0c40, 4); // 0c3f  ex de,hl
  regs.e = mem.read8(regs.hl);
  m.step(0x0c41, 7); // 0c40  ld e,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0c42, 6); // 0c41  inc hl
  regs.d = mem.read8(regs.hl);
  m.step(0x0c43, 7); // 0c42  ld d,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0c44, 6); // 0c43  inc hl
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0c45, 6); // 0c44  inc hl -- steps OVER the colour byte

  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x0c46, 7); // 0c45  ld a,(hl)
    regs.cp(0xb9);
    m.step(0x0c48, 7); // 0c46  cp 0xb9

    if (regs.fZ) { m.ret(11); return; } // 0c48  ret z (taken) -- terminator
    m.step(0x0c49, 5); // 0c48  ret z (not taken)

    regs.a = 0xf1;
    m.step(0x0c4b, 7); // 0c49  ld a,0xf1 -- the blank glyph
    mem.write8(regs.de, regs.a, 4);
    m.step(0x0c4c, 7); // 0c4b  ld (de),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0c4d, 6); // 0c4c  inc hl

    m.push16(0x0c4e);
    m.step(0x0020, 11); // 0c4d  rst 0x20 -- DE -= 0x20, one row
    m.call(0x0020);

    m.step(0x0c45, 12); // 0c4e  jr 0x0c45
  }
}
