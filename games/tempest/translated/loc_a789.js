// SPDX-License-Identifier: GPL-3.0-only
// loc_a789  (ROM 0xa789-0xa7a5) -- zeroes $0283..$0292 (loop x=15..0), sets $010e/$010d=0x20,
// $01=0x04, $68/$69=0, then returns.
export function loc_a789(m) {
  const { regs, mem } = m;
  regs.x = 0x0f; regs.setNZ(regs.x); m.step(0xa78b, 2);
  do {
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa78d, 2);
    mem.write8((0x0283 + regs.x) & 0xffff, regs.a); m.step(0xa790, 5);
    regs.x = regs.dec8(regs.x); m.step(0xa791, 2);
    if (regs.fPl) { m.step(0xa78b, 3); continue; }
    m.step(0xa793, 2); break;
  } while (true);
  regs.a = 0x20; regs.setNZ(regs.a); m.step(0xa795, 2);
  mem.write8(0x010e, regs.a); m.step(0xa798, 4);
  mem.write8(0x010d, regs.a); m.step(0xa79b, 4);
  regs.a = 0x04; regs.setNZ(regs.a); m.step(0xa79d, 2);
  mem.write8(0x01, regs.a); m.step(0xa79f, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa7a1, 2);
  mem.write8(0x68, regs.a); m.step(0xa7a3, 3);
  mem.write8(0x69, regs.a); m.step(0xa7a5, 3);
  return m.ret(6);
}
