// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2497  (ROM 0x2497-0x24b8) -- 0x8a80 actor state 2 (dispatch 0x2436[2]). Frame-delay countdown;
// on expiry advances the state and loads shape table 0x26c5 (loc_250f, pattern A), then nudges the
// primary record 0x8a80: base Y (ix+0x04) += 4, secondary coord (ix+0x06) -= 6.
export function loc_2497(m) {
  const { regs, mem } = m;

  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x249a, 23); // 2497  dec (ix+0x11)
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x249b, 5);
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x249e, 23); // 249b  inc (ix+0x02)
  regs.hl = 0x26c5; m.step(0x24a1, 10);
  m.push16(0x24a4); m.step(0x250f, 17); m.call(0x250f); // 24a1  call 0x250f (pattern A)
  regs.ix = 0x8a80; m.step(0x24a8, 14);
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x24ab, 19); // 24a8  ld a,(ix+0x04)
  regs.add(0x04); m.step(0x24ad, 7);
  mem.write8((regs.ix + 0x04) & 0xffff, regs.a); m.step(0x24b0, 19); // 24ad  ld (ix+0x04),a
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x24b3, 19); // 24b0  ld a,(ix+0x06)
  regs.sub(0x06); m.step(0x24b5, 7);
  mem.write8((regs.ix + 0x06) & 0xffff, regs.a); m.step(0x24b8, 19); // 24b5  ld (ix+0x06),a
  m.ret();
}
