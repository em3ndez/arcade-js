// SPDX-License-Identifier: GPL-3.0-only
// loc_9c17 (ROM 0x9c17-0x9c20) -- advances the $010b sequence index through the 0xa0f8 ROM table.
export function loc_9c17(m) {
  const { regs, mem } = m;
  regs.y = mem.read8(0x010b); regs.setNZ(regs.y); m.step(0x9c1a, 4);
  const e = (0xa0f8 + regs.y) & 0xffff;
  regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0x9c1d, 4 + ((0xa0f8 & 0xff00) !== (e & 0xff00) ? 1 : 0));
  mem.write8(0x010b, regs.a); m.step(0x9c20, 4);
  return m.ret(6);
}
