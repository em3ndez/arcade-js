// SPDX-License-Identifier: GPL-3.0-only
// loc_9bd0 (ROM 0x9bd0-0x9bdc) -- advances the $010b cursor, reads the 0xa0f7 table at the new
// index and stores that byte into the per-object slot $0298,x. Straight-line, ends in rts.
export function loc_9bd0(m) {
  const { regs, mem } = m;
  mem.write8(0x010b, regs.inc8(mem.read8(0x010b))); m.step(0x9bd3, 6);
  regs.y = mem.read8(0x010b); regs.setNZ(regs.y); m.step(0x9bd6, 4);
  { const e = (0xa0f7 + regs.y) & 0xffff; regs.a = mem.read8(e); regs.setNZ(regs.a);
    m.step(0x9bd9, (0xa0f7 & 0xff00) !== (e & 0xff00) ? 5 : 4); } // abs,y +1 on page cross
  mem.write8((0x0298 + regs.x) & 0xffff, regs.a); m.step(0x9bdc, 5);
  return m.ret(6);
}
