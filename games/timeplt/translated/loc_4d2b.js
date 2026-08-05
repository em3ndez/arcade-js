// SPDX-License-Identifier: GPL-3.0-only

// loc_4d2b  (ROM 0x4D2B-0x4D39)
export function loc_4d2b(m) {
  const { regs, mem } = m;

  regs.c = 0x03;
  m.step(0x4d2d, 7); // 4d2b  ld c,0x03

  for (;;) {
    regs.a = mem.read8(regs.de);
    m.step(0x4d2e, 7); // 4d2d  ld a,(de)
    regs.cp(mem.read8(regs.hl));
    m.step(0x4d2f, 7); // 4d2e  cp (hl)

    if (regs.fC) {
      m.ret(11); // 4d2f  ret c (taken) -- DE < HL
      return;
    }
    m.step(0x4d30, 5); // 4d2f  ret c (not taken)

    if (regs.fNZ) {
      m.step(0x4d37, 12); // 4d30  jr nz,0x4d37 (taken) -- DE > HL
      break;
    }
    m.step(0x4d32, 7); // 4d30  jr nz (not taken) -- this byte is equal

    regs.de = (regs.de - 1) & 0xffff;
    m.step(0x4d33, 6); // 4d32  dec de -- 16-bit, no flags
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x4d34, 6); // 4d33  dec hl -- 16-bit, no flags
    regs.c = regs.dec8(regs.c);
    m.step(0x4d35, 4); // 4d34  dec c

    if (regs.fNZ) {
      m.step(0x4d2d, 12); // 4d35  jr nz,0x4d2d (taken)
      continue;
    }
    m.step(0x4d37, 7); // 4d35  jr nz (not taken) -- all three equal
    break;
  }

  regs.scf();
  m.step(0x4d38, 4); // 4d37  scf
  regs.ccf();
  m.step(0x4d39, 4); // 4d38  ccf -- carry back to 0, H now 1

  m.ret(); // 4d39  ret
}
