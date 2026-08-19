// SPDX-License-Identifier: GPL-3.0-only

// loc_0e00  (ROM 0x0e00-0x0e45) -- reset the actor/sprite tables for a new board.
// Clears 0xbf bytes at 0x8900 (rst 0x10 memset=0) plus flags 0x880a / 0x89e1..3 / 0x8f5b; seeds two
// actor slots from cabinet byte 0x8807 (0x8948 / 0x8988) with X=0x20 (0x8941 / 0x8981) and colour
// byte 0x8820 (0x8940 / 0x8980); calls 0x02e3. Returns early (ret z) when 0x8806 is 0; otherwise
// clears 0x8f3f / 0x8f30 / 0x8f0e / 0x8f0f. Called from 0x0dc6, jumped to from 0x0ba8 / 0x70e7.
export function loc_0e00(m) {
  const { regs, mem } = m;

  regs.hl = 0x8900; m.step(0x0e03, 10); // 0e00  ld hl,0x8900
  regs.xor(regs.a); m.step(0x0e04, 4); // 0e03  xor a
  mem.write8(0x880a, regs.a); m.step(0x0e07, 13);
  mem.write8(0x89e1, regs.a); m.step(0x0e0a, 13);
  mem.write8(0x89e2, regs.a); m.step(0x0e0d, 13);
  mem.write8(0x89e3, regs.a); m.step(0x0e10, 13);
  mem.write8(0x8f5b, regs.a); m.step(0x0e13, 13);
  regs.b = 0xbf; m.step(0x0e15, 7); // 0e13  ld b,0xbf
  m.push16(0x0e16); m.step(0x0010, 11); m.call(0x0010); // 0e15  rst 0x10 -- memset 0xbf bytes @0x8900 = 0
  regs.a = mem.read8(0x8807); m.step(0x0e19, 13); // 0e16  cabinet byte
  mem.write8(0x8948, regs.a); m.step(0x0e1c, 13);
  mem.write8(0x8988, regs.a); m.step(0x0e1f, 13);
  regs.a = 0x20; m.step(0x0e21, 7); // 0e1f  ld a,0x20 (initial X)
  mem.write8(0x8941, regs.a); m.step(0x0e24, 13);
  mem.write8(0x8981, regs.a); m.step(0x0e27, 13);
  regs.a = mem.read8(0x8820); m.step(0x0e2a, 13); // 0e27  colour byte
  mem.write8(0x8940, regs.a); m.step(0x0e2d, 13);
  mem.write8(0x8980, regs.a); m.step(0x0e30, 13);
  m.push16(0x0e33); m.step(0x02e3, 17); m.call(0x02e3); // 0e30  call 0x02e3 -- pattern A
  regs.a = mem.read8(0x8806); m.step(0x0e36, 13); // 0e33  ld a,(0x8806)
  regs.and(regs.a); m.step(0x0e37, 4); // 0e36  and a
  if (regs.fZ) { m.ret(11); return; } // 0e37  ret z (0x8806 == 0)
  m.step(0x0e38, 5); // 0e37  ret z not taken
  regs.xor(regs.a); m.step(0x0e39, 4); // 0e38  xor a
  mem.write8(0x8f3f, regs.a); m.step(0x0e3c, 13);
  mem.write8(0x8f30, regs.a); m.step(0x0e3f, 13);
  mem.write8(0x8f0e, regs.a); m.step(0x0e42, 13);
  mem.write8(0x8f0f, regs.a); m.step(0x0e45, 13);
  m.ret(); // 0e45  ret
}
