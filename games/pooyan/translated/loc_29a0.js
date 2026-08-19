// SPDX-License-Identifier: GPL-3.0-only
//
// loc_29a0  (ROM 0x29a0-0x2a00) -- 0x8a80 actor state 1 (dispatch 0x28f1[1]). Every 4th frame flips
// the display tile (ix+0x0f) between 0x15/0x1e; drives (ix+0x06) down by 2 and returns while it stays
// >= 0x2c. Below that, if (0x8343) is set it re-enters loc_2b23; else it advances the state, and runs
// a ROM self-check over 0x0879 (sum!=0x37 re-enters loc_2ab3) and a compare vs table 0x2980
// (mismatch re-enters loc_2901); on success it enqueues display command 0x0614 (rst 0x38).
export function loc_29a0(m) {
  const { regs, mem } = m;

  mem.write8((regs.ix + 0x11) & 0xffff, 0x03); m.step(0x29a4, 19); // 29a0  ld (ix+0x11),0x03
  regs.incMem8(mem, (regs.ix + 0x0b) & 0xffff); m.step(0x29a7, 23); // 29a4  inc (ix+0x0b)
  regs.a = mem.read8((regs.ix + 0x0b) & 0xffff); m.step(0x29aa, 19); // 29a7  ld a,(ix+0x0b)
  regs.and(0x03); m.step(0x29ac, 7);
  if (regs.fNZ) {
    m.step(0x29bc, 12);
  } else {
    m.step(0x29ae, 7);
    regs.a = mem.read8((regs.ix + 0x0f) & 0xffff); m.step(0x29b1, 19); // 29ae  ld a,(ix+0x0f)
    regs.cp(0x15); m.step(0x29b3, 7);
    regs.a = 0x15; m.step(0x29b5, 7);
    if (regs.fNZ) {
      m.step(0x29b9, 12);
    } else {
      m.step(0x29b7, 7);
      regs.a = 0x1e; m.step(0x29b9, 7);
    }
    mem.write8((regs.ix + 0x0f) & 0xffff, regs.a); m.step(0x29bc, 19); // 29b9  ld (ix+0x0f),a
  }
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x29bf, 19); // 29bc  ld a,(ix+0x06)
  regs.sub(0x02); m.step(0x29c1, 7);
  mem.write8((regs.ix + 0x06) & 0xffff, regs.a); m.step(0x29c4, 19); // 29c1  ld (ix+0x06),a
  regs.cp(0x2c); m.step(0x29c6, 7);
  if (regs.fNC) { m.ret(11); return; }
  m.step(0x29c7, 5);
  regs.a = mem.read8(0x8343); m.step(0x29ca, 13); // 29c7  ld a,(0x8343)
  regs.and(regs.a); m.step(0x29cb, 4);
  if (regs.fNZ) { m.step(0x2b23, 10); return m.call(0x2b23); }
  m.step(0x29ce, 10);
  regs.add(0x30); m.step(0x29d0, 7);
  mem.write8(0x8d30, regs.a); m.step(0x29d3, 13); // 29d0  ld (0x8d30),a
  mem.write8((regs.ix + 0x11) & 0xffff, 0x18); m.step(0x29d7, 19); // 29d3  ld (ix+0x11),0x18
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x29da, 23); // 29d7  inc (ix+0x02)
  regs.hl = 0x0879; m.step(0x29dd, 10);
  regs.bc = 0x2000; m.step(0x29e0, 10);
  for (;;) {
    regs.a = mem.read8(regs.hl); m.step(0x29e1, 7); // 29e0  ld a,(hl)
    regs.add(regs.c); m.step(0x29e2, 4);
    regs.c = regs.a; m.step(0x29e3, 4);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x29e4, 6);
    if (regs.djnz() !== 0) { m.step(0x29e0, 13); continue; }
    m.step(0x29e6, 8); break;
  }
  regs.cp(0x37); m.step(0x29e8, 7);
  if (regs.fNZ) { m.step(0x2ab3, 10); return m.call(0x2ab3); } // 29e8  jp nz,0x2ab3 (guard)
  m.step(0x29eb, 10);
  regs.hl = 0x0859; m.step(0x29ee, 10);
  regs.b = 0x20; m.step(0x29f0, 7);
  regs.de = 0x2980; m.step(0x29f3, 10);
  for (;;) {
    regs.a = mem.read8(regs.de); m.step(0x29f4, 7); // 29f3  ld a,(de)
    regs.cp(mem.read8(regs.hl)); m.step(0x29f5, 7); // 29f4  cp (hl)
    if (regs.fNZ) { m.step(0x2901, 10); return m.call(0x2901); } // 29f5  jp nz,0x2901 (guard)
    m.step(0x29f8, 10);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x29f9, 6);
    regs.de = (regs.de + 1) & 0xffff; m.step(0x29fa, 6);
    if (regs.djnz() !== 0) { m.step(0x29f3, 13); continue; }
    m.step(0x29fc, 8); break;
  }
  regs.de = 0x0614; m.step(0x29ff, 10);
  m.push16(0x2a00); m.step(0x0038, 11); m.call(0x0038);
  m.ret();
}
