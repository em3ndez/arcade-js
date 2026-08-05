// SPDX-License-Identifier: GPL-3.0-only

// loc_1f42  (ROM 0x1F42-0x1F54, Time Pilot)
export function loc_1f42(m) {
  const { regs, mem } = m;

  regs.hl = 0x1f55;
  m.step(0x1f45, 10); // ld hl,0x1f55 -- the continuation address
  m.push16(regs.hl);
  m.step(0x1f46, 11); // push hl

  regs.a = mem.read8(0xad04);
  m.step(0x1f49, 13); // ld a,(0xad04)
  regs.and(regs.a);
  m.step(0x1f4a, 4); // and a

  if (regs.fZ) {
    m.step(0x594e, 10); // jp z,0x594e taken

    regs.hl = 0x5e00;
    m.step(0x5951, 10); // ld hl,0x5e00
    m.step(0x596e, 10); // jp 0x596e
  } else {
    m.step(0x1f4d, 10); // jp z NOT taken

    regs.cp(0x03);
    m.step(0x1f4f, 7); // cp 0x03

    if (regs.fC) {
      m.step(0x5965, 10); // jp c,0x5965 taken

      regs.hl = 0x2e3e;
      m.step(0x5968, 10); // ld hl,0x2e3e
      m.step(0x596e, 10); // jp 0x596e
    } else {
      m.step(0x1f52, 10); // jp c NOT taken

      m.step(0x596b, 10); // jp 0x596b

      regs.hl = 0x08fa;
      m.step(0x596e, 10); // ld hl,0x08fa
    }
  }

  m.call(0x596e);

  return m.call(0x1f55);
}
