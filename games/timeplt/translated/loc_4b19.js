// SPDX-License-Identifier: GPL-3.0-only

// loc_4b19  (ROM 0x4B19-0x4B2F, Time Pilot)
export function loc_4b19(m) {
  const { regs, mem } = m;

  regs.de = 0x0bcc;
  m.step(0x4b1c, 10); // ld de,0x0bcc -- start of the checksummed block
  regs.bc = 0x0089;
  m.step(0x4b1f, 10); // ld bc,0x0089 -- C = seed 0x89, B = 0 => 256 iterations
  regs.a = mem.read8(0x1a50);
  m.step(0x4b22, 13); // ld a,(0x1a50) -- the expected total
  regs.h = regs.a;
  m.step(0x4b23, 4); // ld h,a

  for (;;) {
    regs.a = mem.read8(regs.de);
    m.step(0x4b24, 7); // ld a,(de)
    regs.add(regs.c);
    m.step(0x4b25, 4); // add a,c
    regs.c = regs.a;
    m.step(0x4b26, 4); // ld c,a -- running total
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x4b27, 6); // inc de
    if (regs.djnz() !== 0) {
      m.step(0x4b23, 13); // djnz 0x4b23 taken
      continue;
    }
    m.step(0x4b29, 8); // djnz NOT taken
    break;
  }

  regs.sub(regs.h);
  m.step(0x4b2a, 4); // sub h -- A still holds the total; Z iff it matches (0x1A50)

  if (regs.fNZ) {
    m.push16(0x4b2d);
    m.step(0x0f11, 17); // call nz,0x0f11 taken -- checksum FAILED
    m.call(0x0f11);
  } else {
    m.step(0x4b2d, 10); // call nz NOT taken
  }

  m.step(0x0f1a, 10); // jp 0x0f1a -- tail-jump
  return m.call(0x0f1a);
}
