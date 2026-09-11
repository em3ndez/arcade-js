// SPDX-License-Identifier: GPL-3.0-only
// loc_a3d6  (ROM 0xa3d6-0xa415) -- saves X/Y; scans slots x=7..0 for a free one at $030a,x==0 (early exit)
// else finds the slot with max $0312,x (tracking index in $2b) and dec's the count $0116; then writes the
// new object into slots $0312/$0302/$030a/$02fa,x, inc's $0116, restores X/Y, rts.
export function loc_a3d6(m) {
  const { regs, mem } = m;
  mem.write8(0x35, regs.x); m.step(0xa3d8, 3);
  mem.write8(0x36, regs.y); m.step(0xa3da, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa3dc, 2);
  mem.write8(0x2a, regs.a); m.step(0xa3de, 3);
  mem.write8(0x2b, regs.a); m.step(0xa3e0, 3);
  regs.x = 0x07; regs.setNZ(regs.x); m.step(0xa3e2, 2);
  let freeSlot = false;
  while (true) {
    regs.a = mem.read8((0x030a + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa3e5, 4);
    if (regs.fZ) { m.step(0xa3fa, 3); freeSlot = true; break; }
    m.step(0xa3e7, 2);
    regs.a = mem.read8((0x0312 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa3ea, 4);
    regs.cmp(mem.read8(0x2a)); m.step(0xa3ec, 3);
    if (regs.fNC) { m.step(0xa3f2, 3); }
    else {
      m.step(0xa3ee, 2);
      mem.write8(0x2a, regs.a); m.step(0xa3f0, 3);
      mem.write8(0x2b, regs.x); m.step(0xa3f2, 3);
    }
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xa3f3, 2);
    if (!regs.fN) { m.step(0xa3e2, 3); continue; }
    m.step(0xa3f5, 2); break;
  }
  if (!freeSlot) {
    { const v = (mem.read8(0x0116) - 1) & 0xff; mem.write8(0x0116, v); regs.setNZ(v); } m.step(0xa3f8, 6);
    regs.x = mem.read8(0x2b); regs.setNZ(regs.x); m.step(0xa3fa, 3);
  }
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa3fc, 2);
  mem.write8((0x0312 + regs.x) & 0xffff, regs.a); m.step(0xa3ff, 5);
  regs.a = mem.read8(0x2c); regs.setNZ(regs.a); m.step(0xa401, 3);
  mem.write8((0x0302 + regs.x) & 0xffff, regs.a); m.step(0xa404, 5);
  regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0xa406, 3);
  mem.write8((0x030a + regs.x) & 0xffff, regs.a); m.step(0xa409, 5);
  regs.a = mem.read8(0x2d); regs.setNZ(regs.a); m.step(0xa40b, 3);
  mem.write8((0x02fa + regs.x) & 0xffff, regs.a); m.step(0xa40e, 5);
  { const v = (mem.read8(0x0116) + 1) & 0xff; mem.write8(0x0116, v); regs.setNZ(v); } m.step(0xa411, 6);
  regs.x = mem.read8(0x35); regs.setNZ(regs.x); m.step(0xa413, 3);
  regs.y = mem.read8(0x36); regs.setNZ(regs.y); m.step(0xa415, 3);
  return m.ret(6);
}
