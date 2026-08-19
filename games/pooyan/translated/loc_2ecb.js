// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2ecb  (ROM 0x2ecb-0x2f00) -- rope-cell state 2 (rst 0x2e3d[1]). On the per-cell timer (loc_2e45)
// it writes a tile index derived from (0x8907) into (HL), then indexes the 0x8c30 formation table by
// (HL+1) to bump that record's tile (iy+0x0f), clear its low position byte, and drop (iy+0x06);
// advances the cell (ix+0) and blits the segment (0x2e1e via loc_2e52/loc_3325). loc_2e45 leaves
// HL=timer address and Z; loc_3325/2e52 pattern A.
export function loc_2ecb(m) {
  const { regs, mem } = m;

  m.push16(0x2ece); m.step(0x2e45, 17); m.call(0x2e45);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x2ecf, 5);
  regs.a = mem.read8(0x8907); m.step(0x2ed2, 13); // 2ecf  ld a,(0x8907)
  regs.cp(0x10); m.step(0x2ed4, 7);
  if (regs.fC) {
    m.step(0x2ed8, 12);
  } else {
    m.step(0x2ed6, 7);
    regs.a = 0x10; m.step(0x2ed8, 7); // 2ed6  ld a,0x10 (clamp)
  }
  regs.rlca(); m.step(0x2ed9, 4);
  regs.add(0x18); m.step(0x2edb, 7);
  mem.write8(regs.hl, regs.a); m.step(0x2edc, 7); // 2edb  ld (hl),a
  regs.iy = 0x8c30; m.step(0x2ee0, 14);
  regs.de = 0x0018; m.step(0x2ee3, 10);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2ee4, 6);
  regs.b = mem.read8(regs.hl); m.step(0x2ee5, 7); // 2ee4  ld b,(hl)
  regs.b = (regs.b + 1) & 0xff; m.step(0x2ee6, 4);
  for (;;) {
    regs.addIy(regs.de); m.step(0x2ee8, 15);
    if (regs.djnz() !== 0) { m.step(0x2ee6, 13); continue; }
    m.step(0x2eea, 8); break;
  }
  regs.incMem8(mem, (regs.iy + 0x0f) & 0xffff); m.step(0x2eed, 23); // 2eea  inc (iy+0x0f)
  mem.write8((regs.iy + 0x05) & 0xffff, 0x00); m.step(0x2ef1, 19); // 2eed  ld (iy+0x05),0x00
  regs.decMem8(mem, (regs.iy + 0x06) & 0xffff); m.step(0x2ef4, 23); // 2ef1  dec (iy+0x06)
  regs.incMem8(mem, (regs.ix + 0x00) & 0xffff); m.step(0x2ef7, 23); // 2ef4  inc (ix+0)
  m.push16(0x2efa); m.step(0x2e52, 17); m.call(0x2e52);
  regs.de = 0x2e1e; m.step(0x2efd, 10);
  m.push16(0x2f00); m.step(0x3325, 17); m.call(0x3325);
  m.ret();
}
