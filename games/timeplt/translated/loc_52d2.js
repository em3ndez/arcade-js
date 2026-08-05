// SPDX-License-Identifier: GPL-3.0-only

// loc_52d2  (ROM 0x52D2-0x5302)
export function loc_52d2(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad0c);
  m.step(0x52d5, 13); // ld a,(0xad0c)
  regs.and(0x0f);
  m.step(0x52d7, 7); // and 0x0f
  regs.c = regs.a;
  m.step(0x52d8, 4); // ld c,a -- colour bias
  regs.hl = mem.read16(0xae00);
  m.step(0x52db, 16); // ld hl,(0xae00)
  regs.a = regs.l;
  m.step(0x52dc, 4); // ld a,l
  regs.sub(0x04);
  m.step(0x52de, 7); // sub 0x04
  if (regs.fZ) {
    m.ret(11); // ret z -- the list is empty
    return;
  }
  m.step(0x52df, 5); // ret z not taken

  regs.rrca();
  m.step(0x52e0, 4); // rrca
  regs.rrca();
  m.step(0x52e1, 4); // rrca
  regs.and(0x1f);
  m.step(0x52e3, 7); // and 0x1f -- entry count
  regs.b = regs.a;
  m.step(0x52e4, 4); // ld b,a
  regs.hl = 0xae04;
  m.step(0x52e7, 10); // ld hl,0xae04

  for (;;) {
    regs.e = mem.read8(regs.hl);
    m.step(0x52e8, 7); // ld e,(hl)
    regs.l = regs.inc8(regs.l);
    m.step(0x52e9, 4); // inc l
    regs.d = mem.read8(regs.hl);
    m.step(0x52ea, 7); // ld d,(hl)
    regs.l = regs.inc8(regs.l);
    m.step(0x52eb, 4); // inc l
    regs.a = mem.read8(regs.de);
    m.step(0x52ec, 7); // ld a,(de)
    regs.and(0x10);
    m.step(0x52ee, 7); // and 0x10

    if (regs.fNZ) {
      m.step(0x52fe, 12); // jr nz,0x52fe -- skip this entry
      regs.l = regs.inc8(regs.l);
      m.step(0x52ff, 4); // inc l
      regs.l = regs.inc8(regs.l);
      m.step(0x5300, 4); // inc l
      if (regs.djnz() !== 0) {
        m.step(0x52e7, 13); // djnz taken
        continue;
      }
      m.step(0x5302, 8); // djnz not taken
      m.ret(10); // 5302
      return;
    }
    m.step(0x52f0, 7); // jr nz not taken

    regs.a = mem.read8(regs.hl);
    m.step(0x52f1, 7); // ld a,(hl) -- the tile code
    regs.d = regs.set(2, regs.d);
    m.step(0x52f3, 8); // set 2,d -- flag-neutral; DE now addresses video RAM
    mem.write8(regs.de, regs.a);
    m.step(0x52f4, 7); // ld (de),a
    regs.d = regs.res(2, regs.d);
    m.step(0x52f6, 8); // res 2,d -- back to colour RAM
    regs.l = regs.inc8(regs.l);
    m.step(0x52f7, 4); // inc l
    regs.a = mem.read8(regs.hl);
    m.step(0x52f8, 7); // ld a,(hl) -- the colour
    regs.l = regs.inc8(regs.l);
    m.step(0x52f9, 4); // inc l
    regs.add(regs.c);
    m.step(0x52fa, 4); // add a,c -- apply the bias
    mem.write8(regs.de, regs.a);
    m.step(0x52fb, 7); // ld (de),a
    if (regs.djnz() !== 0) {
      m.step(0x52e7, 13); // djnz taken
      continue;
    }
    m.step(0x52fd, 8); // djnz not taken
    break;
  }

  m.ret(10); // 52fd
}
