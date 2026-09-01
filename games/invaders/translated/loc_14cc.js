// SPDX-License-Identifier: GPL-3.0-only
// loc_14cc  (ROM 0x14cc-0x14d7) -- fill a vertical tile column with A: over B rows store A at [HL]
// and advance HL by 0x20 each pass. A head in its own right (`jmp 0x14cc` at 0x01d6 enters with A
// pre-loaded); loc_14cb falls in after zeroing A.
export function loc_14cc(m) {
  const { regs, mem } = m;

  for (;;) { // 14cc  loop top
    m.push16(regs.bc); m.step(0x14cd, 11); // 14cc  push b
    mem.write8(regs.hl, regs.a); m.step(0x14ce, 7); // 14cd  mov m,a
    regs.bc = 0x0020; m.step(0x14d1, 10); // 14ce  lxi b,0x0020
    regs.addHl(regs.bc); m.step(0x14d2, 10); // 14d1  dad b
    regs.bc = m.pop16(); m.step(0x14d3, 10); // 14d2  pop b
    regs.b = regs.dec8(regs.b); m.step(0x14d4, 5); // 14d3  dcr b
    if (regs.fNZ) { m.step(0x14cc, 10); continue; } // 14d4  jnz 0x14cc
    m.step(0x14d7, 10);
    break;
  }
  return m.ret(10); // 14d7  ret
}
