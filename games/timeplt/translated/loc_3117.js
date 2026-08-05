// SPDX-License-Identifier: GPL-3.0-only

// loc_3117  (ROM 0x3117-0x3155)
export function loc_3117(m) {
  const { regs, mem } = m;
  const IY = (d) => (regs.iy + d) & 0xffff;

  regs.hl = 0xad39;
  m.step(0x311a, 10); // ld hl,0xad39
  regs.a = mem.read8(regs.hl);
  m.step(0x311b, 7); // ld a,(hl)
  regs.cp(0x68);
  m.step(0x311d, 7); // cp 0x68
  if (regs.fNZ) {
    m.step(0x3114, 10); // jp nz,0x3114 TAKEN -- TAIL jump, nothing pushed
    return m.call(0x3114);
  }
  m.step(0x3120, 10); // jp nz NOT taken

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x3121, 6); // inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x3122, 7); // ld a,(hl)
  regs.cp(0x10);
  m.step(0x3124, 7); // cp 0x10
  if (regs.fZ) {
    m.step(0x312c, 10); // jp z,0x312c TAKEN
  } else {
    m.step(0x3127, 10); // jp z NOT taken
    regs.cp(0x05);
    m.step(0x3129, 7); // cp 0x05
    if (regs.fNZ) {
      m.step(0x3114, 10); // jp nz,0x3114 TAKEN -- TAIL jump, nothing pushed
      return m.call(0x3114);
    }
    m.step(0x312c, 10); // jp nz NOT taken
  }

  regs.hl = 0x316e;
  m.step(0x312f, 10); // ld hl,0x316e
  regs.b = 0x04;
  m.step(0x3131, 7); // ld b,0x04
  regs.iy = 0xaa30;
  m.step(0x3135, 14); // ld iy,0xaa30

  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x3136, 7); // ld a,(hl)
    mem.write8(IY(0x31), regs.a);
    m.step(0x3139, 19); // ld (iy+0x31),a
    regs.add(0x10);
    m.step(0x313b, 7); // add a,0x10
    mem.write8(IY(0x33), regs.a);
    m.step(0x313e, 19); // ld (iy+0x33),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x313f, 6); // inc hl
    regs.a = mem.read8(regs.hl);
    m.step(0x3140, 7); // ld a,(hl)
    mem.write8(IY(0x00), regs.a);
    m.step(0x3143, 19); // ld (iy+0x00),a
    mem.write8(IY(0x02), regs.a);
    m.step(0x3146, 19); // ld (iy+0x02),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x3147, 6); // inc hl
    regs.de = 0x0010;
    m.step(0x314a, 10); // ld de,0x0010
    regs.addIx(regs.de);
    m.step(0x314c, 15); // add ix,de
    regs.de = 0x0004;
    m.step(0x314f, 10); // ld de,0x0004
    regs.addIy(regs.de);
    m.step(0x3151, 15); // add iy,de
    if (regs.djnz() !== 0) {
      m.step(0x3135, 13); // djnz 0x3135 taken
      continue;
    }
    m.step(0x3153, 8); // djnz NOT taken
    break;
  }

  m.step(0x2cbc, 10); // jp 0x2cbc -- TAIL jump, nothing pushed
  return m.call(0x2cbc);
}
