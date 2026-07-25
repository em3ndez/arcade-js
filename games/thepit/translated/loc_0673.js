// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0673  (ROM 0x0673-0x06AB) — paints a full screen: copies the tilemap into
 * video RAM (0x9000) and the colour map into colour RAM (0x8800) from ROM tables,
 * the tilemap source chosen by bit 0 of 0x8028, runs three follow-up setup
 * routines, and arms the screen-state counter 0x805C = 1.
 *
 *   0673  3e 01        ld   a,0x01
 *   0675  cd ff 4b     call 0x4bff
 *   0678  11 00 90     ld   de,0x9000
 *   067b  21 62 07     ld   hl,0x0762
 *   067e  3a 28 80     ld   a,(0x8028)
 *   0681  cb 47        bit  0,a
 *   0683  20 03        jr   nz,0x0688
 *   0685  21 62 0b     ld   hl,0x0b62
 * loc_0688:
 *   0688  01 00 04     ld   bc,0x0400
 *   068b  ed b0        ldir
 *   068d  3e 01        ld   a,0x01
 *   068f  cd ff 4b     call 0x4bff
 *   0692  11 00 88     ld   de,0x8800
 *   0695  21 62 0f     ld   hl,0x0f62
 *   0698  01 00 04     ld   bc,0x0400
 *   069b  ed b0        ldir
 *   069d  cd f4 46     call 0x46f4
 *   06a0  cd 2c 47     call 0x472c
 *   06a3  cd a1 47     call 0x47a1
 *   06a6  3e 01        ld   a,0x01
 *   06a8  32 5c 80     ld   (0x805c),a
 *   06ab  c9           ret
 *
 * The 0x8028 bit-0 test selects which 0x400-byte tilemap table (0x0762 vs 0x0b62)
 * is copied to video RAM; the colour source (0x0f62) is fixed. The `call 0x4bff`
 * before each copy is a bank/setup call the tilemap table depends on. Returns
 * normally: one unconditional `ret`, stack balanced.
 */
export function loc_0673(m) {
  const { regs, mem } = m;

  regs.a = 0x01;
  m.step(0x0675, 7); // 0673  ld a,0x01

  m.push16(0x0678);
  m.step(0x4bff, 17); // 0675  call 0x4bff
  m.call(0x4bff);

  regs.de = 0x9000;
  m.step(0x067b, 10); // 0678  ld de,0x9000

  regs.hl = 0x0762;
  m.step(0x067e, 10); // 067b  ld hl,0x0762

  regs.a = mem.read8(0x8028);
  m.step(0x0681, 13); // 067e  ld a,(0x8028)

  regs.bit(0, regs.a);
  m.step(0x0683, 8); // 0681  bit 0,a

  // 0683  jr nz,0x0688 -- taken (bit 0 set) keeps HL=0x0762; else fall through
  if (regs.fNZ) {
    m.step(0x0688, 12); // jr taken
  } else {
    m.step(0x0685, 7); // jr not taken
    regs.hl = 0x0b62;
    m.step(0x0688, 10); // 0685  ld hl,0x0b62
  }

  // loc_0688:
  regs.bc = 0x0400;
  m.step(0x068b, 10); // 0688  ld bc,0x0400

  m.ldirAt(0x068b, 0x068d); // 068b  ldir -- copy 0x400 bytes to video RAM

  regs.a = 0x01;
  m.step(0x068f, 7); // 068d  ld a,0x01

  m.push16(0x0692);
  m.step(0x4bff, 17); // 068f  call 0x4bff
  m.call(0x4bff);

  regs.de = 0x8800;
  m.step(0x0695, 10); // 0692  ld de,0x8800

  regs.hl = 0x0f62;
  m.step(0x0698, 10); // 0695  ld hl,0x0f62

  regs.bc = 0x0400;
  m.step(0x069b, 10); // 0698  ld bc,0x0400

  m.ldirAt(0x069b, 0x069d); // 069b  ldir -- copy 0x400 bytes to colour RAM

  m.push16(0x06a0);
  m.step(0x46f4, 17); // 069d  call 0x46f4
  m.call(0x46f4);

  m.push16(0x06a3);
  m.step(0x472c, 17); // 06a0  call 0x472c
  m.call(0x472c);

  m.push16(0x06a6);
  m.step(0x47a1, 17); // 06a3  call 0x47a1
  m.call(0x47a1);

  regs.a = 0x01;
  m.step(0x06a8, 7); // 06a6  ld a,0x01

  mem.write8(0x805c, regs.a);
  m.step(0x06ab, 13); // 06a8  ld (0x805c),a

  m.ret(); // 06ab  ret -- unconditional, 10 T
}
