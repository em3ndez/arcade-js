// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2a96  (ROM 0x2a96-0x2ab2) -- 0x8a80 actor state 5 (dispatch 0x28f1[5]). A 0x20-byte ROM
// self-check comparing 0x2b23.. against 0x67df.. (descending); any mismatch re-enters loc_2a01. On
// success it reseeds the frame delay (ix+0x11)=0x18, sets the flip bit (ix+0x10 bit7), advances state.
export function loc_2a96(m) {
  const { regs, mem } = m;

  regs.hl = 0x67df; m.step(0x2a99, 10); // 2a96  ld hl,0x67df
  regs.de = 0x2b23; m.step(0x2a9c, 10); // 2a99  ld de,0x2b23
  regs.b = 0x20; m.step(0x2a9e, 7); // 2a9c  ld b,0x20
  for (;;) {
    regs.a = mem.read8(regs.de); m.step(0x2a9f, 7); // 2a9e  ld a,(de)
    regs.sub(mem.read8(regs.hl)); m.step(0x2aa0, 7); // 2a9f  sub (hl)
    if (regs.fNZ) { m.step(0x2a01, 10); return m.call(0x2a01); } // 2aa0  jp nz,0x2a01 (guard)
    m.step(0x2aa3, 10);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x2aa4, 6); // 2aa3  inc hl
    regs.de = (regs.de - 1) & 0xffff; m.step(0x2aa5, 6); // 2aa4  dec de
    if (regs.djnz() !== 0) { m.step(0x2a9e, 13); continue; } // 2aa5  djnz 0x2a9e
    m.step(0x2aa7, 8); break;
  }
  mem.write8((regs.ix + 0x11) & 0xffff, 0x18); m.step(0x2aab, 19); // 2aa7  ld (ix+0x11),0x18
  mem.write8((regs.ix + 0x10) & 0xffff, regs.set(7, mem.read8((regs.ix + 0x10) & 0xffff))); m.step(0x2aaf, 23); // 2aab  set 7,(ix+0x10)
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x2ab2, 23); // 2aaf  inc (ix+0x02)
  m.ret(); // 2ab2  ret
}
