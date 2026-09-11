// SPDX-License-Identifier: GPL-3.0-only
// loc_9aee  (ROM 0x9aee-0x9afc) -- loads two ROM tables by Y (0x9b02,y -> $2c; 0x9afd,y -> $2d), stashes Y
// in $2b, then reloads A from $29 and returns.
export function loc_9aee(m) {
  const { regs, mem } = m;
  regs.a = mem.read8((0x9b02 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x9af1, 4);
  mem.write8(0x2c, regs.a); m.step(0x9af3, 3);
  regs.a = mem.read8((0x9afd + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x9af6, 4);
  mem.write8(0x2b, regs.y); m.step(0x9af8, 3);
  mem.write8(0x2d, regs.a); m.step(0x9afa, 3);
  regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0x9afc, 3);
  return m.ret(6);
}
