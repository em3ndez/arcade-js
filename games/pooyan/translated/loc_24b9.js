// SPDX-License-Identifier: GPL-3.0-only
//
// loc_24b9  (ROM 0x24b9-0x24da) -- 0x8a80 actor state 3 (dispatch 0x2436[3]). Every other frame
// (ix+0x05 bit0) decrements (ix+0x06); base Y (ix+0x04) += 2 each frame; while Y < 0xdc it returns.
// Once Y reaches 0xdc it runs loc_0f21 (pattern A), reseeds the frame delay to 2 and advances state.
export function loc_24b9(m) {
  const { regs, mem } = m;

  regs.incMem8(mem, (regs.ix + 0x05) & 0xffff); m.step(0x24bc, 23); // 24b9  inc (ix+0x05)
  regs.bit(0, mem.read8((regs.ix + 0x05) & 0xffff)); m.step(0x24c0, 20); // 24bc  bit 0,(ix+0x05)
  if (regs.fNZ) {
    m.step(0x24c5, 12); // 24c0  jr nz,0x24c5
  } else {
    m.step(0x24c2, 7);
    regs.decMem8(mem, (regs.ix + 0x06) & 0xffff); m.step(0x24c5, 23); // 24c2  dec (ix+0x06)
  }
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x24c8, 19); // 24c5  ld a,(ix+0x04)
  regs.add(0x02); m.step(0x24ca, 7); // 24c8  add a,0x02
  mem.write8((regs.ix + 0x04) & 0xffff, regs.a); m.step(0x24cd, 19); // 24ca  ld (ix+0x04),a
  regs.cp(0xdc); m.step(0x24cf, 7); // 24cd  cp 0xdc
  if (regs.fC) { m.ret(11); return; } // 24cf  ret c (Y still above the floor)
  m.step(0x24d0, 5);
  m.push16(0x24d3); m.step(0x0f21, 17); m.call(0x0f21); // 24d0  call 0x0f21 (pattern A)
  mem.write8((regs.ix + 0x11) & 0xffff, 0x02); m.step(0x24d7, 19); // 24d3  ld (ix+0x11),0x02
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x24da, 23); // 24d7  inc (ix+0x02)
  m.ret(); // 24da  ret
}
