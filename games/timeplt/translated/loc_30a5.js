// SPDX-License-Identifier: GPL-3.0-only

// loc_30a5  (ROM 0x30A5–0x3113)
export function loc_30a5(m) {
  const { regs, mem } = m;
  const IY = (d) => (regs.iy + d) & 0xffff;

  regs.hl = 0x086b;
  m.step(0x30a8, 10); // ld hl,0x086b
  regs.c = 0x22;
  m.step(0x30aa, 7); // ld c,0x22
  regs.b = 0x10;
  m.step(0x30ac, 7); // ld b,0x10

  m.push16(0x30af);
  m.step(0x0b4c, 17); // call 0x0b4c
  m.call(0x0b4c);

  regs.a = mem.read8(0xad04);
  m.step(0x30b2, 13); // ld a,(0xad04)
  regs.add(regs.a);
  m.step(0x30b3, 4); // add a,a
  regs.add(regs.a);
  m.step(0x30b4, 4); // add a,a
  regs.add(regs.a);
  m.step(0x30b5, 4); // add a,a -- A = 8 * (0xad04)
  regs.c = regs.a;
  m.step(0x30b6, 4); // ld c,a
  regs.hl = 0x3176;
  m.step(0x30b9, 10); // ld hl,0x3176

  m.push16(0x30ba);
  m.step(0x0018, 11); // rst 0x18 -- HL += A
  m.call(0x0018);

  regs.de = 0xaa31;
  m.step(0x30bd, 10); // ld de,0xaa31
  regs.b = 0x08;
  m.step(0x30bf, 7); // ld b,0x08

  do {
    regs.a = mem.read8(regs.hl);
    m.step(0x30c0, 7); // ld a,(hl)
    mem.write8(regs.de, regs.a);
    m.step(0x30c1, 7); // ld (de),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x30c2, 6); // inc hl
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x30c3, 6); // inc de
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x30c4, 6); // inc de
    regs.djnz();
    m.step(regs.b !== 0 ? 0x30bf : 0x30c6, regs.b !== 0 ? 13 : 8); // djnz 0x30bf
  } while (regs.b !== 0);

  regs.a = mem.read8(0xad04);
  m.step(0x30c9, 13); // ld a,(0xad04)
  regs.cp(0x04);
  m.step(0x30cb, 7); // cp 0x04
  regs.c = regs.a; // flag-neutral -- keeps (0xad04) for the 0x30DD test
  m.step(0x30cc, 4); // ld c,a
  if (regs.fZ) {
    m.step(0x3156, 10); // jp z,0x3156 TAKEN -- TAIL jump (0x3156 re-enters at 0x30D1)
    return m.call(0x3156);
  }
  m.step(0x30cf, 10); // jp z NOT taken

  regs.a = 0xcc;
  m.step(0x30d1, 7); // ld a,0xcc

  return m.call(0x30d1);
}
