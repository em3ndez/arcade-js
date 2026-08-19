// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2f01  (ROM 0x2f01-0x2f2e) -- rope-cell state 3 (rst 0x2e3d[2]). Runs loc_305f, then on the
// per-cell timer (loc_2e45) writes 0x0c into (HL), indexes the 0x8c30 formation table by (HL+1) to
// drop that record's tile (iy+0x0f), set its low position byte to 0xc0 and bump (iy+0x06); advances
// the cell (ix+0) and blits the segment (0x2dfe via loc_2e52/loc_3325). loc_2e45 leaves HL/Z.
export function loc_2f01(m) {
  const { regs, mem } = m;

  m.push16(0x2f04); m.step(0x305f, 17);
  if (!m.call(0x305f)) return; // loc_305f caller-skip -> abort
  m.push16(0x2f07); m.step(0x2e45, 17); m.call(0x2e45);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x2f08, 5);
  mem.write8(regs.hl, 0x0c); m.step(0x2f0a, 10); // 2f08  ld (hl),0x0c
  regs.iy = 0x8c30; m.step(0x2f0e, 14);
  regs.de = 0x0018; m.step(0x2f11, 10);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2f12, 6);
  regs.b = mem.read8(regs.hl); m.step(0x2f13, 7); // 2f12  ld b,(hl)
  regs.b = (regs.b + 1) & 0xff; m.step(0x2f14, 4);
  for (;;) {
    regs.addIy(regs.de); m.step(0x2f16, 15);
    if (regs.djnz() !== 0) { m.step(0x2f14, 13); continue; }
    m.step(0x2f18, 8); break;
  }
  regs.decMem8(mem, (regs.iy + 0x0f) & 0xffff); m.step(0x2f1b, 23); // 2f18  dec (iy+0x0f)
  mem.write8((regs.iy + 0x05) & 0xffff, 0xc0); m.step(0x2f1f, 19); // 2f1b  ld (iy+0x05),0xc0
  regs.incMem8(mem, (regs.iy + 0x06) & 0xffff); m.step(0x2f22, 23); // 2f1f  inc (iy+0x06)
  regs.incMem8(mem, (regs.ix + 0x00) & 0xffff); m.step(0x2f25, 23); // 2f22  inc (ix+0)
  m.push16(0x2f28); m.step(0x2e52, 17); m.call(0x2e52);
  regs.de = 0x2dfe; m.step(0x2f2b, 10);
  m.push16(0x2f2e); m.step(0x3325, 17); m.call(0x3325);
  m.ret();
}
