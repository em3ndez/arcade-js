// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1186  (ROM 0x1186–0x11A1) — table copy (0x122A) + object init (0x11D3) over IX=0x6500.
 */
export function loc_1186(m) {
  const { regs } = m;
  regs.hl = 0x11a2; // -> 4-byte data block, not code
  m.step(0x1189, 10); // ld hl,0x11a2
  regs.de = 0x6507;
  m.step(0x118c, 10); // ld de,0x6507
  regs.bc = 0x0a0c;
  m.step(0x118f, 10); // ld bc,0x0a0c
  m.push16(0x1192); m.step(0x122a, 17); m.call(0x122a); // call 0x122a
  regs.ix = 0x6500;
  m.step(0x1196, 14); // ld ix,0x6500
  regs.hl = 0x6980;
  m.step(0x1199, 10); // ld hl,0x6980
  regs.b = 0x0a; // C left by 0x122A
  m.step(0x119b, 7); // ld b,0x0a
  regs.de = 0x0010; // stride
  m.step(0x119e, 10); // ld de,0x0010
  m.push16(0x11a1); m.step(0x11d3, 17); m.call(0x11d3); // call 0x11d3
  m.ret();
}
