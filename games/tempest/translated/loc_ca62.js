// SPDX-License-Identifier: GPL-3.0-only
// loc_ca62  (ROM 0xca62-0xca6b) -- clears the 6-byte block $40..$45 (x=5..0, sta $40,x) and rts.
export function loc_ca62(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xca64, 2);
  regs.x = 0x05; regs.setNZ(regs.x); m.step(0xca66, 2);
  for (;;) {
    mem.write8((0x40 + regs.x) & 0xff, regs.a); m.step(0xca68, 4);// ca66 sta $40,x
    regs.x = regs.dec8(regs.x); m.step(0xca69, 2);
    if (regs.fPl) { m.step(0xca66, 3); continue; }
    m.step(0xca6b, 2);
    break;
  }
  return m.ret(6);
}
