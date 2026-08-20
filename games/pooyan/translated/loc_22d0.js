// SPDX-License-Identifier: GPL-3.0-only

// loc_22d0  (ROM 0x22d0-0x22e5) -- 2-entry bit-0 tally over the object table at 0x8c90 (stride 0x18).
// For each of the two entries, `bit 0,(iy+0)` gates an `rlca` of the accumulator A (seeded 0); the
// running value is returned in A. No calls; leaf.
export function loc_22d0(m) {
  const { regs, mem } = m;

  regs.iy = 0x8c90;                         m.step(0x22d4, 14);
  regs.de = 0x0018;                         m.step(0x22d7, 10);
  regs.b = 0x02;                            m.step(0x22d9, 7);
  regs.xor(regs.a);                         m.step(0x22da, 4);

  for (;;) { // loc_22da
    const bit0 = regs.bit(0, mem.read8(regs.iy)); m.step(0x22de, 20); // bit 0,(iy+0); Z=!bit0
    if (bit0) {
      m.step(0x22e0, 7);                    // jr z not taken (bit0 set)
      regs.rlca();                          m.step(0x22e1, 4);
    } else {
      m.step(0x22e1, 12);                   // jr z taken (bit0 clear)
    }
    regs.addIy(regs.de);                    m.step(0x22e3, 15);
    if (regs.djnz()) { m.step(0x22da, 13); } else { m.step(0x22e5, 8); break; }
  }
  return m.ret(10);
}
