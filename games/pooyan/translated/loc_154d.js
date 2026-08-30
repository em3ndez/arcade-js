// SPDX-License-Identifier: GPL-3.0-only

// loc_154d  (ROM 0x154d-0x1556) -- per-frame object tick with a frame-timer countdown, entered by
// fall-through from loc_153a (which set up ix+0x13, ix+0x11=1, and bumped ix+0x02). Ticks loc_4006,
// counts down the frame timer (ix+0x11); while it is still running it `ret nz` back to the caller,
// and once it elapses it hands the object to the generic follow-on routine loc_3553 (tail jump).
export function loc_154d(m) {
  const { regs, mem } = m;

  m.push16(0x1550); m.step(0x4006, 17); m.call(0x4006); // 154d  call 0x4006
  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x1553, 23); // 1550  dec (ix+0x11)
  if (regs.fNZ) { m.ret(11); return; } // 1553  ret nz -- timer still running
  m.step(0x1554, 5);
  m.step(0x3553, 10); return m.call(0x3553); // 1554  jp 0x3553
}
