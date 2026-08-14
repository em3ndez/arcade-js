// SPDX-License-Identifier: GPL-3.0-only

// loc_1048  (ROM 0x1048-0x1057) — a long busy-delay: spin BC=0xEFFF times while
// reading the watchdog at 0x8800 each pass (so the dog stays fed during the wait).
export function loc_1048(m) {
  const { regs, mem } = m;

  regs.bc = 0xefff;
  m.step(0x104b, 10);

  for (;;) {
    regs.a = mem.read8(0x8800);
    m.step(0x104e, 13); // ld a,(0x8800) -- pet the watchdog

    regs.bc = (regs.bc - 1) & 0xffff;
    m.step(0x104f, 6); // dec bc -- 16-bit dec, no flags

    regs.a = regs.b;
    m.step(0x1050, 4);

    regs.and(regs.a);
    m.step(0x1051, 4); // and a -- sets Z from B

    if (regs.fNZ) {
      m.step(0x104b, 12); // jr nz,0x104b (taken) -- B still non-zero
      continue;
    }
    m.step(0x1053, 7); // jr nz,0x104b (not taken)

    regs.a = regs.c;
    m.step(0x1054, 4);

    regs.and(regs.a);
    m.step(0x1055, 4); // and a -- sets Z from C

    if (regs.fNZ) {
      m.step(0x104b, 12); // jr nz,0x104b (taken) -- C still non-zero
      continue;
    }
    m.step(0x1057, 7); // jr nz,0x104b (not taken) -> BC == 0, done
    break;
  }

  m.ret();
}
