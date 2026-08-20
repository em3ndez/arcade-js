// SPDX-License-Identifier: GPL-3.0-only

// loc_5e11  (ROM 0x5e11-0x5e1e) -- B-iteration proximity sweep. For each of B target slots it calls
// loc_5e1f (tests source IX against target IY; on a hit sets flag 0x8d32 and re-inits the record),
// then advances IY by 4 and HL by 0x18 and loops via djnz. Its own call target and also fallen into
// from loc_5df7 (which seeds IX/IY/HL/B). Each `call 0x5e1f` pushes 0x5e14.
export function loc_5e11(m) {
  const { regs, mem } = m;

  for (;;) {
    m.push16(0x5e14);
    m.step(0x5e1f, 17);            // 5e11  call 0x5e1f
    m.call(0x5e1f);
    if (m.pc !== 0x5e14) return;   // loc_5e1f skip-returned past this loop; propagate
    regs.de = 0x0004;             m.step(0x5e17, 10); // 5e14  ld de,0x0004
    regs.addIy(regs.de);          m.step(0x5e19, 15); // 5e17  add iy,de
    regs.e = 0x18;                m.step(0x5e1b, 7);  // 5e19  ld e,0x18
    regs.addHl(regs.de);          m.step(0x5e1c, 11); // 5e1b  add hl,de
    if (regs.djnz()) { m.step(0x5e11, 13); } else { m.step(0x5e1e, 8); break; } // 5e1c  djnz 0x5e11
  }
  return m.ret(10); // 5e1e  ret
}
