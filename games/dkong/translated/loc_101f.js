// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_101f  (ROM 0x101F–0x1086) — inline-table arm C=2: table copies + object init + ldir blocks; sets 0x62B9=1.
 */
export function loc_101f(m) {
  const { regs, mem } = m;
  regs.hl = 0x3dec;
  m.step(0x1022, 10); // ld hl,0x3dec
  regs.de = 0x6407;
  m.step(0x1025, 10); // ld de,0x6407
  regs.bc = 0x051c;
  m.step(0x1028, 10); // ld bc,0x051c
  m.push16(0x102b); m.step(0x122a, 17); m.call(0x122a);
  m.push16(0x102e); m.step(0x1186, 17); m.call(0x1186);
  regs.hl = 0x3e18;
  m.step(0x1031, 10); // ld hl,0x3e18
  regs.de = 0x65a7;
  m.step(0x1034, 10); // ld de,0x65a7
  regs.bc = 0x060c;
  m.step(0x1037, 10); // ld bc,0x060c
  m.push16(0x103a); m.step(0x122a, 17); m.call(0x122a);
  regs.ix = 0x65a0;
  m.step(0x103e, 14); // ld ix,0x65a0
  regs.hl = 0x69b8;
  m.step(0x1041, 10); // ld hl,0x69b8
  regs.de = 0x0010;
  m.step(0x1044, 10); // ld de,0x0010 (stride)
  regs.b = 0x06;
  m.step(0x1046, 7); // ld b,0x06
  m.push16(0x1049); m.step(0x11d3, 17); m.call(0x11d3);
  regs.hl = 0x3dfa;
  m.step(0x104c, 10); // ld hl,0x3dfa (live-in to sub_11fa)
  m.push16(0x104f); m.step(0x11fa, 17); m.call(0x11fa);
  regs.hl = 0x3e04;
  m.step(0x1052, 10); // ld hl,0x3e04
  regs.de = 0x69fc;
  m.step(0x1055, 10); // ld de,0x69fc
  regs.bc = 0x0004;
  m.step(0x1058, 10); // ld bc,0x0004
  m.ldir(0x105a);
  regs.hl = 0x3e1c;
  m.step(0x105d, 10); // ld hl,0x3e1c
  regs.de = 0x6944;
  m.step(0x1060, 10); // ld de,0x6944
  regs.bc = 0x0008;
  m.step(0x1063, 10); // ld bc,0x0008
  m.ldir(0x1065);
  regs.hl = 0x3e24;
  m.step(0x1068, 10); // ld hl,0x3e24
  regs.de = 0x69e4;
  m.step(0x106b, 10); // ld de,0x69e4
  regs.bc = 0x0018;
  m.step(0x106e, 10); // ld bc,0x0018
  m.ldir(0x1070);
  regs.hl = 0x3e10;
  m.step(0x1073, 10); // ld hl,0x3e10 (live-in to sub_11a6)
  m.push16(0x1076); m.step(0x11a6, 17); m.call(0x11a6);
  regs.hl = 0x3e3c;
  m.step(0x1079, 10); // ld hl,0x3e3c
  regs.de = 0x6a0c;
  m.step(0x107c, 10); // ld de,0x6a0c
  regs.bc = 0x000c;
  m.step(0x107f, 10); // ld bc,0x000c
  m.ldir(0x1081);
  regs.a = 0x01;
  m.step(0x1083, 7); // ld a,0x01
  mem.write8(0x62b9, regs.a); // 0x62B9 = 1
  m.step(0x1086, 13);
  m.ret();
}
