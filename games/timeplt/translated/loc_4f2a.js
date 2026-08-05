// SPDX-License-Identifier: GPL-3.0-only

// loc_4f2a  (ROM 0x4F2A-0x4F34, plus its interior arm 0x5032-0x507D)
export function loc_4f2a(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa980);
  m.step(0x4f2d, 13); // ld a,(0xa980)
  regs.and(0x01);
  m.step(0x4f2f, 7); // and 0x01 -- frame parity

  if (regs.fZ) {
    m.step(0x4e63, 10); // jp z,0x4e63 -- TAIL (even frame)
    return m.call(0x4e63);
  }
  m.step(0x4f32, 10); // jp z not taken

  m.step(0x5032, 10); // jp 0x5032

  regs.a = mem.read8(0xad0d);
  m.step(0x5035, 13); // ld a,(0xad0d)
  regs.and(regs.a);
  m.step(0x5036, 4); // and a -- zero test

  if (regs.fNZ) {
    m.step(0x505a, 10); // jp nz,0x505a taken

    regs.de = 0xa810;
    m.step(0x505d, 10); // ld de,0xa810
    regs.iy = 0xaa12;
    m.step(0x5061, 14); // ld iy,0xaa12
    regs.ix = 0xaa80;
    m.step(0x5065, 14); // ld ix,0xaa80
    regs.exAf();
    m.step(0x5066, 4); // ex af,af'
    regs.a = 0x09;
    m.step(0x5068, 7); // ld a,0x09
    regs.b = regs.a;
    m.step(0x5069, 4); // ld b,a
    regs.exAf();
    m.step(0x506a, 4); // ex af,af' -- the live A is back, A' = 0x09
    regs.c = 0x06;
    m.step(0x506c, 7); // ld c,0x06
    mem.write16(0xa993, regs.de);
    m.step(0x5070, 20); // ld (0xa993),de
    mem.write16(0xa991, regs.iy);
    m.step(0x5074, 20); // ld (0xa991),iy
    regs.l = 0x07;
    m.step(0x5076, 7); // ld l,0x07
    regs.h = 0x0f;
    m.step(0x5078, 7); // ld h,0x0f

    m.push16(0x507b);
    m.step(0x5211, 17); // call 0x5211
    m.call(0x5211);

    m.step(0x4fe0, 10); // jp 0x4fe0 -- TAIL into 0x4FE0, which owns that body
    return m.call(0x4fe0);
  }
  m.step(0x5039, 10); // jp nz not taken

  regs.de = 0xa810;
  m.step(0x503c, 10); // ld de,0xa810
  regs.iy = 0xaa12;
  m.step(0x5040, 14); // ld iy,0xaa12
  regs.ix = 0xaa80;
  m.step(0x5044, 14); // ld ix,0xaa80
  regs.exAf();
  m.step(0x5045, 4); // ex af,af'
  regs.a = 0x0b;
  m.step(0x5047, 7); // ld a,0x0b
  regs.b = regs.a;
  m.step(0x5048, 4); // ld b,a
  regs.exAf();
  m.step(0x5049, 4); // ex af,af' -- the live A is back, A' = 0x0B
  regs.c = 0x06;
  m.step(0x504b, 7); // ld c,0x06
  mem.write16(0xa993, regs.de);
  m.step(0x504f, 20); // ld (0xa993),de
  mem.write16(0xa991, regs.iy);
  m.step(0x5053, 20); // ld (0xa991),iy
  regs.l = 0x07;
  m.step(0x5055, 7); // ld l,0x07
  regs.h = 0x0f;
  m.step(0x5057, 7); // ld h,0x0f

  m.step(0x5211, 10); // jp 0x5211 -- TAIL
  return m.call(0x5211);
}
