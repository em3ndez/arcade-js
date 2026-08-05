// SPDX-License-Identifier: GPL-3.0-only

// loc_17b9  (ROM 0x17B9-0x17E1)
export function loc_17b9(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x590d);
  m.step(0x17bc, 13); // 17b9  ld a,(0x590d)
  regs.c = regs.a;
  m.step(0x17bd, 4); // 17bc  ld c,a -- C is never read again
  regs.a = mem.read8(0x4a40);
  m.step(0x17c0, 13); // 17bd  ld a,(0x4a40) -- the seed, 0x00
  regs.hl = 0x0b06;
  m.step(0x17c3, 10); // 17c0  ld hl,0x0b06
  regs.b = 0x33;
  m.step(0x17c5, 7); // 17c3  ld b,0x33

  do {
    regs.add(mem.read8(regs.hl));
    m.step(0x17c6, 7); // 17c5  add a,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x17c7, 6); // 17c6  inc hl
    regs.djnz(); // no flags
    m.step(regs.b !== 0 ? 0x17c5 : 0x17c9, regs.b !== 0 ? 13 : 8); // 17c7  djnz 0x17c5
  } while (regs.b !== 0);

  regs.cp(0xef);
  m.step(0x17cb, 7); // 17c9  cp 0xef

  if (regs.fZ) {
    m.step(0x0f1a, 10); // 17cb  jp z,0x0f1a -- TAIL jump, the clean path
    return m.call(0x0f1a);
  }
  m.step(0x17ce, 10); // 17cb  jp z,0x0f1a (not taken) -- the checksum failed

  regs.a = mem.read8(0x4c89);
  m.step(0x17d1, 13); // 17ce  ld a,(0x4c89) -- 0x00
  mem.write8(0xc308, regs.a, 10);
  m.step(0x17d4, 13); // 17d1  ld (0xc308),a -- LS259 bit 4, video OFF
  regs.hl = 0xa65c;
  m.step(0x17d7, 10); // 17d4  ld hl,0xa65c
  regs.de = 0xad39;
  m.step(0x17da, 10); // 17d7  ld de,0xad39
  regs.a = mem.read8(regs.hl);
  m.step(0x17db, 7); // 17da  ld a,(hl) -- the glyph
  mem.write8(regs.de, regs.a);
  m.step(0x17dc, 7); // 17db  ld (de),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x17dd, 6); // 17dc  inc de
  regs.h = regs.res(2, regs.h); // no flags
  m.step(0x17df, 8); // 17dd  res 2,h -- 0xA65C becomes 0xA25C, COLOUR RAM
  regs.a = mem.read8(regs.hl);
  m.step(0x17e0, 7); // 17df  ld a,(hl) -- the colour
  mem.write8(regs.de, regs.a);
  m.step(0x17e1, 7); // 17e0  ld (de),a

  m.ret(10); // 17e1  ret -- (0xA9AC) NOT advanced
}
