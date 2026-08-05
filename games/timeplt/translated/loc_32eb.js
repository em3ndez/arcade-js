// SPDX-License-Identifier: GPL-3.0-only

// loc_32eb  (ROM 0x32EB-0x330A, Time Pilot)
export function loc_32eb(m) {
  const { regs, mem } = m;

  mem.write8(0xc200, regs.a, 10);
  m.step(0x32ee, 13); // ld (0xc200),a -- watchdog
  regs.hl = 0xa9eb;
  m.step(0x32f1, 10); // ld hl,0xa9eb
  mem.write8(regs.hl, 0x0c);
  m.step(0x32f3, 10); // ld (hl),0x0c -- 12 outer passes

  for (;;) {
    regs.bc = 0x0000;
    m.step(0x32f6, 10); // ld bc,0x0000

    for (;;) {
      while (regs.djnz() !== 0) {
        m.step(0x32f6, 13); // djnz 0x32f6 taken -- no flags
      }
      m.step(0x32f8, 8); // djnz NOT taken

      mem.write8(0xc200, regs.a, 10);
      m.step(0x32fb, 13); // ld (0xc200),a -- watchdog
      regs.c = regs.dec8(regs.c);
      m.step(0x32fc, 4); // dec c
      if (regs.fNZ) {
        m.step(0x32f6, 12); // jr nz,0x32f6 taken
        continue;
      }
      m.step(0x32fe, 7); // jr nz NOT taken
      break;
    }

    regs.decMem8(mem, regs.hl);
    m.step(0x32ff, 11); // dec (hl) -- one outer pass consumed
    if (regs.fNZ) {
      m.step(0x32f3, 12); // jr nz,0x32f3 taken
      continue;
    }
    m.step(0x3301, 7); // jr nz NOT taken
    break;
  }

  regs.xor(regs.a);
  m.step(0x3302, 4); // xor a

  m.push16(0x3305);
  m.step(0x55f8, 17); // call 0x55f8
  m.call(0x55f8);

  regs.a = mem.read8(0x4c87); // ROM
  m.step(0x3308, 13); // ld a,(0x4c87)

  m.step(0x00a8, 10); // jp 0x00a8 -- TAIL jump, nothing pushed
  return m.call(0x00a8);
}
