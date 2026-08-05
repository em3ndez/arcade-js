// SPDX-License-Identifier: GPL-3.0-only

// loc_08b4  (ROM 0x08B4-0x08F9, Time Pilot)
export function loc_08b4(m) {
  const { regs, mem } = m;

  m.push16(0x08b7);
  m.step(0x0201, 17); // call 0x0201
  m.call(0x0201);

  if (regs.fNZ) {
    m.ret(11); // 08b7  ret nz (taken) -- the gate is closed this tick
    return;
  }
  m.step(0x08b8, 5); // ret nz (not taken)

  regs.b = 0x00;
  m.step(0x08ba, 7); // ld b,0x00 -- 256 iterations
  regs.hl = 0x4880;
  m.step(0x08bd, 10); // ld hl,0x4880
  regs.sub(regs.a);
  m.step(0x08be, 4); // sub a -- running XOR = 0

  for (;;) {
    regs.xor(mem.read8(regs.hl));
    m.step(0x08bf, 7); // xor (hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x08c0, 6); // inc hl
    if (regs.djnz() !== 0) {
      m.step(0x08be, 13); // djnz 0x08be taken
      continue;
    }
    m.step(0x08c2, 8); // djnz NOT taken
    break;
  }

  regs.add(0xd0);
  m.step(0x08c4, 7); // add a,0xd0 -- Z iff the XOR came out 0x30

  if (regs.fNZ) {
    m.step(0x00d9, 10); // jp nz,0x00d9 -- checksum FAILED
    return m.call(0x00d9);
  }
  m.step(0x08c7, 10); // jp nz NOT taken (jp costs 10 either way)

  regs.de = 0x0113;
  m.step(0x08ca, 10); // ld de,0x0113
  m.push16(0x08cb);
  m.step(0x0038, 11); // rst 0x38 -- queue (0x01,0x13)
  m.call(0x0038);

  regs.e = 0x00;
  m.step(0x08cd, 7); // ld e,0x00
  m.push16(0x08ce);
  m.step(0x0038, 11); // rst 0x38 -- queue (0x01,0x00)
  m.call(0x0038);

  regs.e = 0x14;
  m.step(0x08d0, 7); // ld e,0x14
  m.push16(0x08d1);
  m.step(0x0038, 11); // rst 0x38 -- queue (0x01,0x14)
  m.call(0x0038);

  regs.e = regs.inc8(regs.e);
  m.step(0x08d2, 4); // inc e
  m.push16(0x08d3);
  m.step(0x0038, 11); // rst 0x38 -- queue (0x01,0x15)
  m.call(0x0038);

  regs.e = 0x0c;
  m.step(0x08d5, 7); // ld e,0x0c
  m.push16(0x08d6);
  m.step(0x0038, 11); // rst 0x38 -- queue (0x01,0x0c)
  m.call(0x0038);

  m.push16(0x08d9);
  m.step(0x4bdc, 17); // call 0x4bdc
  m.call(0x4bdc);

  regs.hl = 0xa995;
  m.step(0x08dc, 10); // ld hl,0xa995
  regs.xor(regs.a);
  m.step(0x08dd, 4); // xor a
  regs.b = 0x05;
  m.step(0x08df, 7); // ld b,0x05

  for (;;) {
    mem.write8(regs.hl, regs.a);
    m.step(0x08e0, 7); // ld (hl),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x08e1, 6); // inc hl
    if (regs.djnz() !== 0) {
      m.step(0x08df, 13); // djnz 0x08df taken
      continue;
    }
    m.step(0x08e3, 8); // djnz NOT taken -- HL has reached 0xA99A
    break;
  }

  mem.write8(regs.hl, 0x03);
  m.step(0x08e5, 10); // ld (hl),0x03

  regs.de = mem.read8(0xa993) | (mem.read8(0xa994) << 8);
  m.step(0x08e9, 20); // ld de,(0xa993) -- the destination cell
  regs.a = mem.read8(0xa999);
  m.step(0x08ec, 13); // ld a,(0xa999) -- the table index
  regs.hl = 0x12c7;
  m.step(0x08ef, 10); // ld hl,0x12c7

  m.push16(0x08f0);
  m.step(0x0008, 11); // rst 0x08 -- A = (HL + A)
  m.call(0x0008);

  mem.write8(regs.de, regs.a, 4);
  m.step(0x08f1, 7); // ld (de),a -- the glyph, into video RAM
  regs.d = regs.res(2, regs.d); // res/set do not affect flags
  m.step(0x08f3, 8); // res 2,d -- same cell in COLOUR RAM
  regs.a = mem.read8(regs.de);
  m.step(0x08f4, 7); // ld a,(de) -- that cell's colour
  mem.write8(0xa990, regs.a);
  m.step(0x08f7, 13); // ld (0xa990),a

  m.step(0x0f1a, 10); // jp 0x0f1a
  return m.call(0x0f1a);
}
