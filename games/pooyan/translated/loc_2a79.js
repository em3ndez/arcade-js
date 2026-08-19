// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2a79  (ROM 0x2a79-0x2a95) -- 0x8a80 actor state 4 (dispatch 0x28f1[4]). A 0x68-byte ROM
// self-check comparing 0x2b23.. against 0x1c66..; any mismatch re-enters loc_29a0. On success it
// reseeds the frame delay (ix+0x11)=0x30, clears the flip bit (ix+0x10 bit7), and advances the state.
export function loc_2a79(m) {
  const { regs, mem } = m;

  regs.hl = 0x1c66; m.step(0x2a7c, 10); // 2a79  ld hl,0x1c66
  regs.de = 0x2b23; m.step(0x2a7f, 10); // 2a7c  ld de,0x2b23
  regs.b = 0x68; m.step(0x2a81, 7); // 2a7f  ld b,0x68
  for (;;) {
    regs.a = mem.read8(regs.de); m.step(0x2a82, 7); // 2a81  ld a,(de)
    regs.sub(mem.read8(regs.hl)); m.step(0x2a83, 7); // 2a82  sub (hl)
    if (regs.fNZ) { m.step(0x29a0, 10); return m.call(0x29a0); } // 2a83  jp nz,0x29a0 (guard)
    m.step(0x2a86, 10);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2a87, 6); // 2a86  inc hl
    regs.de = (regs.de + 1) & 0xffff; m.step(0x2a88, 6); // 2a87  inc de
    if (regs.djnz() !== 0) { m.step(0x2a81, 13); continue; } // 2a88  djnz 0x2a81
    m.step(0x2a8a, 8); break;
  }
  mem.write8((regs.ix + 0x11) & 0xffff, 0x30); m.step(0x2a8e, 19); // 2a8a  ld (ix+0x11),0x30
  mem.write8((regs.ix + 0x10) & 0xffff, regs.res(7, mem.read8((regs.ix + 0x10) & 0xffff))); m.step(0x2a92, 23); // 2a8e  res 7,(ix+0x10)
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x2a95, 23); // 2a92  inc (ix+0x02)
  m.ret(); // 2a95  ret
}
