// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2e5e  (ROM 0x2e5e-0x2ec6) -- rope-cell state 1 (rst 0x2e3d[0]). Gated on (0x8a5f)&3 and the
// per-cell timer (loc_2e45); when both fire it re-arms the timer, finds a free bonus slot in the
// 3-entry 0x8c48 table, and seeds it (state/anim/coords, (iy+4) from a 0x2ec7 lookup keyed by IXL&3),
// advances the cell (ix+0), and blits the segment tile (0x2dfe via loc_2e52/loc_3325/loc_0f11).
// loc_2e45 leaves HL=timer address and Z=(dec result). rst 0x20 table 0x2ec7 is ROM data.
export function loc_2e5e(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8a5f); m.step(0x2e61, 13); // 2e5e  ld a,(0x8a5f)
  regs.and(0x03); m.step(0x2e63, 7);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x2e64, 5);
  m.push16(0x2e67); m.step(0x2e45, 17); m.call(0x2e45);
  if (regs.fNZ) { m.ret(11); return; } // 2e67  ret nz (timer not elapsed)
  m.step(0x2e68, 5);
  mem.write8(regs.hl, 0x01); m.step(0x2e6a, 10); // 2e68  ld (hl),0x01
  regs.iy = 0x8c48; m.step(0x2e6e, 14);
  regs.de = 0x0018; m.step(0x2e71, 10);
  regs.b = 0x03; m.step(0x2e73, 7);
  let found = false;
  for (;;) {
    regs.a = mem.read8((regs.iy + 0x00) & 0xffff); m.step(0x2e76, 19); // 2e73  ld a,(iy+0)
    regs.or(mem.read8((regs.iy + 0x01) & 0xffff)); m.step(0x2e79, 19); // 2e76  or (iy+1)
    regs.rrca(); m.step(0x2e7a, 4);
    if (regs.fNC) { m.step(0x2e81, 12); found = true; break; } // 2e7a  jr nc,0x2e81 (free slot)
    m.step(0x2e7c, 7);
    regs.addIy(regs.de); m.step(0x2e7e, 15);
    if (regs.djnz() !== 0) { m.step(0x2e73, 13); continue; }
    m.step(0x2e80, 8); break;
  }
  if (!found) { m.ret(); return; } // 2e80  ret (no free slot)
  regs.a = mem.read8(0x8907); m.step(0x2e84, 13); // 2e81  ld a,(0x8907)
  regs.cp(0x10); m.step(0x2e86, 7);
  if (regs.fC) {
    m.step(0x2e8a, 12);
  } else {
    m.step(0x2e88, 7);
    regs.a = 0x10; m.step(0x2e8a, 7); // 2e88  ld a,0x10 (clamp)
  }
  regs.sub(0x28); m.step(0x2e8c, 7);
  regs.cpl(); m.step(0x2e8d, 4);
  mem.write8(regs.hl, regs.a); m.step(0x2e8e, 7); // 2e8d  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2e8f, 6);
  regs.a = regs.b; m.step(0x2e90, 4);
  regs.cpl(); m.step(0x2e91, 4);
  regs.and(0x03); m.step(0x2e93, 7);
  mem.write8(regs.hl, regs.a); m.step(0x2e94, 7); // 2e93  ld (hl),a
  regs.a = regs.ix & 0xff; m.step(0x2e96, 8);
  regs.and(0x03); m.step(0x2e98, 7);
  regs.hl = 0x2ec7; m.step(0x2e9b, 10);
  m.push16(0x2e9c); m.step(0x0020, 11); m.call(0x0020); // 2e9b  rst 0x20 (A := table_0x2ec7[A])
  mem.write8((regs.iy + 0x00) & 0xffff, 0x07); m.step(0x2ea0, 19); // 2e9c  ld (iy+0),0x07
  mem.write8((regs.iy + 0x02) & 0xffff, 0x10); m.step(0x2ea4, 19); // 2ea0  ld (iy+0x02),0x10
  mem.write8((regs.iy + 0x04) & 0xffff, regs.a); m.step(0x2ea7, 19); // 2ea4  ld (iy+0x04),a
  mem.write8((regs.iy + 0x05) & 0xffff, 0x40); m.step(0x2eab, 19); // 2ea7  ld (iy+0x05),0x40
  mem.write8((regs.iy + 0x06) & 0xffff, 0x1a); m.step(0x2eaf, 19); // 2eab  ld (iy+0x06),0x1a
  mem.write8((regs.iy + 0x0f) & 0xffff, 0x2e); m.step(0x2eb3, 19); // 2eaf  ld (iy+0x0f),0x2e
  mem.write8((regs.iy + 0x10) & 0xffff, 0x40); m.step(0x2eb7, 19); // 2eb3  ld (iy+0x10),0x40
  regs.incMem8(mem, (regs.ix + 0x00) & 0xffff); m.step(0x2eba, 23); // 2eb7  inc (ix+0)
  m.push16(0x2ebd); m.step(0x2e52, 17); m.call(0x2e52);
  regs.de = 0x2dfe; m.step(0x2ec0, 10);
  m.push16(0x2ec3); m.step(0x3325, 17); m.call(0x3325);
  m.push16(0x2ec6); m.step(0x0f11, 17); m.call(0x0f11);
  m.ret();
}
