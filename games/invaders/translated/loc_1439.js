// SPDX-License-Identifier: GPL-3.0-only
// loc_1439  (ROM 0x1439-0x1446) -- copy a vertical tile column from a source stream: over B rows
// store [DE] into [HL], bump DE, advance HL by 0x20 (one screen row) each pass. The head is the
// loop top (jnz 0x1439 re-enters), so the whole body is the loop.
export function loc_1439(m) {
  const { regs, mem } = m;

  for (;;) {
    m.push16(regs.bc); m.step(0x143a, 11); // 1439  push b
    regs.a = mem.read8(regs.de); m.step(0x143b, 7); // 143a  ldax d
    mem.write8(regs.hl, regs.a); m.step(0x143c, 7); // 143b  mov m,a
    regs.de = (regs.de + 1) & 0xffff; m.step(0x143d, 5); // 143c  inx d
    regs.bc = 0x0020; m.step(0x1440, 10); // 143d  lxi b,0x0020
    regs.addHl(regs.bc); m.step(0x1441, 10); // 1440  dad b
    regs.bc = m.pop16(); m.step(0x1442, 10); // 1441  pop b
    regs.b = regs.dec8(regs.b); m.step(0x1443, 5); // 1442  dcr b
    if (regs.fNZ) { m.step(0x1439, 10); continue; } // 1443  jnz 0x1439
    m.step(0x1446, 10);
    break;
  }
  return m.ret(10); // 1446  ret
}
