// SPDX-License-Identifier: GPL-3.0-only

// loc_5694  (ROM 0x5694-0x56D1, Time Pilot)
export function loc_5694(m) {
  const { regs, mem } = m;

  regs.c = 0x00;
  m.step(0x5696, 7); // ld c,0x00 -- 256 iterations, via the wrap
  regs.hl = 0x0831;
  m.step(0x5699, 10); // ld hl,0x0831
  regs.a = mem.read8(0xa9ab);
  m.step(0x569c, 13); // ld a,(0xa9ab) -- the running value

  do {
    regs.sub(mem.read8(regs.hl));
    m.step(0x569d, 7); // sub (hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x569e, 6); // inc hl -- 16-bit inc sets NO flags
    regs.c = regs.dec8(regs.c);
    m.step(0x569f, 4); // dec c
    m.step(regs.fNZ ? 0x569c : 0x56a1, regs.fNZ ? 12 : 7); // jr nz,0x569c
  } while (regs.fNZ);

  regs.xor(0xc2);
  m.step(0x56a3, 7); // xor 0xc2
  mem.write8(0xa9ab, regs.a);
  m.step(0x56a6, 13); // ld (0xa9ab),a

  m.push16(0x56a9);
  m.step(0x0f97, 17); // call 0x0f97
  m.call(0x0f97);
  m.push16(0x56ac);
  m.step(0x1edf, 17); // call 0x1edf
  m.call(0x1edf);
  m.push16(0x56af);
  m.step(0x0f97, 17); // call 0x0f97 -- the same routine again
  m.call(0x0f97);
  m.push16(0x56b2);
  m.step(0x2cbc, 17); // call 0x2cbc
  m.call(0x2cbc);
  m.push16(0x56b5);
  m.step(0x23e3, 17); // call 0x23e3
  m.call(0x23e3);
  m.push16(0x56b8);
  m.step(0x1098, 17); // call 0x1098
  m.call(0x1098);

  regs.hl = 0xa9eb;
  m.step(0x56bb, 10); // ld hl,0xa9eb
  regs.decMem8(mem, regs.hl);
  m.step(0x56bc, 11); // dec (hl) -- its Z IS the ret condition

  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- the counter has not expired
    return;
  }
  m.step(0x56bd, 5); // ret nz NOT taken

  regs.c = 0x00;
  m.step(0x56bf, 7); // ld c,0x00
  regs.hl = 0x12a7;
  m.step(0x56c2, 10); // ld hl,0x12a7
  regs.a = mem.read8(0xa9ab);
  m.step(0x56c5, 13); // ld a,(0xa9ab)

  do {
    regs.sub(mem.read8(regs.hl));
    m.step(0x56c6, 7); // sub (hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x56c7, 6); // inc hl
    regs.c = regs.dec8(regs.c);
    m.step(0x56c8, 4); // dec c
    m.step(regs.fNZ ? 0x56c5 : 0x56ca, regs.fNZ ? 12 : 7); // jr nz,0x56c5
  } while (regs.fNZ);

  regs.xor(0x59);
  m.step(0x56cc, 7); // xor 0x59
  mem.write8(0xa9ab, regs.a);
  m.step(0x56cf, 13); // ld (0xa9ab),a

  m.step(0x0f1a, 10); // jp 0x0f1a -- TAIL, advances the sequence index
  return m.call(0x0f1a);
}
