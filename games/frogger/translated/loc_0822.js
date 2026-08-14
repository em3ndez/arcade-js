// SPDX-License-Identifier: GPL-3.0-only

// loc_0822  (ROM 0x0822-0x085A) — player-swap + cocktail flip: clear (0x8371); return if 1-player.
// Toggle current player (0x83FD ^= 3), load that player's lives from 0x83B8/9 into (0x83B7), reset
// (0x83B6)=0/(0x825A)=1, and (when (0x83C2)!=0) toggle the cocktail flip latch (0x83CB^1 -> flip_x
// 0xB810, flip_y 0xB80C). Called from loc_0457 (0x0489).
export function loc_0822(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x0823, 4);
  mem.write8(0x8371, regs.a);
  m.step(0x0826, 13); // (0x8371) = 0
  regs.a = mem.read8(0x83fe);
  m.step(0x0829, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x082a, 4); // Z iff single player
  if (regs.fZ) {
    m.ret(11);
    return;
  }
  m.step(0x082b, 5);

  regs.a = mem.read8(0x83fd);
  m.step(0x082e, 13);
  regs.xor(0x03);
  m.step(0x0830, 7); // toggle the active-player bits
  mem.write8(0x83fd, regs.a);
  m.step(0x0833, 13);
  regs.hl = 0x83b8;
  m.step(0x0836, 10);
  regs.a = regs.dec8(regs.a);
  m.step(0x0837, 4);
  if (regs.fZ) {
    m.step(0x083a, 12);
  } else {
    m.step(0x0839, 7);
    regs.l = regs.inc8(regs.l);
    m.step(0x083a, 4); // player 2 -> (0x83b9)
  }
  regs.a = mem.read8(regs.hl);
  m.step(0x083b, 7);
  mem.write8(0x83b7, regs.a);
  m.step(0x083e, 13); // (0x83b7) = this player's lives
  regs.xor(regs.a);
  m.step(0x083f, 4);
  mem.write8(0x83b6, regs.a);
  m.step(0x0842, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x0843, 4);
  mem.write8(0x825a, regs.a);
  m.step(0x0846, 13); // (0x825a) = 1
  regs.a = mem.read8(0x83c2);
  m.step(0x0849, 13);
  regs.or(regs.a);
  m.step(0x084a, 4);
  if (regs.fZ) {
    m.ret(11);
    return;
  }
  m.step(0x084b, 5);

  regs.a = mem.read8(0x83cb);
  m.step(0x084e, 13);
  regs.xor(0x01);
  m.step(0x0850, 7); // toggle the cocktail flip bit
  mem.write8(0x83cb, regs.a);
  m.step(0x0853, 13);
  regs.h = regs.a;
  m.step(0x0854, 4);
  mem.write8(0xb810, regs.a, 10);
  m.step(0x0857, 13); // (0xb810) flip_x = D0
  mem.write8(0xb80c, regs.a, 10);
  m.step(0x085a, 13); // (0xb80c) flip_y = D0
  m.ret();
}
