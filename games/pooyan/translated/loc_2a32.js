// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2a32  (ROM 0x2a32-0x2a78) -- 0x8a80 actor state 3 (dispatch 0x28f1[3]). Flips the display tile
// every 4th frame, then advances the 16-bit position (ix+0x05:0x06) by 0x80 (sub-pixel low byte plus
// a carry, then +1 into the high byte). At high byte 0x52 or 0x64 it enqueues special display
// commands 0x0694/0x0695 (rst 0x38) and returns; below 0xac it returns; otherwise advances the state.
export function loc_2a32(m) {
  const { regs, mem } = m;

  mem.write8((regs.ix + 0x11) & 0xffff, 0x03); m.step(0x2a36, 19); // 2a32  ld (ix+0x11),0x03
  regs.incMem8(mem, (regs.ix + 0x0b) & 0xffff); m.step(0x2a39, 23); // 2a36  inc (ix+0x0b)
  regs.a = mem.read8((regs.ix + 0x0b) & 0xffff); m.step(0x2a3c, 19); // 2a39  ld a,(ix+0x0b)
  regs.and(0x03); m.step(0x2a3e, 7);
  if (regs.fNZ) {
    m.step(0x2a4e, 12);
  } else {
    m.step(0x2a40, 7);
    regs.a = mem.read8((regs.ix + 0x0f) & 0xffff); m.step(0x2a43, 19); // 2a40  ld a,(ix+0x0f)
    regs.cp(0x15); m.step(0x2a45, 7);
    regs.a = 0x15; m.step(0x2a47, 7);
    if (regs.fNZ) {
      m.step(0x2a4b, 12);
    } else {
      m.step(0x2a49, 7);
      regs.a = 0x1e; m.step(0x2a4b, 7);
    }
    mem.write8((regs.ix + 0x0f) & 0xffff, regs.a); m.step(0x2a4e, 19); // 2a4b  ld (ix+0x0f),a
  }
  regs.a = 0x80; m.step(0x2a50, 7);
  regs.add(mem.read8((regs.ix + 0x05) & 0xffff)); m.step(0x2a53, 19); // 2a50  add a,(ix+0x05)
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x2a56, 19); // 2a53  ld (ix+0x05),a
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff); m.step(0x2a59, 19); // 2a56  ld a,(ix+0x06)
  if (regs.fNC) {
    m.step(0x2a5c, 12);
  } else {
    m.step(0x2a5b, 7);
    regs.a = regs.inc8(regs.a); m.step(0x2a5c, 4); // 2a5b  inc a (carry)
  }
  regs.a = regs.inc8(regs.a); m.step(0x2a5d, 4);
  mem.write8((regs.ix + 0x06) & 0xffff, regs.a); m.step(0x2a60, 19); // 2a5d  ld (ix+0x06),a
  regs.cp(0x52); m.step(0x2a62, 7);
  if (regs.fNZ) {
    m.step(0x2a69, 12);
  } else {
    m.step(0x2a64, 7);
    regs.de = 0x0694; m.step(0x2a67, 10);
    m.push16(0x2a68); m.step(0x0038, 11); m.call(0x0038);
    m.ret(); return;
  }
  regs.cp(0x64); m.step(0x2a6b, 7);
  if (regs.fNZ) {
    m.step(0x2a72, 12);
  } else {
    m.step(0x2a6d, 7);
    regs.de = 0x0695; m.step(0x2a70, 10);
    m.push16(0x2a71); m.step(0x0038, 11); m.call(0x0038);
    m.ret(); return;
  }
  regs.cp(0xac); m.step(0x2a74, 7);
  if (regs.fC) { m.ret(11); return; }
  m.step(0x2a75, 5);
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x2a78, 23); // 2a75  inc (ix+0x02)
  m.ret();
}
