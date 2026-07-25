// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_04be  (ROM 0x04BE–0x04DE) — (6227)==4 blink block (COLD/latent): two colour writes, then bit6/X routing.
 */
export function loc_04be(m) {
  const { regs, mem } = m;
  regs.a = 0x10;
  m.step(0x04c0, 7); // ld a,0x10
  regs.hl = 0x7623;
  m.step(0x04c3, 10); // ld hl,0x7623
  m.push16(0x04c6); m.step(0x0514, 17); m.call(0x0514); // call 0x0514
  regs.hl = 0x7583;
  m.step(0x04c9, 10); // ld hl,0x7583
  m.push16(0x04cc); m.step(0x0514, 17); m.call(0x0514); // call 0x0514
  regs.bit(6, regs.c);
  m.step(0x04ce, 8); // bit 6,c
  if (regs.fZ) { m.step(0x0509, 10); return m.call(0x0509); } // jp z,0x0509
  m.step(0x04d1, 10);
  regs.a = mem.read8(0x6203);
  m.step(0x04d4, 13); // ld a,(0x6203)
  regs.cp(0x80);
  m.step(0x04d6, 7); // cp 0x80
  if (regs.fNC) { m.step(0x04f1, 10); return m.call(0x04f1); } // jp nc,0x04f1
  m.step(0x04d9, 10); // (6203) < 0x80
  regs.a = 0xdf;
  m.step(0x04db, 7); // ld a,0xdf
  regs.hl = 0x7623;
  m.step(0x04de, 10); // ld hl,0x7623
  m.push16(0x04e1); m.step(0x0514, 17); m.call(0x0514); // call 0x0514 -> falls into 0x04e1
  return m.call(0x04e1);
}
