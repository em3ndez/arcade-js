// SPDX-License-Identifier: GPL-3.0-only
// loc_01c3  (ROM 0x01c3-0x01cc) -- HL-relative fill: writes 0x01 to 0x37 (55) bytes from HL up,
// then RET. Entered via loc_01c0 (which presets HL=0x2100) or directly by `jmp 0x01c3` at 0x1907
// with HL already set. Interior label 0x01c5 is the loop top.
export function loc_01c3(m) {
  const { regs, mem } = m;

  regs.b = 0x37; m.step(0x01c5, 7);

  for (;;) { // loop @ 0x01c5
    mem.write8(regs.hl, 0x01); m.step(0x01c7, 10); // 01c5  mvi m,0x01
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x01c8, 5);
    regs.b = regs.dec8(regs.b); m.step(0x01c9, 5);
    if (regs.fNZ) { m.step(0x01c5, 10); continue; } // 01c9  jnz 0x01c5
    m.step(0x01cc, 10);
    break;
  }

  return m.ret(10); // 01cc  ret
}
