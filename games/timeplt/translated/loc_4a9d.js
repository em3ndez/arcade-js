// SPDX-License-Identifier: GPL-3.0-only

// loc_4a9d  (ROM 0x4A9D-0x4ACB)
export function loc_4a9d(m) {
  const { regs, mem } = m;

  regs.b = 0x0d;
  m.step(0x4a9f, 7); // 4a9d  ld b,0x0d
  regs.hl = mem.read16(0xa9f7);
  m.step(0x4aa2, 16); // 4a9f  ld hl,(0xa9f7)

  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x4aa3, 7); // 4aa2  ld a,(hl) -- the cursor byte
    regs.and(regs.a);
    m.step(0x4aa4, 4); // 4aa3  and a
    regs.exDeHl();
    m.step(0x4aa5, 4); // 4aa4  ex de,hl -- no flags, the Z above survives

    if (regs.fZ) {
      m.step(0x4ab0, 12); // 4aa5  jr z,0x4ab0 (taken) -- entry is zero, no bump
    } else {
      m.step(0x4aa7, 7); // 4aa5  jr z (not taken)
      regs.a = mem.read8(regs.hl);
      m.step(0x4aa8, 7); // 4aa7  ld a,(hl) -- HL is the second pointer now
      regs.a = regs.inc8(regs.a);
      m.step(0x4aa9, 4); // 4aa8  inc a
      regs.bit(0, regs.c);
      m.step(0x4aab, 8); // 4aa9  bit 0,c
      if (regs.fZ) {
        m.step(0x4aaf, 12); // 4aab  jr z,0x4aaf (taken) -- keep the +1
      } else {
        m.step(0x4aad, 7); // 4aab  jr z (not taken)
        regs.a = regs.dec8(regs.a);
        m.step(0x4aae, 4); // 4aad  dec a
        regs.a = regs.dec8(regs.a);
        m.step(0x4aaf, 4); // 4aae  dec a -- net -1
      }
      mem.write8(regs.hl, regs.a);
      m.step(0x4ab0, 7); // 4aaf  ld (hl),a
    }

    regs.bit(1, regs.c);
    m.step(0x4ab2, 8); // 4ab0  bit 1,c
    regs.de = 0x0020;
    m.step(0x4ab5, 10); // 4ab2  ld de,0x0020 -- no flags
    if (regs.fZ) {
      m.step(0x4aba, 12); // 4ab5  jr z,0x4aba (taken) -- stride +0x20
    } else {
      m.step(0x4ab7, 7); // 4ab5  jr z (not taken)
      regs.de = 0xffe0;
      m.step(0x4aba, 10); // 4ab7  ld de,0xffe0 -- stride -0x20
    }

    regs.addHl(regs.de);
    m.step(0x4abb, 11); // 4aba  add hl,de
    regs.exDeHl();
    m.step(0x4abc, 4); // 4abb  ex de,hl -- the advanced pointer goes back to DE
    regs.hl = mem.read16(0xa9f7);
    m.step(0x4abf, 16); // 4abc  ld hl,(0xa9f7)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x4ac0, 6); // 4abf  inc hl
    regs.bit(0, regs.c);
    m.step(0x4ac2, 8); // 4ac0  bit 0,c
    if (regs.fZ) {
      m.step(0x4ac6, 12); // 4ac2  jr z,0x4ac6 (taken) -- cursor steps forward
    } else {
      m.step(0x4ac4, 7); // 4ac2  jr z (not taken)
      regs.hl = (regs.hl - 1) & 0xffff;
      m.step(0x4ac5, 6); // 4ac4  dec hl
      regs.hl = (regs.hl - 1) & 0xffff;
      m.step(0x4ac6, 6); // 4ac5  dec hl -- net backwards
    }

    mem.write16(0xa9f7, regs.hl);
    m.step(0x4ac9, 16); // 4ac6  ld (0xa9f7),hl

    if (regs.djnz() !== 0) {
      m.step(0x4aa2, 13); // 4ac9  djnz 0x4aa2 (taken)
      continue;
    }
    m.step(0x4acb, 8); // 4ac9  djnz (not taken)
    break;
  }

  m.ret(); // 4acb  ret
}
