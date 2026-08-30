// SPDX-License-Identifier: GPL-3.0-only

// loc_1219  (ROM 0x1219-0x122b) -- per-object update sweep. Walks 14 object records
// starting at IX=0x8ae0 with stride DE=0x18, calling the per-object state dispatcher
// loc_122c on each. `exx` brackets the call so the loop counter B (and the other main
// registers) survive loc_122c's clobbering. After the last record it `ret`s.
export function loc_1219(m) {
  const { regs, mem } = m;

  regs.ix = 0x8ae0; // object-record table base
  m.step(0x121d, 14); // 1219  ld ix,0x8ae0
  regs.de = 0x0018; // record stride
  m.step(0x1220, 10); // 121d  ld de,0x0018
  regs.b = 0x0e; // 14 records
  m.step(0x1222, 7); // 1220  ld b,0x0e

  // loc_1222 -- the per-record loop.
  for (;;) {
    regs.exx();
    m.step(0x1223, 4); // 1222  exx -- stash loop regs across the call

    m.push16(0x1226); // 1223  call 0x122c -- seat the return
    m.step(0x122c, 17);
    m.call(0x122c, "loc_122c -- per-object state dispatcher");

    regs.exx();
    m.step(0x1227, 4); // 1226  exx -- restore loop regs

    regs.addIx(regs.de);
    m.step(0x1229, 15); // 1227  add ix,de -- advance to next record

    if (regs.djnz() !== 0) {
      m.step(0x1222, 13); // 1229  djnz 0x1222 (taken)
      continue;
    }
    m.step(0x122b, 8); // 1229  djnz (not taken)
    break;
  }

  m.ret(); // 122b  ret
}
