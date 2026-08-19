// SPDX-License-Identifier: GPL-3.0-only

// loc_3fd5  (ROM 0x3fd5-0x3fe8) -- fall-step helper, called by loc_3f7c (0x3f7f) and by 0x4371.
// Advances the 16-bit vertical position (ix+0x03:0x04) by the velocity (ix+0x09), then returns with
// carry SET while the integer row (ix+0x04) is still below the landing row 0x1e (cp 0x1e leaves C),
// clear once it has reached it. The caller uses `ret c` to keep falling.
export function loc_3fd5(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x03) & 0xffff); m.step(0x3fd8, 19); // 3fd5  ld a,(ix+0x03)
  regs.add(mem.read8((regs.ix + 0x09) & 0xffff)); m.step(0x3fdb, 19); // 3fd8  add a,(ix+0x09)
  if (regs.fNC) {
    m.step(0x3fe0, 12); // 3fdb  jr nc,0x3fe0
  } else {
    m.step(0x3fdd, 7);
    regs.incMem8(mem, (regs.ix + 0x04) & 0xffff); m.step(0x3fe0, 23); // 3fdd  inc (ix+0x04)
  }
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x3fe3, 19); // 3fe0  ld (ix+0x03),a
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x3fe6, 19); // 3fe3  ld a,(ix+0x04)
  regs.cp(0x1e); m.step(0x3fe8, 7); // 3fe6  cp 0x1e -- C set while below the landing row
  m.ret(); // 3fe8  ret
}
