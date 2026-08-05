// SPDX-License-Identifier: GPL-3.0-only

// loc_5866  (ROM 0x5866-0x58A3, Time Pilot)
export function loc_5866(m) {
  const { regs, mem } = m;

  regs.hl = mem.read16(0x2581); // = 0xA000
  m.step(0x5869, 16); // ld hl,(0x2581)
  regs.bc = 0x0400;
  m.step(0x586c, 10); // ld bc,0x0400
  regs.d = 0x10;
  m.step(0x586e, 7); // ld d,0x10

  for (;;) {
    mem.write8(regs.hl, regs.d);
    m.step(0x586f, 7); // ld (hl),d
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x5870, 6); // inc hl
    regs.bc = (regs.bc - 1) & 0xffff;
    m.step(0x5871, 6); // dec bc -- 16-bit dec sets NO flags
    regs.a = regs.c;
    m.step(0x5872, 4); // ld a,c
    regs.or(regs.b);
    m.step(0x5873, 4); // or b -- Z iff BC == 0
    if (regs.fNZ) {
      m.step(0x586e, 12); // jr nz,0x586e taken
      continue;
    }
    m.step(0x5875, 7); // jr nz NOT taken
    break;
  }

  mem.write8(0xc200, regs.a, 10); // A == 0
  m.step(0x5878, 13); // ld (0xc200),a -- watchdog

  regs.hl = mem.read16(0x4a37); // = 0xA400
  m.step(0x587b, 16); // ld hl,(0x4a37)
  regs.bc = 0x0400;
  m.step(0x587e, 10); // ld bc,0x0400
  regs.d = 0xf1;
  m.step(0x5880, 7); // ld d,0xf1

  for (;;) {
    mem.write8(regs.hl, regs.d);
    m.step(0x5881, 7); // ld (hl),d
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x5882, 6); // inc hl
    regs.bc = (regs.bc - 1) & 0xffff;
    m.step(0x5883, 6); // dec bc
    regs.a = regs.c;
    m.step(0x5884, 4); // ld a,c
    regs.or(regs.b);
    m.step(0x5885, 4); // or b
    if (regs.fNZ) {
      m.step(0x5880, 12); // jr nz,0x5880 taken
      continue;
    }
    m.step(0x5887, 7); // jr nz NOT taken
    break;
  }

  regs.hl = 0x0000;
  m.step(0x588a, 10); // ld hl,0x0000
  regs.a = mem.read8(0x0000);
  m.step(0x588d, 13); // ld a,(0x0000) -- the seed

  for (;;) {
    regs.add(mem.read8(regs.hl));
    m.step(0x588e, 7); // add a,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x588f, 6); // inc hl
    regs.exAf(); // AF <-> AF'; the running total is parked
    m.step(0x5890, 4); // ex af,af'
    regs.a = regs.h;
    m.step(0x5891, 4); // ld a,h
    regs.cp(0x60);
    m.step(0x5893, 7); // cp 0x60 -- 0x6000 is one past the ROM
    if (regs.fNC) {
      m.step(0x589b, 12); // jr nc,0x589b taken -- done
      break;
    }
    m.step(0x5895, 7); // jr nc NOT taken
    regs.exAf();
    m.step(0x5896, 4); // ex af,af' -- the total is back in A
    mem.write8(0xc200, regs.a, 10); // the port ignores the value
    m.step(0x5899, 13); // ld (0xc200),a -- watchdog, once per ROM byte
    m.step(0x588d, 12); // jr 0x588d
  }

  regs.exAf();
  m.step(0x589c, 4); // ex af,af' -- the total is back in A
  regs.sub(0xaf);
  m.step(0x589e, 7); // sub 0xaf -- Z on a genuine image
  if (regs.fNZ) {
    m.step(0x59d7, 10); // jp nz,0x59d7 taken -- CHECKSUM FAILED; 0x59d7 is DATA
    return m.call(0x59d7);
  }
  m.step(0x58a1, 10); // jp nz NOT taken

  m.step(0x2511, 10); // jp 0x2511 -- TAIL jump, nothing pushed
  return m.call(0x2511);
}
