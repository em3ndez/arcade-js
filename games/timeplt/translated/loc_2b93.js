// SPDX-License-Identifier: GPL-3.0-only

// loc_2b93  (ROM 0x2B93-0x2BB3, Time Pilot)
export function loc_2b93(m) {
  const { regs, mem } = m;
  const IX = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(IX(0x00));
  m.step(0x2b96, 19); // ld a,(ix+0x00)
  regs.cp(0xf0);
  m.step(0x2b98, 7); // cp 0xf0

  if (regs.fZ) {
    m.step(0x2bac, 10); // jp z,0x2bac taken

    mem.write8(IX(0x00), 0x3b);
    m.step(0x2bb0, 19); // ld (ix+0x00),0x3b

    m.push16(0x2bb3);
    m.step(0x2bba, 17); // call 0x2bba
    m.call(0x2bba);

    m.ret(); // 2bb3  ret
    return;
  }
  m.step(0x2b9b, 10); // jp z NOT taken

  regs.cp(0x3c);
  m.step(0x2b9d, 7); // cp 0x3c

  if (regs.fZ) {
    m.push16(0x2ba0);
    m.step(0x2bba, 17); // call z,0x2bba taken
    m.call(0x2bba);
  } else {
    m.step(0x2ba0, 10); // call z NOT taken
  }

  if (regs.fNC) {
    m.step(0x2bb4, 10); // jp nc,0x2bb4 taken -- TAIL transfer, nothing pushed
    return m.call(0x2bb4);
  }
  m.step(0x2ba3, 10); // jp nc NOT taken

  regs.decMem8(mem, IX(0x00));
  m.step(0x2ba6, 23); // dec (ix+0x00)

  if (regs.fZ) {
    m.step(0x2bde, 12); // jr z,0x2bde taken -- TAIL transfer, nothing pushed
    return m.call(0x2bde);
  }
  m.step(0x2ba8, 7); // jr z NOT taken

  m.push16(0x2bab);
  m.step(0x2c22, 17); // call 0x2c22
  m.call(0x2c22);

  m.ret(); // 2bab  ret
}
