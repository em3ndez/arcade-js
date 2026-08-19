// SPDX-License-Identifier: GPL-3.0-only

// loc_0010  (ROM 0x0010-0x0014) -- rst 0x10 memset helper: fill B bytes at (HL) with A, HL++.
// Entered as `push <ret>; rst 0x10` (see loc_0000/loc_0092). The routine is the 4-byte fill loop
// ending at the 0x0014 ret; 0x0015+ inside the stated range is unrelated rst-vector code.
export function loc_0010(m) {
  const { regs, mem } = m;

  for (;;) {
    mem.write8(regs.hl, regs.a);
    m.step(0x0011, 7); // 0010  ld (hl),a
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0012, 6); // 0011  inc hl
    if (regs.djnz() !== 0) { m.step(0x0010, 13); continue; } // 0012  djnz 0x0010
    m.step(0x0014, 8);
    break;
  }

  m.ret(); // 0014  ret
}
