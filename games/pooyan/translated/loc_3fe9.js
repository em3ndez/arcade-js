// SPDX-License-Identifier: GPL-3.0-only

// loc_3fe9  (ROM 0x3fe9-0x4005) -- object state-10 handler (0x33a7 dispatch, index 10) / ROM-integrity
// guard. Sums 16 ROM bytes descending from 0x7780 into B, then inspects the checksum: a healthy image
// has B.0 clear, B.5 set and B.7 set, in which case it returns untouched. Any deviation (B.0 set, or
// B.5 clear, or B.7 clear) bumps the tamper counter (0x8a39).
export function loc_3fe9(m) {
  const { regs, mem } = m;

  regs.de = 0x7780; m.step(0x3fec, 10); // 3fe9  ld de,0x7780
  regs.bc = 0x0010; m.step(0x3fef, 10); // 3fec  ld bc,0x0010 (B=0 sum, C=0x10 count)
  for (;;) {
    regs.a = mem.read8(regs.de); m.step(0x3ff0, 7); // 3fef  ld a,(de)
    regs.de = (regs.de - 1) & 0xffff; m.step(0x3ff1, 6); // 3ff0  dec de
    regs.add(regs.b); m.step(0x3ff2, 4); // 3ff1  add a,b
    regs.b = regs.a; m.step(0x3ff3, 4); // 3ff2  ld b,a
    regs.c = regs.dec8(regs.c); m.step(0x3ff4, 4); // 3ff3  dec c
    if (regs.fNZ) { m.step(0x3fef, 12); continue; } // 3ff4  jr nz,0x3fef
    m.step(0x3ff6, 7);
    break;
  }
  regs.bit(0, regs.b); m.step(0x3ff8, 8); // 3ff6  bit 0,b
  if (regs.fNZ) { m.step(0x4001, 12); } // 3ff8  jr nz,0x4001 -- B.0 set -> tamper
  else {
    m.step(0x3ffa, 7);
    regs.bit(5, regs.b); m.step(0x3ffc, 8); // 3ffa  bit 5,b
    if (regs.fZ) { m.step(0x4001, 12); } // 3ffc  jr z,0x4001 -- B.5 clear -> tamper
    else {
      m.step(0x3ffe, 7);
      regs.bit(7, regs.b); m.step(0x4000, 8); // 3ffe  bit 7,b
      if (regs.fNZ) { m.ret(11); return; } // 4000  ret nz -- B.7 set -> healthy
      m.step(0x4001, 5);
    }
  }
  regs.hl = 0x8a39; m.step(0x4004, 10); // 4001  ld hl,0x8a39
  regs.incMem8(mem, regs.hl); m.step(0x4005, 11); // 4004  inc (hl) -- tamper counter
  m.ret(); // 4005  ret
}
