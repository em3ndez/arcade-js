// SPDX-License-Identifier: GPL-3.0-only

// loc_1253  (ROM 0x1253-0x1318, Time Pilot)
export function loc_1253(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad30);
  m.step(0x1256, 13); // ld a,(0xad30)
  regs.and(regs.a);
  m.step(0x1257, 4); // and a -- zero test

  if (regs.fZ) {
    m.step(0x12fb, 10); // jp z,0x12fb

    regs.xor(regs.a);
    m.step(0x12fc, 4); // xor a
    mem.write8(0xad30, regs.a);
    m.step(0x12ff, 13); // ld (0xad30),a
    mem.write8(0xa9ac, regs.a);
    m.step(0x1302, 13); // ld (0xa9ac),a
    mem.write8(0xad32, regs.a);
    m.step(0x1305, 13); // ld (0xad32),a

    regs.a = mem.read8(0x16d3);
    m.step(0x1308, 13); // ld a,(0x16d3) -- a constant living inside the code image
    mem.write8(0xa9ab, regs.a);
    m.step(0x130b, 13); // ld (0xa9ab),a

    regs.a = mem.read8(0x4901);
    m.step(0x130e, 13); // ld a,(0x4901)
    regs.hl = mem.read16(0x4902);
    m.step(0x1311, 16); // ld hl,(0x4902)

    m.push16(0x1312);
    m.step(0x0018, 11); // rst 0x18 -- HL += A, A = the low sum
    m.call(0x0018);

    regs.xor(regs.h);
    m.step(0x1313, 4); // xor h
    regs.sub(0x9b);
    m.step(0x1315, 7); // sub 0x9b -- the block folds to zero
    mem.write8(0xa9ac, regs.a);
    m.step(0x1318, 13); // ld (0xa9ac),a

    m.ret(10); // 1318  ret
    return;
  }
  m.step(0x125a, 10); // jp z -- not taken

  regs.de = 0x0209;
  m.step(0x125d, 10); // ld de,0x0209
  regs.a = mem.read8(0xad32);
  m.step(0x1260, 13); // ld a,(0xad32)
  regs.and(regs.a);
  m.step(0x1261, 4); // and a -- zero test

  if (regs.fZ) {
    m.step(0x1264, 12); // jr z,0x1264 -- keep 0x0209
  } else {
    m.step(0x1263, 7); // jr z -- not taken
    regs.e = regs.inc8(regs.e);
    m.step(0x1264, 4); // inc e -- 0x0209 becomes 0x020a
  }

  m.push16(0x1265);
  m.step(0x0038, 11); // rst 0x38 -- append DE to the 0xAC00 ring
  m.call(0x0038);

  regs.de = 0x0a0b;
  m.step(0x1268, 10); // ld de,0x0a0b

  m.push16(0x1269);
  m.step(0x0038, 11); // rst 0x38 -- append DE
  m.call(0x0038);

  regs.a = 0xb4;
  m.step(0x126b, 7); // ld a,0xb4
  mem.write8(0xa9eb, regs.a);
  m.step(0x126e, 13); // ld (0xa9eb),a

  m.step(0x0f1a, 10); // jp 0x0f1a -- TAIL
  return m.call(0x0f1a);
}
