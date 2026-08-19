// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2d24  (ROM 0x2d24-0x2d49) -- hunter dispatch state 2 (rst 0x2c50[2]). Runs loc_4006 and
// advances the 16-bit position (ix+0x05:0x06) by (ix+0x09); while the high byte stays below 0x19 it
// returns normally (true). Once it reaches 0x19 it advances the record state, clears the position and
// script pointer, and `pop af; ret` (false -- caller-skip aborting loc_2c2c). loc_4006 = pattern A.
export function loc_2d24(m) {
  const { regs, mem } = m;

  m.push16(0x2d27); m.step(0x4006, 17); m.call(0x4006);
  regs.a = mem.read8((regs.ix + 0x05) & 0xffff); m.step(0x2d2a, 19); // 2d27  ld a,(ix+0x05)
  regs.add(mem.read8((regs.ix + 0x09) & 0xffff)); m.step(0x2d2d, 19); // 2d2a  add a,(ix+0x09)
  if (regs.fNC) {
    m.step(0x2d32, 12);
  } else {
    m.step(0x2d2f, 7);
    regs.incMem8(mem, (regs.ix + 0x06) & 0xffff); m.step(0x2d32, 23); // 2d2f  inc (ix+0x06)
  }
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x2d35, 19); // 2d32  ld (ix+0x05),a
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x2d38, 19); // 2d35  ld a,(ix+0x06)
  regs.cp(0x19); m.step(0x2d3a, 7);
  if (regs.fC) { m.ret(11); return true; } // 2d3a  ret c (normal)
  m.step(0x2d3b, 5);
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x2d3e, 23); // 2d3b  inc (ix+0x02)
  regs.xor(regs.a); m.step(0x2d3f, 4);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x2d42, 19); // 2d3f  ld (ix+0x05),a
  mem.write8((regs.ix + 0x06) & 0xffff, regs.a); m.step(0x2d45, 19); // 2d42  ld (ix+0x06),a
  mem.write8((regs.ix + 0x16) & 0xffff, regs.a); m.step(0x2d48, 19); // 2d45  ld (ix+0x16),a
  regs.af = m.pop16(); m.step(0x2d49, 10); // 2d48  pop af (discard caller/epilogue return)
  m.ret(); return false; // 2d49  ret -- caller-skip
}
