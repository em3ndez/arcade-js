// SPDX-License-Identifier: GPL-3.0-only

// loc_3d8f  (ROM 0x3d8f-0x3d98) -- object state-4 handler (0x33a7 dispatch, index 4), also entered
// by fall-through from loc_3d5c. Ticks loc_4006, counts down the frame timer (ix+0x11), and once it
// elapses hands the object to the generic follow-on routine loc_3553 (tail jump).
export function loc_3d8f(m) {
  const { regs, mem } = m;

  m.push16(0x3d92); m.step(0x4006, 17); m.call(0x4006); // 3d8f  call 0x4006
  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x3d95, 23); // 3d92  dec (ix+0x11)
  if (regs.fNZ) { m.ret(11); return; } // 3d95  ret nz
  m.step(0x3d96, 5);
  m.step(0x3553, 10); return m.call(0x3553); // 3d96  jp 0x3553
}
