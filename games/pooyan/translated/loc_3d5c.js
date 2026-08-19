// SPDX-License-Identifier: GPL-3.0-only

// loc_3d5c  (ROM 0x3d5c-0x3d8e) -- object state-3 handler (0x33a7 dispatch, index 3), also entered
// by fall-through from loc_3d18. Ticks loc_4006 and counts down the frame timer (ix+0x11); on expiry
// it steps an animation phase (ix+0x16): phase 7 hands off to loc_3d99, otherwise it queues a display
// command (rst 0x38, D=0x03) and, on phase 4, swaps in a fresh animation from table 0x3e49 (loc_0c45
// + loc_381e) and reseeds the timer to 0x30. It then bumps the phase (ix+0x13) and the state
// (ix+0x02), FALLING THROUGH into the state-4 handler loc_3d8f.
export function loc_3d5c(m) {
  const { regs, mem } = m;

  m.push16(0x3d5f); m.step(0x4006, 17); m.call(0x4006);
  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x3d62, 23);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x3d63, 5);
  regs.a = mem.read8((regs.ix + 0x16) & 0xffff); m.step(0x3d66, 19);
  regs.cp(0x07); m.step(0x3d68, 7);
  if (regs.fZ) { m.step(0x3d99, 10); return m.call(0x3d99); }
  m.step(0x3d6b, 10); // 3d68  jp z,0x3d99 (not taken)
  regs.c = regs.a; m.step(0x3d6c, 4);
  regs.and(regs.a); m.step(0x3d6d, 4);
  if (regs.fZ) {
    m.step(0x3d70, 12);
  } else {
    m.step(0x3d6f, 7);
    regs.a = regs.dec8(regs.a); m.step(0x3d70, 4);
  }
  regs.de = 0x0312; m.step(0x3d73, 10);
  regs.add(regs.e); m.step(0x3d74, 4);
  regs.e = regs.a; m.step(0x3d75, 4);
  m.push16(0x3d76); m.step(0x0038, 11); m.call(0x0038); // 3d75  rst 0x38 -- enqueue DE
  regs.hl = 0x3e49; m.step(0x3d79, 10);
  regs.a = regs.c; m.step(0x3d7a, 4);
  regs.cp(0x04); m.step(0x3d7c, 7);
  if (regs.fNZ) {
    m.step(0x3d88, 12);
  } else {
    m.step(0x3d7e, 7);
    m.push16(0x3d81); m.step(0x0c45, 17); m.call(0x0c45);
    m.push16(0x3d84); m.step(0x381e, 17); m.call(0x381e);
    mem.write8((regs.ix + 0x11) & 0xffff, 0x30); m.step(0x3d88, 19);
  }
  regs.c = regs.inc8(regs.c); m.step(0x3d89, 4);
  mem.write8((regs.ix + 0x13) & 0xffff, regs.c); m.step(0x3d8c, 19);
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x3d8f, 23);
  return m.call(0x3d8f);
}
