// SPDX-License-Identifier: GPL-3.0-only

// loc_4137  (ROM 0x4137-0x416e) -- per-object descent step; object block based at IX.
// loc_4006 animates, then (ix+03h) is advanced by the signed step (ix+0ah): if the current
// position is below -(step) the sub-position (ix+04h) borrows one. When that sub-position
// reaches 3 the object is still mid-travel -> return; otherwise it has landed: latch a sound
// id (ix+17h)+1 into 0x8d1d, reset the object to phase 2 with a 0x18 dwell, and tail into the
// spawn/notify chain (loc_0c45 with HL=0x41b1, then jp loc_381e).
export function loc_4137(m) {
  const { regs, mem } = m;

  m.push16(0x413a);
  m.step(0x4006, 17);                                            // 4137  call 0x4006
  m.call(0x4006);
  regs.a = mem.read8((regs.ix + 0x0a) & 0xffff); m.step(0x413d, 19); // 413a  ld a,(ix+0ah)
  regs.neg();                  m.step(0x413f, 8);
  regs.b = regs.a;             m.step(0x4140, 4);
  regs.a = mem.read8((regs.ix + 0x03) & 0xffff); m.step(0x4143, 19); // 4140  ld a,(ix+03h)
  regs.cp(regs.b);             m.step(0x4144, 4);
  if (regs.fC) {
    m.step(0x4146, 7);                                           // 4144  jr nc not taken
    regs.decMem8(mem, (regs.ix + 0x04) & 0xffff); m.step(0x4149, 23); // 4146  dec (ix+04h)
  } else {
    m.step(0x4149, 12);                                          // 4144  jr nc taken
  }
  regs.add(mem.read8((regs.ix + 0x0a) & 0xffff)); m.step(0x414c, 19); // 4149  add a,(ix+0ah)
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x414f, 19); // 414c  ld (ix+03h),a
  regs.b = regs.a;             m.step(0x4150, 4);
  regs.a = mem.read8((regs.ix + 0x04) & 0xffff); m.step(0x4153, 19); // 4150  ld a,(ix+04h)
  regs.cp(0x03);               m.step(0x4155, 7);
  if (regs.fNC) { return m.ret(11); }                            // 4155  ret nc -- still travelling
  m.step(0x4156, 5);
  regs.a = mem.read8((regs.ix + 0x17) & 0xffff); m.step(0x4159, 19); // 4156  ld a,(ix+17h)
  regs.a = regs.inc8(regs.a);  m.step(0x415a, 4);
  mem.write8(0x8d1d, regs.a);  m.step(0x415d, 13);               // 415a  ld (0x8d1d),a
  regs.a = regs.dec8(regs.a);  m.step(0x415e, 4);
  mem.write8((regs.ix + 0x02) & 0xffff, 0x02); m.step(0x4162, 19); // 415e  ld (ix+02h),2
  mem.write8((regs.ix + 0x11) & 0xffff, 0x18); m.step(0x4166, 19); // 4162  ld (ix+11h),0x18
  regs.hl = 0x41b1;            m.step(0x4169, 10);
  m.push16(0x416c);
  m.step(0x0c45, 17);                                            // 4169  call 0x0c45
  m.call(0x0c45);
  m.step(0x381e, 10);                                            // 416c  jp 0x381e (tail)
  return m.call(0x381e);
}
