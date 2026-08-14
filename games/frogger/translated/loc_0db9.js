// SPDX-License-Identifier: GPL-3.0-only

// loc_0db9  (ROM 0x0DB9-0x0DDF) — queue the credit/1UP display tiles. With one credit ((0x83E1)==1)
// blit the "1UP" strips from 0xAAF1 (rst 0x28). Otherwise set (0x8023)=3, blit from 0xAB11, and cap
// the cursor with tile 0x23. Called from the board-init path (0x0D8C).
export function loc_0db9(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83e1);
  m.step(0x0dbc, 13); // A = (0x83e1) credit count
  regs.de = 0x2f88;
  m.step(0x0dbf, 10); // DE = tile-source base
  regs.a = regs.dec8(regs.a);
  m.step(0x0dc0, 4); // Z iff (0x83e1) == 1
  if (regs.fZ) {
    m.step(0x0dd3, 12);
    return block_0dd3();
  }
  m.step(0x0dc2, 7);

  regs.a = 0x03;
  m.step(0x0dc4, 7);
  mem.write8(0x8023, regs.a);
  m.step(0x0dc7, 13); // (0x8023) = 3
  regs.hl = 0xab11;
  m.step(0x0dca, 10);
  regs.b = 0x04;
  m.step(0x0dcc, 7);
  m.push16(0x0dcd);
  m.step(0x0028, 11); // rst 0x28 -- blit 4 tiles
  m.call(0x0028);
  regs.b = 0x0d;
  m.step(0x0dcf, 7);
  m.push16(0x0dd0);
  m.step(0x0028, 11); // rst 0x28 -- blit 0x0d tiles
  m.call(0x0028);
  mem.write8(regs.hl, 0x23);
  m.step(0x0dd2, 10); // (hl) = 0x23 at the advanced cursor
  m.ret();

  function block_0dd3() {
    regs.hl = 0xaaf1;
    m.step(0x0dd6, 10);
    regs.b = 0x04;
    m.step(0x0dd8, 7);
    m.push16(0x0dd9);
    m.step(0x0028, 11); // rst 0x28 -- blit 4 tiles
    m.call(0x0028);
    regs.de = 0x2f93;
    m.step(0x0ddc, 10);
    regs.b = 0x0b;
    m.step(0x0dde, 7);
    m.push16(0x0ddf);
    m.step(0x0028, 11); // rst 0x28 -- blit 0x0b tiles
    m.call(0x0028);
    m.ret();
  }
}
