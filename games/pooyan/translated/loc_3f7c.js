// SPDX-License-Identifier: GPL-3.0-only

// loc_3f7c  (ROM 0x3f7c-0x3fd4) -- object state-9 handler (0x33a7 dispatch, index 9), also entered
// by fall-through from loc_3f72. Ticks loc_4006, advances the fall via loc_3fd5 and returns while
// still airborne (ret c). On landing it installs a splash animation from table 0x40a4 (loc_0c45 +
// loc_381e), resets state/timer, scores the catch via loc_0eda, and decrements the active-object
// count (0x8d40). Depending on (ix+0x0b) bit0 it either bumps a bonus counter (0x8901) and continues
// via loc_34c9, or -- on the special path -- clears it, runs loc_34c9, and verifies a ROM checksum
// (bytes down from 0x428b, terminator 0xc8, carry-count == 8) setting the tamper flag (0x89eb) on
// mismatch.
export function loc_3f7c(m) {
  const { regs, mem } = m;

  m.push16(0x3f7f); m.step(0x4006, 17); m.call(0x4006);
  m.push16(0x3f82); m.step(0x3fd5, 17); m.call(0x3fd5); // 3f7f  call 0x3fd5 -- advance fall
  if (regs.fC) { m.ret(11); return; } // 3f82  ret c -- still airborne
  m.step(0x3f83, 5);
  regs.hl = 0x40a4; m.step(0x3f86, 10);
  regs.a = mem.read8((regs.ix + 0x07) & 0xffff); m.step(0x3f89, 19);
  regs.and(0x03); m.step(0x3f8b, 7);
  regs.a = regs.dec8(regs.a); m.step(0x3f8c, 4);
  m.push16(0x3f8f); m.step(0x0c45, 17); m.call(0x0c45);
  m.push16(0x3f92); m.step(0x381e, 17); m.call(0x381e);
  mem.write8((regs.ix + 0x02) & 0xffff, 0x02); m.step(0x3f96, 19);
  mem.write8((regs.ix + 0x11) & 0xffff, 0x20); m.step(0x3f9a, 19);
  m.push16(0x3f9d); m.step(0x0eda, 17); m.call(0x0eda); // 3f9a  call 0x0eda -- score the catch
  regs.hl = 0x8d40; m.step(0x3fa0, 10);
  regs.decMem8(mem, regs.hl); m.step(0x3fa1, 11); // 3fa0  dec (hl) -- active-object count
  regs.hl = 0x8901; m.step(0x3fa4, 10);
  regs.bit(0, mem.read8((regs.ix + 0x0b) & 0xffff)); m.step(0x3fa8, 20);
  if (regs.fNZ) {
    m.step(0x3fb1, 12); // 3fa8  jr nz,0x3fb1 -- special path
  } else {
    m.step(0x3faa, 7);
    regs.a = mem.read8(regs.hl); m.step(0x3fab, 7);
    regs.and(regs.a); m.step(0x3fac, 4);
    if (regs.fZ) { m.ret(11); return; }
    m.step(0x3fad, 5);
    regs.decMem8(mem, regs.hl); m.step(0x3fae, 11);
    m.step(0x34c9, 10); return m.call(0x34c9);
  }

  mem.write8(regs.hl, 0x00); m.step(0x3fb3, 10);
  regs.a = 0x01; m.step(0x3fb5, 7);
  m.push16(0x3fb8); m.step(0x34c9, 17); m.call(0x34c9);
  regs.bc = 0x428b; m.step(0x3fbb, 10);
  regs.l = 0x00; m.step(0x3fbd, 7);
  regs.h = regs.l; m.step(0x3fbe, 4); // 3fbd  ld h,l -- H=0 running sum, L=carry count
  for (;;) {
    regs.a = mem.read8(regs.bc); m.step(0x3fbf, 7);
    regs.cp(0xc8); m.step(0x3fc1, 7);
    if (regs.fZ) { m.step(0x3fcb, 12); break; } // 3fc1  jr z,0x3fcb -- terminator
    m.step(0x3fc3, 7);
    regs.add(regs.h); m.step(0x3fc4, 4);
    if (regs.fNC) {
      m.step(0x3fc7, 12);
    } else {
      m.step(0x3fc6, 7);
      regs.l = regs.inc8(regs.l); m.step(0x3fc7, 4); // 3fc6  inc l -- carry count
    }
    regs.h = regs.a; m.step(0x3fc8, 4);
    regs.bc = (regs.bc - 1) & 0xffff; m.step(0x3fc9, 6);
    m.step(0x3fbe, 12);
  }
  regs.sub(regs.l); m.step(0x3fcc, 4);
  regs.cp(0xc0); m.step(0x3fce, 7);
  if (regs.fZ) { m.ret(11); return; } // 3fce  ret z -- checksum OK
  m.step(0x3fcf, 5);
  regs.a = 0x01; m.step(0x3fd1, 7);
  mem.write8(0x89eb, regs.a); m.step(0x3fd4, 13); // 3fd1  ld (0x89eb),a -- tamper flag
  m.ret();
}
