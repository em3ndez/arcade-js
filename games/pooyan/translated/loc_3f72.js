// SPDX-License-Identifier: GPL-3.0-only

// loc_3f72  (ROM 0x3f72-0x3f7b) -- object state-8 handler (0x33a7 dispatch, index 8), also entered
// by fall-through from loc_3f5c. Ticks loc_4006 and counts down the frame timer (ix+0x11); on expiry
// it advances the state and FALLS THROUGH into the state-9 handler loc_3f7c.
export function loc_3f72(m) {
  const { regs, mem } = m;

  m.push16(0x3f75); m.step(0x4006, 17); m.call(0x4006); // 3f72  call 0x4006
  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x3f78, 23); // 3f75  dec (ix+0x11)
  if (regs.fNZ) { m.ret(11); return; } // 3f78  ret nz
  m.step(0x3f79, 5);
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x3f7c, 23); // 3f79  inc (ix+0x02)
  return m.call(0x3f7c); // fall through into state-9 handler loc_3f7c
}
