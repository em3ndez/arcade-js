// SPDX-License-Identifier: GPL-3.0-only

// loc_3c92  (ROM 0x3c92-0x3cad) -- object state-1 handler (0x33a7 dispatch, index 1).
// Ticks loc_4006, then counts down the frame timer (ix+0x11); once it elapses it walks 4 records
// (IY over 0x8c30, stride 0x18) calling loc_3cae to seat a spawned child into the first free slot.
// loc_3cae is a CALLER-SKIP: it returns true (slot occupied -> keep scanning) or, once it launches
// a child, aborts this loop by returning to loc_3c92's OWN caller (JS: it returns false, and we just
// return). If the loop completes with no launch, reseed the timer to 0x10 and ret.
export function loc_3c92(m) {
  const { regs, mem } = m;

  m.push16(0x3c95); m.step(0x4006, 17); m.call(0x4006); // 3c92  call 0x4006
  regs.decMem8(mem, (regs.ix + 0x11) & 0xffff); m.step(0x3c98, 23); // 3c95  dec (ix+0x11)
  if (regs.fNZ) { m.ret(11); return; } // 3c98  ret nz -- timer not elapsed
  m.step(0x3c99, 5);
  regs.iy = 0x8c30; m.step(0x3c9d, 14); // 3c99  ld iy,0x8c30
  regs.de = 0x0018; m.step(0x3ca0, 10); // 3c9d  ld de,0x0018 (stride)
  regs.b = 0x04; m.step(0x3ca2, 7); // 3ca0  ld b,0x04

  for (;;) {
    m.push16(0x3ca5); m.step(0x3cae, 17);
    if (!m.call(0x3cae)) return; // 3ca2  call 0x3cae -- launched -> caller-skip aborts the loop
    regs.addIy(regs.de); m.step(0x3ca7, 15); // 3ca5  add iy,de -- next record
    if (regs.djnz() !== 0) { m.step(0x3ca2, 13); continue; } // 3ca7  djnz 0x3ca2
    m.step(0x3ca9, 8);
    break;
  }
  mem.write8((regs.ix + 0x11) & 0xffff, 0x10); m.step(0x3cad, 19); // 3ca9  ld (ix+0x11),0x10
  m.ret(); // 3cad  ret
}
