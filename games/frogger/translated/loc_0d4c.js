// SPDX-License-Identifier: GPL-3.0-only

// loc_0d4c  (ROM 0x0D4C-0x0DB8) — in-play board init (the loc_0d11 (0x83E1)!=0 arm). Guarded once per
// board by (0x83BA): if already nonzero it returns; otherwise clears (0x8293)/(0x81B3)/(0x825B)/
// (0x829A), marks (0x83BA)=1, runs the object/lane setup calls, seeds lane params (0x801B)=4 and
// (0x8029)=6, and blits the HUD strings (rst 0x28 from the 0x2Fxx source tables).
export function loc_0d4c(m) {
  const { regs, mem } = m;

  m.push16(0x0d4f);
  m.step(0x07e6, 17);
  m.call(0x07e6); // call 0x07e6 -- clear the object/actor table

  regs.a = mem.read8(0x83ba);
  m.step(0x0d52, 13); // A = (0x83ba) board-init-done flag
  regs.or(regs.a);
  m.step(0x0d53, 4);
  if (regs.fNZ) {
    m.ret(11); // ret nz -- already initialised this board
    return;
  }
  m.step(0x0d54, 5);

  regs.h = regs.a;
  m.step(0x0d55, 4);
  regs.l = regs.a;
  m.step(0x0d56, 4); // HL = 0
  mem.write16(0x8293, regs.hl);
  m.step(0x0d59, 16);
  mem.write16(0x81b3, regs.hl);
  m.step(0x0d5c, 16);
  mem.write8(0x825b, regs.a);
  m.step(0x0d5f, 13);
  mem.write8(0x829a, regs.a);
  m.step(0x0d62, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x0d63, 4);
  mem.write8(0x83ba, regs.a);
  m.step(0x0d66, 13); // (0x83ba) = 1

  m.push16(0x0d69);
  m.step(0x223d, 17);
  m.call(0x223d);
  m.push16(0x0d6c);
  m.step(0x0804, 17);
  m.call(0x0804);
  m.push16(0x0d6f);
  m.step(0x0766, 17);
  m.call(0x0766);
  m.push16(0x0d72);
  m.step(0x064b, 17);
  m.call(0x064b);

  regs.a = 0x04;
  m.step(0x0d74, 7);
  mem.write8(0x801b, regs.a);
  m.step(0x0d77, 13); // (0x801b) = 4 lane param
  regs.a = 0x06;
  m.step(0x0d79, 7);
  mem.write8(0x8029, regs.a);
  m.step(0x0d7c, 13); // (0x8029) = 6 lane param

  regs.hl = 0xaa28;
  m.step(0x0d7f, 10);
  regs.de = 0x2f77;
  m.step(0x0d82, 10);
  regs.b = 0x04;
  m.step(0x0d84, 7);
  m.push16(0x0d85);
  m.step(0x0028, 11); // rst 0x28 -- blit 4 tiles
  m.call(0x0028);

  regs.hl = 0xaaad;
  m.step(0x0d88, 10);
  regs.e = regs.inc8(regs.e);
  m.step(0x0d89, 4); // inc e -- skip one source byte (DE advanced by the blit)
  regs.b = 0x0c;
  m.step(0x0d8b, 7);
  m.push16(0x0d8c);
  m.step(0x0028, 11); // rst 0x28 -- blit 0x0c tiles
  m.call(0x0028);

  m.push16(0x0d8f);
  m.step(0x0db9, 17);
  m.call(0x0db9); // call 0x0db9 -- queue the credit/1UP HUD tiles

  regs.hl = 0xab74;
  m.step(0x0d92, 10);
  regs.de = 0x2f88;
  m.step(0x0d95, 10);
  regs.b = 0x03;
  m.step(0x0d97, 7);
  m.push16(0x0d98);
  m.step(0x0028, 11); // rst 0x28 -- blit 3 tiles
  m.call(0x0028);

  regs.de = 0x2fa8;
  m.step(0x0d9b, 10);
  regs.b = 0x06;
  m.step(0x0d9d, 7);
  m.push16(0x0d9e);
  m.step(0x0028, 11); // rst 0x28 -- blit 6 tiles
  m.call(0x0028);

  regs.de = 0x2fae;
  m.step(0x0da1, 10);
  regs.b = 0x05;
  m.step(0x0da3, 7);
  m.push16(0x0da4);
  m.step(0x0028, 11); // rst 0x28 -- blit 5 tiles
  m.call(0x0028);

  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0da5, 6); // inc de -- skip one source byte (DE advanced by the blit)
  regs.b = 0x07;
  m.step(0x0da7, 7);
  m.push16(0x0da8);
  m.step(0x0028, 11); // rst 0x28 -- blit 7 tiles
  m.call(0x0028);

  regs.hl = 0xa994;
  m.step(0x0dab, 10);
  regs.de = mem.read16(0x2e08);
  m.step(0x0daf, 20); // DE = (0x2e08) score-target word from ROM data
  m.push16(0x0db2);
  m.step(0x0b95, 17);
  m.call(0x0b95); // call 0x0b95 -- draw the score-target digits at 0xa994

  regs.de = 0x2fba;
  m.step(0x0db5, 10);
  regs.b = 0x04;
  m.step(0x0db7, 7);
  m.push16(0x0db8);
  m.step(0x0028, 11); // rst 0x28 -- blit 4 tiles
  m.call(0x0028);
  m.ret();
}
