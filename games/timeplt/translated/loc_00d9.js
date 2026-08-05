// SPDX-License-Identifier: GPL-3.0-only

// loc_00d9  (ROM 0x00D9-0x015E, Time Pilot)
export function loc_00d9(m) {
  const { regs, mem } = m;

  m.push16(regs.bc);
  m.step(0x00da, 11); // push bc
  m.push16(regs.de);
  m.step(0x00db, 11); // push de
  m.push16(regs.hl);
  m.step(0x00dc, 11); // push hl
  regs.exAf();
  m.step(0x00dd, 4); // ex af,af'
  regs.exx();
  m.step(0x00de, 4); // exx
  m.push16(regs.af);
  m.step(0x00df, 11); // push af  (the shadow set, now current)
  m.push16(regs.bc);
  m.step(0x00e0, 11); // push bc
  m.push16(regs.de);
  m.step(0x00e1, 11); // push de
  m.push16(regs.hl);
  m.step(0x00e2, 11); // push hl
  m.push16(regs.ix);
  m.step(0x00e4, 15); // push ix
  m.push16(regs.iy);
  m.step(0x00e6, 15); // push iy

  m.push16(0x00e9);
  m.step(0x0365, 17); // call 0x0365
  m.call(0x0365);

  m.push16(0x00ec);
  m.step(0x5286, 17); // call 0x5286
  m.call(0x5286);

  regs.xor(regs.a);
  m.step(0x00ed, 4); // xor a
  mem.write8(0xc300, regs.a, 10);
  m.step(0x00f0, 13); // ld (0xc300),a -- LS259 offset 0, NMI disarmed
  mem.write8(0xc200, regs.a, 10);
  m.step(0x00f3, 13); // ld (0xc200),a -- watchdog
  regs.a = regs.inc8(regs.a);
  m.step(0x00f4, 4); // inc a -- A = 1
  mem.write8(0xa987, regs.a);
  m.step(0x00f7, 13); // ld (0xa987),a
  regs.a = mem.read8(0xad32);
  m.step(0x00fa, 13); // ld a,(0xad32)
  regs.and(regs.a);
  m.step(0x00fb, 4); // and a

  if (regs.fZ) {
    m.step(0x0106, 12); // jr z,0x0106 taken -- keep (0xa987) = 1
  } else {
    m.step(0x00fd, 7); // jr z (not taken)
    regs.a = mem.read8(0xa9c2);
    m.step(0x0100, 13); // ld a,(0xa9c2)
    regs.and(regs.a);
    m.step(0x0101, 4); // and a
    if (regs.fNZ) {
      m.step(0x0106, 12); // jr nz,0x0106 taken -- keep (0xa987) = 1
    } else {
      m.step(0x0103, 7); // jr nz (not taken)
      mem.write8(0xa987, regs.a); // A is 0 here
      m.step(0x0106, 13); // ld (0xa987),a
    }
  }

  regs.a = mem.read8(0xa987);
  m.step(0x0109, 13); // ld a,(0xa987)
  mem.write8(0xc302, regs.a, 10);
  m.step(0x010c, 13); // ld (0xc302),a -- LS259 offset 2

  regs.a = mem.read8(0xc200); // DSW1
  m.step(0x010f, 13); // ld a,(0xc200)
  regs.cpl();
  m.step(0x0110, 4); // cpl
  mem.write8(0xa9ad, regs.a);
  m.step(0x0113, 13); // ld (0xa9ad),a

  regs.a = mem.read8(0xc300); // IN0
  m.step(0x0116, 13); // ld a,(0xc300)
  regs.cpl();
  m.step(0x0117, 4); // cpl
  mem.write8(0xa9ae, regs.a);
  m.step(0x011a, 13); // ld (0xa9ae),a

  regs.a = mem.read8(0xc320); // IN1
  m.step(0x011d, 13); // ld a,(0xc320)
  regs.cpl();
  m.step(0x011e, 4); // cpl
  mem.write8(0xa9af, regs.a);
  m.step(0x0121, 13); // ld (0xa9af),a

  regs.a = mem.read8(0xc340); // IN2
  m.step(0x0124, 13); // ld a,(0xc340)
  regs.cpl();
  m.step(0x0125, 4); // cpl
  mem.write8(0xa9b0, regs.a);
  m.step(0x0128, 13); // ld (0xa9b0),a

  regs.a = mem.read8(0xc360); // DSW0
  m.step(0x012b, 13); // ld a,(0xc360)
  regs.cpl();
  m.step(0x012c, 4); // cpl
  mem.write8(0xa9b1, regs.a);
  m.step(0x012f, 13); // ld (0xa9b1),a

  regs.hl = 0xa980;
  m.step(0x0132, 10); // ld hl,0xa980
  regs.incMem8(mem, regs.hl);
  m.step(0x0133, 11); // inc (hl) -- free-running frame counter

  regs.hl = 0xa9ce;
  m.step(0x0136, 10); // ld hl,0xa9ce
  regs.a = mem.read8(regs.hl);
  m.step(0x0137, 7); // ld a,(hl)
  regs.a = regs.inc8(regs.a);
  m.step(0x0138, 4); // inc a
  regs.daa();
  m.step(0x0139, 4); // daa -- BCD carry into the high nibble
  mem.write8(regs.hl, regs.a);
  m.step(0x013a, 7); // ld (hl),a

  regs.hl = 0xa817;
  m.step(0x013d, 10); // ld hl,0xa817
  regs.a = mem.read8(regs.hl);
  m.step(0x013e, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x013f, 4); // and a
  if (regs.fZ) {
    m.step(0x0142, 12); // jr z,0x0142 taken -- already 0, leave it
  } else {
    m.step(0x0141, 7); // jr z (not taken)
    regs.decMem8(mem, regs.hl);
    m.step(0x0142, 11); // dec (hl)
  }

  regs.hl = 0xa812;
  m.step(0x0145, 10); // ld hl,0xa812
  regs.a = mem.read8(regs.hl);
  m.step(0x0146, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x0147, 4); // and a
  if (regs.fZ) {
    m.step(0x014a, 12); // jr z,0x014a taken
  } else {
    m.step(0x0149, 7); // jr z (not taken)
    regs.decMem8(mem, regs.hl);
    m.step(0x014a, 11); // dec (hl)
  }

  regs.hl = 0xa8f4;
  m.step(0x014d, 10); // ld hl,0xa8f4
  regs.a = mem.read8(regs.hl);
  m.step(0x014e, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x014f, 4); // and a
  if (regs.fZ) {
    m.step(0x0152, 12); // jr z,0x0152 taken
  } else {
    m.step(0x0151, 7); // jr z (not taken)
    regs.decMem8(mem, regs.hl);
    m.step(0x0152, 11); // dec (hl)
  }

  m.push16(0x0155);
  m.step(0x48be, 17); // call 0x48be
  m.call(0x48be);

  regs.hl = 0x0174;
  m.step(0x0158, 10); // ld hl,0x0174 -- the epilogue address
  m.push16(regs.hl);
  m.step(0x0159, 11); // push hl -- the dispatched arm's ret lands on 0x0174
  regs.a = mem.read8(0xa9ab);
  m.step(0x015c, 13); // ld a,(0xa9ab)
  regs.and(0x03);
  m.step(0x015e, 7); // and 0x03 -- A is the table index

  m.push16(0x015f); // rst 0x30 pushes the address AFTER it -- the table base
  m.step(0x0030, 11); // rst 0x30
  m.call(0x0030, "0x015f ((0xa9ab)&3 NMI sub-state)"); // inline jump table dispatch

  return m.call(0x0174);
}
