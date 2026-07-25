// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1131  (ROM 0x1131–0x117A) — arm C=4 of the 0x0FCD inline table: 4 table copies + two (ix+d) init (stride 0x20).
 */
export function loc_1131(m) {
  const { regs, mem } = m;
  regs.hl = 0x3df0;
  m.step(0x1134, 10); // ld hl,0x3df0
  regs.de = 0x6407;
  m.step(0x1137, 10); // ld de,0x6407
  regs.bc = 0x051c;
  m.step(0x113a, 10); // ld bc,0x051c
  m.push16(0x113d); m.step(0x122a, 17); m.call(0x122a); // call 0x122a
  regs.hl = 0x3e14;
  m.step(0x1140, 10); // ld hl,0x3e14 (live-in to sub_11a6)
  m.push16(0x1143); m.step(0x11a6, 17); m.call(0x11a6); // call 0x11a6
  regs.hl = 0x3e54;
  m.step(0x1146, 10); // ld hl,0x3e54
  regs.de = 0x6a0c;
  m.step(0x1149, 10); // ld de,0x6a0c
  regs.bc = 0x000c;
  m.step(0x114c, 10); // ld bc,0x000c
  m.ldir(0x114e); // ldir 0x0C bytes -> 0x6A0C
  regs.hl = 0x1182; // 2nd data unit, used first
  m.step(0x1151, 10); // ld hl,0x1182
  regs.de = 0x64a3;
  m.step(0x1154, 10); // ld de,0x64a3
  regs.bc = 0x021e;
  m.step(0x1157, 10); // ld bc,0x021e
  m.push16(0x115a); m.step(0x11ec, 17); m.call(0x11ec); // call 0x11ec
  regs.hl = 0x117e; // 1st data unit, used second
  m.step(0x115d, 10); // ld hl,0x117e
  regs.de = 0x64a7;
  m.step(0x1160, 10); // ld de,0x64a7
  regs.bc = 0x021c;
  m.step(0x1163, 10); // ld bc,0x021c
  m.push16(0x1166); m.step(0x122a, 17); m.call(0x122a); // call 0x122a
  regs.ix = 0x64a0;
  m.step(0x116a, 14); // ld ix,0x64a0
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);
  m.step(0x116e, 19); // ld (ix+0x00),0x01
  mem.write8((regs.ix + 0x20) & 0xffff, 0x01);
  m.step(0x1172, 19); // ld (ix+0x20),0x01 (stride 0x20)
  regs.hl = 0x6950;
  m.step(0x1175, 10); // ld hl,0x6950
  regs.b = 0x02;
  m.step(0x1177, 7); // ld b,0x02
  regs.de = 0x0020; // stride
  m.step(0x117a, 10); // ld de,0x0020
  m.push16(0x117d); m.step(0x11d3, 17); m.call(0x11d3); // call 0x11d3
  m.ret();
}
