// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2ab3  (ROM 0x2ab3-0x2ae7) -- 0x8a80 actor state 6 (dispatch 0x28f1[6]). Flips the display tile
// every 4th frame, drives (ix+0x06) upward, and returns while it stays below 0xc0. Once it reaches
// 0xc0 it nudges base Y (ix+0x04) down by 3, advances the state, and seeds a long frame delay 0x40.
export function loc_2ab3(m) {
  const { regs, mem } = m;

  mem.write8((regs.ix + 0x11) & 0xffff, 0x02); m.step(0x2ab7, 19); // 2ab3  ld (ix+0x11),0x02
  regs.incMem8(mem, (regs.ix + 0x0b) & 0xffff); m.step(0x2aba, 23); // 2ab7  inc (ix+0x0b)
  regs.a = mem.read8((regs.ix + 0x0b) & 0xffff); m.step(0x2abd, 19); // 2aba  ld a,(ix+0x0b)
  regs.and(0x03); m.step(0x2abf, 7);
  if (regs.fNZ) {
    m.step(0x2acf, 12);
  } else {
    m.step(0x2ac1, 7);
    regs.a = mem.read8((regs.ix + 0x0f) & 0xffff); m.step(0x2ac4, 19); // 2ac1  ld a,(ix+0x0f)
    regs.cp(0x15); m.step(0x2ac6, 7);
    regs.a = 0x15; m.step(0x2ac8, 7);
    if (regs.fNZ) {
      m.step(0x2acc, 12);
    } else {
      m.step(0x2aca, 7);
      regs.a = 0x1e; m.step(0x2acc, 7);
    }
    mem.write8((regs.ix + 0x0f) & 0xffff, regs.a); m.step(0x2acf, 19); // 2acc  ld (ix+0x0f),a
  }
  regs.incMem8(mem, (regs.ix + 0x06) & 0xffff); m.step(0x2ad2, 23); // 2acf  inc (ix+0x06)
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x2ad5, 19); // 2ad2  ld a,(ix+0x06)
  regs.cp(0xc0); m.step(0x2ad7, 7);
  if (regs.fC) { m.ret(11); return; }
  m.step(0x2ad8, 5);
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x2adb, 19); // 2ad8  ld a,(ix+0x04)
  regs.sub(0x03); m.step(0x2add, 7);
  mem.write8((regs.ix + 0x04) & 0xffff, regs.a); m.step(0x2ae0, 19); // 2add  ld (ix+0x04),a
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x2ae3, 23); // 2ae0  inc (ix+0x02)
  mem.write8((regs.ix + 0x11) & 0xffff, 0x40); m.step(0x2ae7, 19); // 2ae3  ld (ix+0x11),0x40
  m.ret();
}
