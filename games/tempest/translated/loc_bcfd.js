// SPDX-License-Identifier: GPL-3.0-only
// loc_bcfd  (ROM 0xbcfd-0xbd08) -- stores A to $55, then loads $56/$58 from tables $0435/$0445,Y; no rts --
// falls through into loc_bd09.
export function loc_bcfd(m) {
  const { regs, mem } = m;
  mem.write8(0x55, regs.a); m.step(0xbcff, 3);
  { const a = (0x0435 + regs.y) & 0xffff;
    regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xbd02, 4 + ((0x0435 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
  mem.write8(0x56, regs.a); m.step(0xbd04, 3);
  { const a = (0x0445 + regs.y) & 0xffff;
    regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xbd07, 4 + ((0x0445 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
  mem.write8(0x58, regs.a); m.step(0xbd09, 3);
  return m.call(0xbd09);
}
