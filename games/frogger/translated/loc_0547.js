// SPDX-License-Identifier: GPL-3.0-only

// loc_0547  (ROM 0x0547-0x0556) — cold-start new-game init, part 1: zero (0x825C) and the
// 0x825E-0x8262 table, then fall into loc_0557.
export function loc_0547(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x0548, 4);
  mem.write8(0x825c, regs.a);
  m.step(0x054b, 13); // (0x825c) = 0
  regs.hl = 0x825e;
  m.step(0x054e, 10);
  regs.de = 0x825f;
  m.step(0x0551, 10);
  regs.bc = 0x0004;
  m.step(0x0554, 10);
  mem.write8(regs.hl, regs.b);
  m.step(0x0555, 7); // seed (0x825e) = 0
  m.ldirAt(0x0555, 0x0557); // clear 0x825e-0x8262
  return m.call(0x0557); // fall through to loc_0557
}

// loc_0557  (ROM 0x0557-0x0566) — cold-start init part 2: zero (0x825D) and the 0x8263-0x8267 table,
// then fall into loc_0567. Mid-entry: loc_04f3 `jp nz,0x0557` lands here.
export function loc_0557(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x0558, 4);
  mem.write8(0x825d, regs.a);
  m.step(0x055b, 13); // (0x825d) = 0
  regs.hl = 0x8263;
  m.step(0x055e, 10);
  regs.de = 0x8264;
  m.step(0x0561, 10);
  regs.bc = 0x0004;
  m.step(0x0564, 10);
  mem.write8(regs.hl, regs.b);
  m.step(0x0565, 7); // seed (0x8263) = 0
  m.ldirAt(0x0565, 0x0567); // clear 0x8263-0x8267
  return m.call(0x0567); // fall through to loc_0567
}

// loc_0567  (ROM 0x0567-0x05D2) — cold-start init part 3: clear the screen (rst 38), run the RAM/HW
// init callees, LDIR-clear the play-field/actor RAM (0x8100-0x825F, 0x8000-0x8004, 0x800C-0x803A),
// zero the game-state bytes + the flip latches, set the game-mode byte (0x83D6)=3, force-clear the
// player work RAM (0x07EB), then jp 0x0368. Mid-entry: loc_0534 `jp 0x0567` lands here.
export function loc_0567(m) {
  const { regs, mem } = m;

  m.push16(0x0568);
  m.step(0x0038, 11); // rst 0x38 -- clear the screen
  m.call(0x0038);
  m.push16(0x056b);
  m.step(0x07e6, 17);
  m.call(0x07e6);
  m.push16(0x056e);
  m.step(0x0b67, 17);
  m.call(0x0b67);
  m.push16(0x0571);
  m.step(0x0f69, 17);
  m.call(0x0f69);
  m.push16(0x0574);
  m.step(0x0b1f, 17);
  m.call(0x0b1f);

  regs.hl = 0x8100;
  m.step(0x0577, 10);
  regs.de = 0x8101;
  m.step(0x057a, 10);
  regs.bc = 0x015f;
  m.step(0x057d, 10);
  mem.write8(regs.hl, regs.l);
  m.step(0x057e, 7); // seed (0x8100) = 0
  m.ldirAt(0x057e, 0x0580); // clear 0x8100-0x825f

  regs.hl = 0x8000;
  m.step(0x0583, 10);
  regs.de = 0x8001;
  m.step(0x0586, 10);
  regs.bc = 0x0004;
  m.step(0x0589, 10);
  mem.write8(regs.hl, regs.b);
  m.step(0x058a, 7); // seed (0x8000) = 0
  m.ldirAt(0x058a, 0x058c); // clear 0x8000-0x8004

  regs.hl = 0x800c;
  m.step(0x058f, 10);
  regs.de = 0x800d;
  m.step(0x0592, 10);
  regs.bc = 0x002e;
  m.step(0x0595, 10);
  mem.write8(regs.hl, regs.b);
  m.step(0x0596, 7); // seed (0x800c) = 0
  m.ldirAt(0x0596, 0x0598); // clear 0x800c-0x803a

  regs.xor(regs.a);
  m.step(0x0599, 4);
  mem.write8(0x83c3, regs.a);
  m.step(0x059c, 13);
  mem.write8(0x83fe, regs.a);
  m.step(0x059f, 13);
  mem.write8(0x83bf, regs.a);
  m.step(0x05a2, 13);
  regs.hl = 0x83c9;
  m.step(0x05a5, 10);
  mem.write8(regs.hl, regs.a);
  m.step(0x05a6, 7); // (0x83c9) = 0
  regs.l = regs.inc8(regs.l);
  m.step(0x05a7, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x05a8, 7); // (0x83ca) = 0
  regs.h = regs.a;
  m.step(0x05a9, 4);
  regs.l = regs.a;
  m.step(0x05aa, 4); // HL = 0x0000
  mem.write8(0xb810, regs.a, 10);
  m.step(0x05ad, 13); // flip_x = 0
  mem.write8(0xb80c, regs.a, 10);
  m.step(0x05b0, 13); // flip_y = 0
  mem.write16(0x8293, regs.hl);
  m.step(0x05b3, 16); // (0x8293) = 0x0000
  mem.write8(0x83bb, regs.a);
  m.step(0x05b6, 13);
  mem.write8(0x83cb, regs.a);
  m.step(0x05b9, 13);
  mem.write8(0x83d8, regs.a);
  m.step(0x05bc, 13);
  mem.write8(0x83c4, regs.a);
  m.step(0x05bf, 13);
  mem.write8(0x83ba, regs.a);
  m.step(0x05c2, 13);
  mem.write8(0x8295, regs.a);
  m.step(0x05c5, 13);
  mem.write8(0x825b, regs.a);
  m.step(0x05c8, 13);
  regs.a = 0x03;
  m.step(0x05ca, 7);
  mem.write8(0x83d6, regs.a);
  m.step(0x05cd, 13); // (0x83d6) = 3 game mode

  m.push16(0x05d0);
  m.step(0x07eb, 17); // call 0x07eb -- force-clear the player work RAM
  m.call(0x07eb);
  m.step(0x0368, 10); // jp 0x0368
  return m.call(0x0368);
}
