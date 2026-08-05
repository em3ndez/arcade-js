// SPDX-License-Identifier: GPL-3.0-only

// loc_1271  (ROM 0x1271-0x12C6 + 0x12FB-0x1318, Time Pilot)
export function loc_1271(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad02);
  m.step(0x1274, 13); // ld a,(0xad02)

  regs.and(regs.a);
  m.step(0x1275, 4); // and a

  if (regs.fNZ) {
    m.ret(11); // ret nz taken
    return;
  }
  m.step(0x1276, 5); // ret nz not taken

  regs.a = mem.read8(0xacc6);
  m.step(0x1279, 13); // ld a,(0xacc6)

  regs.and(regs.a);
  m.step(0x127a, 4); // and a

  if (regs.fZ) {
    m.ret(11); // ret z taken -- the gate is not armed
    return;
  }
  m.step(0x127b, 5); // ret z not taken

  regs.hl = 0xa810;
  m.step(0x127e, 10); // ld hl,0xa810

  regs.de = 0x0010;
  m.step(0x1281, 10); // ld de,0x0010 -- the slot stride

  regs.b = 0x0f;
  m.step(0x1283, 7); // ld b,0x0f -- 15 slots

  for (;;) {
    regs.a = mem.read8(regs.hl);
    m.step(0x1284, 7); // ld a,(hl)

    regs.and(regs.a);
    m.step(0x1285, 4); // and a

    if (regs.fNZ) {
      m.ret(11); // ret nz taken -- this slot is still live
      return;
    }
    m.step(0x1286, 5); // ret nz not taken

    regs.addHl(regs.de);
    m.step(0x1287, 11); // add hl,de -- next slot

    if (regs.djnz() !== 0) {
      m.step(0x1283, 13); // djnz 0x1283 taken
      continue;
    }
    m.step(0x1289, 8); // djnz not taken
    break;
  }

  m.push16(0x128c);
  m.step(0x5634, 17); // call 0x5634
  m.call(0x5634);

  regs.a = mem.read8(0xad30);
  m.step(0x128f, 13); // ld a,(0xad30)

  regs.and(regs.a);
  m.step(0x1290, 4); // and a

  if (regs.fZ) {
    m.step(0x12bb, 12); // jr z,0x12bb taken

    regs.a = mem.read8(0x07d1); // a ROM byte: 0x00
    m.step(0x12be, 13); // ld a,(0x07d1)

    mem.write8(0xacc6, regs.a);
    m.step(0x12c1, 13); // ld (0xacc6),a -- disarm the gate

    m.push16(0x12c4);
    m.step(0x15b6, 17); // call 0x15b6
    m.call(0x15b6);

    m.step(0x12fb, 10); // jp 0x12fb -- over the table at 0x12C7-0x12E1 and the code at 0x12E2-0x12FA

    regs.xor(regs.a);
    m.step(0x12fc, 4); // xor a

    mem.write8(0xad30, regs.a);
    m.step(0x12ff, 13); // ld (0xad30),a

    mem.write8(0xa9ac, regs.a);
    m.step(0x1302, 13); // ld (0xa9ac),a

    mem.write8(0xad32, regs.a);
    m.step(0x1305, 13); // ld (0xad32),a

    regs.a = mem.read8(0x16d3); // a ROM byte: 0x01
    m.step(0x1308, 13); // ld a,(0x16d3)

    mem.write8(0xa9ab, regs.a);
    m.step(0x130b, 13); // ld (0xa9ab),a

    regs.a = mem.read8(0x4901); // a ROM byte: 0xA6
    m.step(0x130e, 13); // ld a,(0x4901)

    regs.hl = mem.read16(0x4902); // a ROM word: 0x3005
    m.step(0x1311, 16); // ld hl,(0x4902)

    m.push16(0x1312);
    m.step(0x0018, 11); // rst 0x18 -- HL += A, and A becomes the new L
    m.call(0x0018);

    regs.xor(regs.h);
    m.step(0x1313, 4); // xor h

    regs.sub(0x9b);
    m.step(0x1315, 7); // sub 0x9b -- the whole block folds to zero

    mem.write8(0xa9ac, regs.a);
    m.step(0x1318, 13); // ld (0xa9ac),a

    m.ret(); // 1318  ret
    return;
  }
  m.step(0x1292, 7); // jr z not taken

  regs.hl = 0xaa43;
  m.step(0x1295, 10); // ld hl,0xaa43

  regs.b = 0x17;
  m.step(0x1297, 7); // ld b,0x17 -- 23 entries

  regs.xor(regs.a);
  m.step(0x1298, 4); // xor a

  for (;;) {
    mem.write8(regs.hl, regs.a);
    m.step(0x1299, 7); // ld (hl),a

    regs.l = regs.inc8(regs.l);
    m.step(0x129a, 4); // inc l

    regs.l = regs.inc8(regs.l);
    m.step(0x129b, 4); // inc l -- stride 2, and L never leaves page 0xAA

    if (regs.djnz() !== 0) {
      m.step(0x1298, 13); // djnz 0x1298 taken
      continue;
    }
    m.step(0x129d, 8); // djnz not taken
    break;
  }

  m.push16(0x12a0);
  m.step(0x2db8, 17); // call 0x2db8
  m.call(0x2db8);

  regs.a = mem.read8(0xad32);
  m.step(0x12a3, 13); // ld a,(0xad32)

  regs.and(regs.a);
  m.step(0x12a4, 4); // and a -- the Z tested at 0x12A7

  regs.de = 0xad10;
  m.step(0x12a7, 10); // ld de,0xad10 -- flag-neutral, so the Z above survives

  if (regs.fZ) {
    m.step(0x12ac, 12); // jr z,0x12ac taken -- destination stays 0xAD10
  } else {
    m.step(0x12a9, 7); // jr z not taken
    regs.de = 0xad20;
    m.step(0x12ac, 10); // ld de,0xad20
  }

  regs.hl = 0xad00;
  m.step(0x12af, 10); // ld hl,0xad00

  regs.bc = 0x0010;
  m.step(0x12b2, 10); // ld bc,0x0010

  m.ldirAt(0x12b2, 0x12b4); // ldir -- 16 bytes 0xAD00 -> 0xAD10 or 0xAD20

  regs.a = mem.read8(0x4a35); // a ROM byte: 0x0D
  m.step(0x12b7, 13); // ld a,(0x4a35)

  mem.write8(0xa9ac, regs.a);
  m.step(0x12ba, 13); // ld (0xa9ac),a

  m.ret(); // 12ba  ret
}
