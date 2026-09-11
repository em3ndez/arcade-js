// SPDX-License-Identifier: GPL-3.0-only
// loc_9aee (ROM 0x9aee-0x9afc) -- loads two ROM tables by Y (0x9b02,y -> $2c; 0x9afd,y -> $2d), stashes Y in
// $2b, reloads A from $29, rts. loc_9af1 and loc_9af6 are mid-routine entry points (loc_9a9d branches into
// them): loc_9af1 skips the 0x9b02,y load (enters at sta $2c); loc_9af6 skips both table loads (enters at
// sty $2b, with $2c/$2d already set by the caller and A carrying the value to store at $2d... via the caller).
export function loc_9aee(m) {
  const { regs, mem } = m;
  regs.a = mem.read8((0x9b02 + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x9af1, 4);
  return loc_9af1(m);
}

export function loc_9af1(m) {
  const { regs, mem } = m;
  mem.write8(0x2c, regs.a); m.step(0x9af3, 3);
  regs.a = mem.read8((0x9afd + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0x9af6, 4);
  return loc_9af6(m);
}

export function loc_9af6(m) {
  const { regs, mem } = m;
  mem.write8(0x2b, regs.y); m.step(0x9af8, 3);
  mem.write8(0x2d, regs.a); m.step(0x9afa, 3);
  regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0x9afc, 3);
  return m.ret(6);
}
