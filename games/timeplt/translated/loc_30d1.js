// SPDX-License-Identifier: GPL-3.0-only

// loc_30d1  (ROM 0x30D1-0x3113)
export function loc_30d1(m) {
  const { regs, mem } = m;
  const IY = (d) => (regs.iy + d) & 0xffff;

  regs.hl = 0xaa60;
  m.step(0x30d4, 10); // ld hl,0xaa60
  regs.de = 0x0002;
  m.step(0x30d7, 10); // ld de,0x0002
  regs.b = 0x08;
  m.step(0x30d9, 7); // ld b,0x08

  do {
    mem.write8(regs.hl, regs.a);
    m.step(0x30da, 7); // ld (hl),a
    regs.addHl(regs.de);
    m.step(0x30db, 11); // add hl,de
    regs.djnz();
    m.step(regs.b !== 0 ? 0x30d9 : 0x30dd, regs.b !== 0 ? 13 : 8); // djnz 0x30d9
  } while (regs.b !== 0);

  regs.a = regs.c;
  m.step(0x30de, 4); // ld a,c
  regs.cp(0x04);
  m.step(0x30e0, 7); // cp 0x04
  if (regs.fC) {
    m.step(0x3117, 10); // jp c,0x3117 TAKEN -- TAIL jump, nothing pushed
    return m.call(0x3117);
  }
  m.step(0x30e3, 10); // jp c NOT taken

  regs.hl = 0xacc7;
  m.step(0x30e6, 10); // ld hl,0xacc7
  regs.a = mem.read8(regs.hl);
  m.step(0x30e7, 7); // ld a,(hl)
  regs.cp(0x3b);
  m.step(0x30e9, 7); // cp 0x3b
  if (regs.fNZ) {
    m.step(0x315b, 10); // jp nz,0x315b TAKEN -- TAIL jump, nothing pushed
    return m.call(0x315b);
  }
  m.step(0x30ec, 10); // jp nz NOT taken

  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x30ed, 6); // inc hl
  regs.a = mem.read8(regs.hl);
  m.step(0x30ee, 7); // ld a,(hl)
  regs.cp(0x05);
  m.step(0x30f0, 7); // cp 0x05
  if (regs.fZ) {
    m.step(0x30f8, 10); // jp z,0x30f8 TAKEN
  } else {
    m.step(0x30f3, 10); // jp z NOT taken
    regs.cp(0x10);
    m.step(0x30f5, 7); // cp 0x10
    if (regs.fNZ) {
      m.step(0x315b, 10); // jp nz,0x315b TAKEN -- TAIL jump, nothing pushed
      return m.call(0x315b);
    }
    m.step(0x30f8, 10); // jp nz NOT taken
  }

  regs.b = 0x08;
  m.step(0x30fa, 7); // ld b,0x08
  regs.iy = 0xaa30;
  m.step(0x30fe, 14); // ld iy,0xaa30
  regs.hl = 0x315e;
  m.step(0x3101, 10); // ld hl,0x315e

  do {
    regs.a = mem.read8(regs.hl);
    m.step(0x3102, 7); // ld a,(hl)
    mem.write8(IY(0x31), regs.a);
    m.step(0x3105, 19); // ld (iy+0x31),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x3106, 6); // inc hl
    regs.a = mem.read8(regs.hl);
    m.step(0x3107, 7); // ld a,(hl)
    mem.write8(IY(0x00), regs.a);
    m.step(0x310a, 19); // ld (iy+0x00),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x310b, 6); // inc hl
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x310d, 10); // inc iy
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x310f, 10); // inc iy
    regs.djnz();
    m.step(regs.b !== 0 ? 0x3101 : 0x3111, regs.b !== 0 ? 13 : 8); // djnz 0x3101
  } while (regs.b !== 0);

  m.step(0x2cbc, 10); // jp 0x2cbc -- TAIL jump, nothing pushed
  return m.call(0x2cbc);
}
