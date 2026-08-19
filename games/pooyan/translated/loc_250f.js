// SPDX-License-Identifier: GPL-3.0-only
//
// loc_250f  (ROM 0x250f-0x2513) -- shape-loader prologue: set the record stride DE=0x18 and count
// B=4, then fall into loc_2514 which copies four display tiles from (HL) into (ix+0x0f) of four
// consecutive 0x18-byte actor records. Called with HL = a 4-byte shape table (0x26bd/0x26c1/...).
export function loc_250f(m) {
  const { regs } = m;

  regs.de = 0x0018; m.step(0x2512, 10); // 250f  ld de,0x0018
  regs.b = 0x04; m.step(0x2514, 7); // 2512  ld b,0x04
  return m.call(0x2514); // fall into loc_2514
}
