// SPDX-License-Identifier: GPL-3.0-only

// loc_335e  (ROM 0x335E-0x339B, Time Pilot)
export function loc_335e(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa9ab);
  m.step(0x3361, 13); // ld a,(0xa9ab)
  regs.hl = 0x178c;
  m.step(0x3364, 10); // ld hl,0x178c
  regs.b = 0x1e;
  m.step(0x3366, 7); // ld b,0x1e

  for (;;) {
    regs.add(mem.read8(regs.hl));
    m.step(0x3367, 7); // add a,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x3368, 6); // inc hl
    if (regs.djnz() !== 0) {
      m.step(0x3366, 13); // djnz 0x3366 taken
      continue;
    }
    m.step(0x336a, 8); // djnz NOT taken
    break;
  }

  regs.add(0x2c);
  m.step(0x336c, 7); // add a,0x2c -- net zero on a genuine image
  mem.write8(0xa9ab, regs.a);
  m.step(0x336f, 13); // ld (0xa9ab),a

  regs.a = mem.read8(0xad32);
  m.step(0x3372, 13); // ld a,(0xad32)
  regs.and(regs.a);
  const zero = regs.fZ; // the two instructions before the jr are flag-neutral
  m.step(0x3373, 4); // and a
  regs.de = 0xad1b;
  m.step(0x3376, 10); // ld de,0xad1b
  regs.a = mem.read8(0xad14);
  m.step(0x3379, 13); // ld a,(0xad14)

  if (zero) {
    m.step(0x3381, 12); // jr z,0x3381 taken -- keep the 0xAD1B/0xAD14 pair
  } else {
    m.step(0x337b, 7); // jr z NOT taken
    regs.de = 0xad2b;
    m.step(0x337e, 10); // ld de,0xad2b
    regs.a = mem.read8(0xad24);
    m.step(0x3381, 13); // ld a,(0xad24)
  }

  regs.add(regs.a);
  m.step(0x3382, 4); // add a,a -- x2, the 0x0F8D entry stride
  regs.hl = 0x0f8d;
  m.step(0x3385, 10); // ld hl,0x0f8d

  m.push16(0x3386);
  m.step(0x0008, 11); // rst 0x08 -- A = (0x0f8d + A); HL left at that byte
  m.call(0x0008);

  mem.write8(regs.de, regs.a);
  m.step(0x3387, 7); // ld (de),a -- entry byte 0
  mem.write8(0xad0b, regs.a);
  m.step(0x338a, 13); // ld (0xad0b),a
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x338b, 6); // inc hl
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x338c, 6); // inc de
  regs.a = mem.read8(regs.hl);
  m.step(0x338d, 7); // ld a,(hl) -- entry byte 1
  mem.write8(regs.de, regs.a);
  m.step(0x338e, 7); // ld (de),a
  regs.hl = 0xad0c;
  m.step(0x3391, 10); // ld hl,0xad0c
  regs.cp(mem.read8(regs.hl));
  m.step(0x3392, 7); // cp (hl) -- Z iff byte 1 is unchanged
  mem.write8(regs.hl, regs.a); // ld (hl),a -- no flags, the cp's Z survives
  m.step(0x3393, 7); // ld (hl),a

  if (regs.fZ) {
    m.push16(0x3396);
    m.step(0x0f1a, 17); // call z,0x0f1a taken -- an extra sub-step
    m.call(0x0f1a);
  } else {
    m.step(0x3396, 10); // call z NOT taken
  }

  m.push16(0x3399);
  m.step(0x01e1, 17); // call 0x01e1
  m.call(0x01e1);

  m.step(0x0f1a, 10); // jp 0x0f1a -- TAIL jump, nothing pushed
  return m.call(0x0f1a);
}
