// SPDX-License-Identifier: GPL-3.0-only
// loc_1a32  (ROM 0x1a32-0x1a3a) -- block copy of B bytes from (DE) to (HL), incrementing both,
// returns. (An LDIR-style memcpy expressed with the 8080's dcr/jnz loop.)
export function loc_1a32(m) {
  const { regs, mem } = m;
  for (;;) {
    regs.a = mem.read8(regs.de); m.step(0x1a33, 7);   // 1a32  ldax d
    mem.write8(regs.hl, regs.a); m.step(0x1a34, 7);   // 1a33  mov m,a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1a35, 5); // 1a34  inx h
    regs.de = (regs.de + 1) & 0xffff; m.step(0x1a36, 5); // 1a35  inx d
    regs.b = regs.dec8(regs.b); m.step(0x1a37, 5);    // 1a36  dcr b
    if (regs.fNZ) { m.step(0x1a32, 10); continue; }   // 1a37  jnz 0x1a32 (taken)
    m.step(0x1a3a, 10); break;                        // 1a37  jnz 0x1a32 (not taken)
  }
  return m.ret(10);                                   // 1a3a  ret
}
