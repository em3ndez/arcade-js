// SPDX-License-Identifier: GPL-3.0-only

// loc_2d88  (ROM 0x2D88-0x2DC8) — MODE-2 intro: set (0x83D8)=0xFF, call loc_0766, seed (0x829B)=0,
// (0x8021)=0, (0x801B)=5, (0x802B)=3; blit an 0x0B-tile title strip (rst 0x28) from 0x2F5C to 0xAA8D.
// If (0x83E4) >= 10 return; else call loc_0ba9 and blit three more strips before returning.
export function loc_2d88(m) {
  const { regs, mem } = m;

  regs.hl = 0x83d8;
  m.step(0x2d8b, 10);
  mem.write8(regs.hl, 0xff);
  m.step(0x2d8d, 10); // (0x83d8) = 0xff
  m.push16(0x2d90);
  m.step(0x0766, 17);
  m.call(0x0766);

  regs.xor(regs.a);
  m.step(0x2d91, 4);
  mem.write8(0x829b, regs.a);
  m.step(0x2d94, 13); // (0x829b) = 0
  mem.write8(0x8021, regs.a);
  m.step(0x2d97, 13); // (0x8021) = 0
  regs.a = 0x05;
  m.step(0x2d99, 7);
  mem.write8(0x801b, regs.a);
  m.step(0x2d9c, 13); // (0x801b) = 5
  regs.a = 0x03;
  m.step(0x2d9e, 7);
  mem.write8(0x802b, regs.a);
  m.step(0x2da1, 13); // (0x802b) = 3
  regs.de = 0x2f5c;
  m.step(0x2da4, 10);
  regs.hl = 0xaa8d;
  m.step(0x2da7, 10);
  regs.b = 0x0b;
  m.step(0x2da9, 7);
  m.push16(0x2daa);
  m.step(0x0028, 11); // rst 0x28 -- blit 0x0b tiles from 0x2f5c to 0xaa8d
  m.call(0x0028);

  regs.a = mem.read8(0x83e4);
  m.step(0x2dad, 13);
  regs.cp(0x0a);
  m.step(0x2daf, 7); // cp 0x0a -- (0x83e4) vs 10
  if (regs.fNC) {
    m.ret(11);
    return;
  }
  m.step(0x2db0, 5);

  regs.hl = 0xab15;
  m.step(0x2db3, 10);
  m.push16(0x2db6);
  m.step(0x0ba9, 17);
  m.call(0x0ba9);

  regs.de = 0x2fae;
  m.step(0x2db9, 10);
  regs.b = 0x07;
  m.step(0x2dbb, 7);
  m.push16(0x2dbc);
  m.step(0x0028, 11); // rst 0x28 -- blit 0x07 tiles from 0x2fae
  m.call(0x0028);

  regs.de = 0x2f73;
  m.step(0x2dbf, 10);
  regs.b = 0x04;
  m.step(0x2dc1, 7);
  m.push16(0x2dc2);
  m.step(0x0028, 11); // rst 0x28 -- blit 0x04 tiles from 0x2f73
  m.call(0x0028);

  regs.de = 0x2f92;
  m.step(0x2dc5, 10);
  regs.b = 0x07;
  m.step(0x2dc7, 7);
  m.push16(0x2dc8);
  m.step(0x0028, 11); // rst 0x28 -- blit 0x07 tiles from 0x2f92
  m.call(0x0028);

  m.ret();
}
