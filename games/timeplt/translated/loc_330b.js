// SPDX-License-Identifier: GPL-3.0-only

// loc_330b  (ROM 0x330B-0x3347, Time Pilot)
export function loc_330b(m) {
  const { regs, mem } = m;

  regs.hl = 0xa9eb;
  m.step(0x330e, 10); // ld hl,0xa9eb
  regs.decMem8(mem, regs.hl);
  m.step(0x330f, 11); // dec (hl)

  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- the timer has not expired
    return;
  }
  m.step(0x3310, 5); // ret nz NOT taken

  m.push16(0x3313);
  m.step(0x4cc3, 17); // call 0x4cc3
  m.call(0x4cc3);

  if (regs.fNC) {
    m.step(0x3326, 10); // jp nc,0x3326 TAKEN
  } else {
    m.step(0x3316, 10); // jp nc NOT taken

    regs.de = 0x0309;
    m.step(0x3319, 10); // ld de,0x0309

    m.push16(0x331a);
    m.step(0x0038, 11); // rst 0x38 -- enqueue D,E into the 0xAC00 ring
    m.call(0x0038);

    regs.e = 0x0b;
    m.step(0x331c, 7); // ld e,0x0b

    m.push16(0x331d);
    m.step(0x0038, 11); // rst 0x38 -- enqueue D,E again with the new E
    m.call(0x0038);

    regs.a = mem.read8(0x0843); // ROM
    m.step(0x3320, 13); // ld a,(0x0843)
    mem.write8(0xa9ac, regs.a);
    m.step(0x3323, 13); // ld (0xa9ac),a -- jump the sequencer to that sub-step

    m.step(0x12e7, 10); // jp 0x12e7 -- TAIL jump, nothing pushed
    return m.call(0x12e7);
  }

  m.push16(0x3329);
  m.step(0x583a, 17); // call 0x583a
  m.call(0x583a);

  regs.a = 0x00;
  m.step(0x332b, 7); // ld a,0x00
  mem.write8(0xad0c, regs.a);
  m.step(0x332e, 13); // ld (0xad0c),a
  regs.a = 0xf1;
  m.step(0x3330, 7); // ld a,0xf1
  mem.write8(0xad0b, regs.a);
  m.step(0x3333, 13); // ld (0xad0b),a

  m.push16(0x3336);
  m.step(0x01e1, 17); // call 0x01e1
  m.call(0x01e1);

  regs.b = 0x00;
  m.step(0x3338, 7); // ld b,0x00 -- 256 iterations, not zero
  regs.hl = 0x01f1;
  m.step(0x333b, 10); // ld hl,0x01f1
  regs.xor(regs.a);
  m.step(0x333c, 4); // xor a -- clears the running total and the carry

  for (;;) {
    regs.add(mem.read8(regs.hl));
    m.step(0x333d, 7); // add a,(hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x333e, 6); // inc hl
    if (regs.djnz() !== 0) {
      m.step(0x333c, 13); // djnz 0x333c taken
      continue;
    }
    m.step(0x3340, 8); // djnz NOT taken
    break;
  }

  regs.sub(0x19);
  m.step(0x3342, 7); // sub 0x19 -- Z iff the block still checksums

  if (regs.fNZ) {
    m.push16(0x3345);
    m.step(0x0f11, 17); // call nz,0x0f11 taken -- checksum FAILED, derail the sequencer
    m.call(0x0f11);
  } else {
    m.step(0x3345, 10); // call nz NOT taken -- the ROM checks out
  }

  m.step(0x0f1a, 10); // jp 0x0f1a -- TAIL jump, nothing pushed
  return m.call(0x0f1a);
}
