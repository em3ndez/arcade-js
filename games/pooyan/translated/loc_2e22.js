// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2e22  (ROM 0x2e22-0x2e35) -- for each of the (0x8f18) active rope cells, drive one 0x8f1c-based
// record through loc_2e36 (IX over 0x8f1c.., parked with B in the alt set via exx across the call).
// loc_2e36 is a plain-ret dispatcher, so this is a straight pattern-A loop.
export function loc_2e22(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f18); m.step(0x2e25, 13); // 2e22  ld a,(0x8f18)
  regs.and(regs.a); m.step(0x2e26, 4); // 2e25  and a
  if (regs.fZ) { m.ret(11); return; } // 2e26  ret z
  m.step(0x2e27, 5);
  regs.ix = 0x8f1c; m.step(0x2e2b, 14); // 2e27  ld ix,0x8f1c
  regs.b = regs.a; m.step(0x2e2c, 4); // 2e2b  ld b,a
  for (;;) {
    regs.exx(); m.step(0x2e2d, 4); // 2e2c  exx -- park B
    m.push16(0x2e30); m.step(0x2e36, 17); m.call(0x2e36); // 2e2d  call 0x2e36
    regs.exx(); m.step(0x2e31, 4); // 2e30  exx -- restore B
    regs.ix = (regs.ix + 1) & 0xffff; m.step(0x2e33, 10); // 2e31  inc ix
    if (regs.djnz() !== 0) { m.step(0x2e2c, 13); continue; } // 2e33  djnz 0x2e2c
    m.step(0x2e35, 8); break;
  }
  m.ret(); // 2e35  ret
}
