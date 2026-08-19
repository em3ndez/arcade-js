// SPDX-License-Identifier: GPL-3.0-only

// loc_3cae  (ROM 0x3cae-0x3d0e) -- per-record spawn helper, called by loc_3c92 with IY = a 0x8c30
// record and IX = the parent. If the slot is active ((iy+0)|(iy+1) != 0) it just returns to
// loc_3c92's loop (JS: return true). Otherwise it seats a child: marks the slot active, points its
// animation at table 0x3d0f, copies/offsets the parent's position into the child, flips the parent
// into state 6 with velocity 0xe8, queues animation 0x3838 (loc_381e), links the child back through
// loc_403c, and stores the child pointer into the parent (ix+0x14:0x15). It ends `pop af; ret`,
// discarding loc_3c92's in-loop return so the ret lands on loc_3c92's caller -- a CALLER-SKIP that
// aborts the remaining scan after a single launch (JS: return false). Data table 0x3d0f-0x3d17
// (the child's animation sequence) lives just past this routine.
export function loc_3cae(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.iy + 0x00) & 0xffff); m.step(0x3cb1, 19);
  regs.or(mem.read8((regs.iy + 0x01) & 0xffff)); m.step(0x3cb4, 19);
  regs.rrca(); m.step(0x3cb5, 4);
  if (regs.fNZ) { m.ret(11); return true; } // 3cb5  ret nz -- slot occupied; loop continues
  m.step(0x3cb6, 5);

  mem.write8((regs.iy + 0x01) & 0xffff, 0x01); m.step(0x3cba, 19); // 3cb6  ld (iy+1),0x01 -- active
  regs.xor(regs.a); m.step(0x3cbb, 4);
  mem.write8((regs.iy + 0x02) & 0xffff, 0x10); m.step(0x3cbf, 19);
  regs.hl = 0x3d0f; m.step(0x3cc2, 10);
  mem.write8((regs.iy + 0x0c) & 0xffff, regs.l); m.step(0x3cc5, 19);
  mem.write8((regs.iy + 0x0d) & 0xffff, regs.h); m.step(0x3cc8, 19);
  mem.write8((regs.iy + 0x0e) & 0xffff, regs.a); m.step(0x3ccb, 19);
  mem.write8((regs.ix + 0x02) & 0xffff, 0x06); m.step(0x3ccf, 19);
  mem.write8((regs.ix + 0x08) & 0xffff, 0x01); m.step(0x3cd3, 19);
  mem.write8((regs.ix + 0x0a) & 0xffff, 0xe8); m.step(0x3cd7, 19);
  regs.de = 0x3838; m.step(0x3cda, 10);
  m.push16(0x3cdd); m.step(0x381e, 17); m.call(0x381e);
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x3ce0, 19);
  regs.sub(0x01); m.step(0x3ce2, 7);
  mem.write8((regs.iy + 0x04) & 0xffff, regs.a); m.step(0x3ce5, 19);
  regs.a = mem.read8((regs.ix + 0x03) & 0xffff); m.step(0x3ce8, 19);
  mem.write8((regs.iy + 0x03) & 0xffff, regs.a); m.step(0x3ceb, 19);
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x3cee, 19);
  regs.add(0x01); m.step(0x3cf0, 7);
  mem.write8((regs.iy + 0x06) & 0xffff, regs.a); m.step(0x3cf3, 19);
  regs.a = mem.read8((regs.ix + 0x05) & 0xffff); m.step(0x3cf6, 19);
  mem.write8((regs.iy + 0x05) & 0xffff, regs.a); m.step(0x3cf9, 19);
  mem.write8((regs.iy + 0x08) & 0xffff, 0x01); m.step(0x3cfd, 19);
  mem.write8((regs.iy + 0x0a) & 0xffff, 0xe8); m.step(0x3d01, 19);
  m.push16(0x3d04); m.step(0x403c, 17); m.call(0x403c);
  m.push16(regs.iy); m.step(0x3d06, 15);
  regs.hl = m.pop16(); m.step(0x3d07, 10); // 3d06  pop hl -- HL = child record
  mem.write8((regs.ix + 0x14) & 0xffff, regs.l); m.step(0x3d0a, 19);
  mem.write8((regs.ix + 0x15) & 0xffff, regs.h); m.step(0x3d0d, 19);
  regs.af = m.pop16(); m.step(0x3d0e, 10); // 3d0d  pop af -- drop loc_3c92's in-loop return
  m.ret(); // 3d0e  ret -- return to loc_3c92's caller (caller-skip)
  return false;
}
