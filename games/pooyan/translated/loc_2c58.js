// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2c58  (ROM 0x2c58-0x2c84) -- hunter dispatch state 0 (rst 0x2c50[0]); also `jp nz` target from
// loc_2a01. Runs loc_4006, advances the hunter's 16-bit position (ix+0x05:0x06) by (ix+0x09); while
// the high byte stays below 0x12 it returns normally (true). Once it reaches 0x12 it walks the 0x11
// records at 0x8ae0 via loc_2c85, runs loc_0f3f, and `pop af; ret` (false -- caller-skip aborting
// loc_2c2c / discarding the epilogue). loc_4006/2c85/0f3f are pattern A.
export function loc_2c58(m) {
  const { regs, mem } = m;

  m.push16(0x2c5b); m.step(0x4006, 17); m.call(0x4006);
  regs.a = mem.read8((regs.ix + 0x05) & 0xffff); m.step(0x2c5e, 19); // 2c5b  ld a,(ix+0x05)
  regs.add(mem.read8((regs.ix + 0x09) & 0xffff)); m.step(0x2c61, 19); // 2c5e  add a,(ix+0x09)
  if (regs.fNC) {
    m.step(0x2c66, 12);
  } else {
    m.step(0x2c63, 7);
    regs.incMem8(mem, (regs.ix + 0x06) & 0xffff); m.step(0x2c66, 23); // 2c63  inc (ix+0x06)
  }
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x2c69, 19); // 2c66  ld (ix+0x05),a
  regs.b = regs.a; m.step(0x2c6a, 4);
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x2c6d, 19); // 2c6a  ld a,(ix+0x06)
  regs.cp(0x12); m.step(0x2c6f, 7);
  if (regs.fC) { m.ret(11); return true; } // 2c6f  ret c -- still climbing (normal)
  m.step(0x2c70, 5);
  regs.ix = 0x8ae0; m.step(0x2c74, 14);
  regs.b = 0x11; m.step(0x2c76, 7);
  for (;;) {
    m.push16(0x2c79); m.step(0x2c85, 17); m.call(0x2c85);
    regs.de = 0x0018; m.step(0x2c7c, 10);
    regs.addIx(regs.de); m.step(0x2c7e, 15);
    if (regs.djnz() !== 0) { m.step(0x2c76, 13); continue; }
    m.step(0x2c80, 8); break;
  }
  m.push16(0x2c83); m.step(0x0f3f, 17); m.call(0x0f3f);
  regs.af = m.pop16(); m.step(0x2c84, 10); // 2c83  pop af (discard caller/epilogue return)
  m.ret(); return false; // 2c84  ret -- caller-skip
}
