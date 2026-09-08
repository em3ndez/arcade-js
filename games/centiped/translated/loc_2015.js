// SPDX-License-Identifier: GPL-3.0-only
// loc_2015  (ROM 0x2015-0x2058) -- the main loop: spin-syncs on $8a, writes $2000, polls IN $0c00 bit5
// (spins at 0x2021 until set), runs the per-frame subsystem JSR chain, then JMP $2015 (never returns).
export function loc_2015(m) {
  const { regs, mem } = m;
  let label = 0x2015;
  for (;;) {
    switch (label) {
      case 0x2015: {
        mem.write8(0x008a, regs.lsr(mem.read8(0x008a))); m.step(0x2017, 5); // 2015 lsr $8a
        if (regs.fNC) { m.step(0x2015, 3); label = 0x2015; continue; }      // 2017 bcc $2015
        m.step(0x2019, 2);
        label = 0x2019; continue;
      }
      case 0x2019: {
        mem.write8(0x2000, regs.a); m.step(0x201c, 4);                      // 2019 sta $2000
        regs.a = mem.read8(0x0c00); regs.setNZ(regs.a); m.step(0x201f, 4);  // 201c lda $0c00
        regs.and(0x20); m.step(0x2021, 2);                                  // 201f and #$20
        label = 0x2021; continue;
      }
      case 0x2021: {
        if (regs.fZ) { m.step(0x2021, 3); label = 0x2021; continue; }       // 2021 beq $2021
        m.step(0x2023, 2);
        label = 0x2023; continue;
      }
      case 0x2023: {
        m.step(0x2026, 6); m.call(0x2561);                                  // 2023 jsr $2561
        m.step(0x2029, 6); m.call(0x3068);                                  // 2026 jsr $3068
        m.step(0x202c, 6); m.call(0x2741);                                  // 2029 jsr $2741
        if (regs.fPl) { m.step(0x2015, 3); label = 0x2015; continue; }      // 202c bpl $2015
        m.step(0x202e, 2);
        label = 0x202e; continue;
      }
      case 0x202e: {
        m.step(0x2031, 6); m.call(0x3ac0);                                  // 202e jsr $3ac0
        m.step(0x2034, 6); m.call(0x2119);                                  // 2031 jsr $2119
        m.step(0x2037, 6); m.call(0x32fe);                                  // 2034 jsr $32fe
        m.step(0x203a, 6); m.call(0x2951);                                  // 2037 jsr $2951
        m.step(0x203d, 6); m.call(0x26fd);                                  // 203a jsr $26fd
        m.step(0x2040, 6); m.call(0x2ace);                                  // 203d jsr $2ace
        m.step(0x2043, 6); m.call(0x2202);                                  // 2040 jsr $2202
        m.step(0x2046, 6); m.call(0x2ec6);                                  // 2043 jsr $2ec6
        m.step(0x2049, 6); m.call(0x2bd9);                                  // 2046 jsr $2bd9
        m.step(0x204c, 6); m.call(0x2e0b);                                  // 2049 jsr $2e0b
        m.step(0x204f, 6); m.call(0x2059);                                  // 204c jsr $2059
        m.step(0x2052, 6); m.call(0x23da);                                  // 204f jsr $23da
        m.step(0x2055, 6); m.call(0x2cef);                                  // 2052 jsr $2cef
        m.step(0x2015, 3); label = 0x2015; continue;                        // 2055 jmp $2015
      }
    }
  }
}
