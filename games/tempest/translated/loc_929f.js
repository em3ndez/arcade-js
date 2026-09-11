// SPDX-License-Identifier: GPL-3.0-only
// loc_929f  (ROM 0x929f-0x92ac) -- zeros $030a..$0311 (x=7..0), then $0116=0x00, rts.
export function loc_929f(m) {
  const { regs, mem } = m;
  regs.x = 0x07; regs.setNZ(regs.x); m.step(0x92a1, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0x92a3, 2);
  while (true) {
    mem.write8((0x030a + regs.x) & 0xffff, regs.a); m.step(0x92a6, 5);
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0x92a7, 2);
    if (regs.fN) { m.step(0x92a9, 2); break; }
    m.step(0x92a3, 3);
  }
  mem.write8(0x0116, regs.a); m.step(0x92ac, 4);
  return m.ret(6);
}
