// SPDX-License-Identifier: GPL-3.0-only

// loc_0b1f  (ROM 0x0B1F-0x0B66) — redraw the score header each frame: blit the "1UP"/"HI"/"2UP"
// label strips via rst 0x28 and print the P1 score (0x83EF), high score (0x83ED) and, only when
// two players are selected ((0x8370) != 1), the P2 score (0x83EB), each through loc_0b95/loc_0ba9.
export function loc_0b1f(m) {
  const { regs, mem } = m;

  regs.de = 0x2ee2;
  m.step(0x0b22, 10);
  regs.hl = 0xaa60;
  m.step(0x0b25, 10);
  regs.b = 0x08;
  m.step(0x0b27, 7);
  m.push16(0x0b28);
  m.step(0x0028, 11); // rst 0x28 -- blit the "1UP" label strip
  m.call(0x0028);

  regs.hl = 0xaa41;
  m.step(0x0b2b, 10);
  regs.de = mem.read16(0x83ef);
  m.step(0x0b2f, 20); // DE = (0x83ef) P1 score (BCD)
  m.push16(0x0b32);
  m.step(0x0b95, 17); // call 0x0b95 -- print P1 score
  m.call(0x0b95);

  regs.a = 0x01;
  m.step(0x0b34, 7);
  regs.hl = 0xab20;
  m.step(0x0b37, 10);
  m.push16(0x0b3a);
  m.step(0x0ba9, 17); // call 0x0ba9 -- the "0" tacked onto the score
  m.call(0x0ba9);

  regs.de = 0x2edf;
  m.step(0x0b3d, 10);
  regs.b = 0x03;
  m.step(0x0b3f, 7);
  m.push16(0x0b40);
  m.step(0x0028, 11); // rst 0x28 -- blit the "HI" label strip
  m.call(0x0028);

  regs.hl = 0xab41;
  m.step(0x0b43, 10);
  regs.de = mem.read16(0x83ed);
  m.step(0x0b47, 20); // DE = (0x83ed) high score (BCD)
  m.push16(0x0b4a);
  m.step(0x0b95, 17); // call 0x0b95 -- print high score
  m.call(0x0b95);

  regs.a = mem.read8(0x8370);
  m.step(0x0b4d, 13); // A = (0x8370) player count
  regs.a = regs.dec8(regs.a);
  m.step(0x0b4e, 4);
  if (regs.fZ) {
    m.ret(11); // ret z -- single player, no P2 score
    return;
  }
  m.step(0x0b4f, 5);

  regs.a = 0x02;
  m.step(0x0b51, 7);
  regs.hl = 0xa900;
  m.step(0x0b54, 10);
  m.push16(0x0b57);
  m.step(0x0ba9, 17); // call 0x0ba9 -- the "0" on the P2 score
  m.call(0x0ba9);

  regs.de = 0x2edf;
  m.step(0x0b5a, 10);
  regs.b = 0x03;
  m.step(0x0b5c, 7);
  m.push16(0x0b5d);
  m.step(0x0028, 11); // rst 0x28 -- blit the "2UP" label strip
  m.call(0x0028);

  regs.hl = 0xa921;
  m.step(0x0b60, 10);
  regs.de = mem.read16(0x83eb);
  m.step(0x0b64, 20); // DE = (0x83eb) P2 score (BCD)

  m.step(0x0b95, 10); // jp 0x0b95 -- print P2 score
  return m.call(0x0b95);
}
