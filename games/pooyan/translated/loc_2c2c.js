// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2c2c  (ROM 0x2c2c-0x2c3e) -- drive the 0x11 hunter records at 0x8ae0 (stride DE=0x18, parked in
// the alt set by exx across the call) through loc_2c3f. loc_2c3f dispatches per-record and is a
// caller-skip when a record reaches the spawn handler (loc_2c58): that aborts this loop.
export function loc_2c2c(m) {
  const { regs } = m;

  regs.ix = 0x8ae0; m.step(0x2c30, 14); // 2c2c  ld ix,0x8ae0
  regs.de = 0x0018; m.step(0x2c33, 10); // 2c30  ld de,0x0018
  regs.b = 0x11; m.step(0x2c35, 7); // 2c33  ld b,0x11
  for (;;) {
    regs.exx(); m.step(0x2c36, 4); // 2c35  exx -- park B/DE
    m.push16(0x2c39); m.step(0x2c3f, 17); // 2c36  call 0x2c3f
    if (!m.call(0x2c3f)) return; // caller-skip -> abort the loop
    regs.exx(); m.step(0x2c3a, 4); // 2c39  exx -- restore B/DE
    regs.addIx(regs.de); m.step(0x2c3c, 15); // 2c3a  add ix,de
    if (regs.djnz() !== 0) { m.step(0x2c35, 13); continue; } // 2c3c  djnz 0x2c35
    m.step(0x2c3e, 8); break;
  }
  m.ret(); // 2c3e  ret
}
