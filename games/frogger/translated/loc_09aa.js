// SPDX-License-Identifier: GPL-3.0-only

// loc_09aa  (ROM 0x09AA-0x09C9) — frog-object RESET: write the 0x8044 object block
// (0x80,0x1e,0x03,0xe0), clear 0x83cd/0x842d/0x842c/0x8269, set 0x83c3=1. PURE LEAF; external
// call target from 0x2332 (also entered from loc_0942 interior).
export function loc_09aa(m) {
  const { regs, mem } = m;

  regs.hl = 0x8044;
  m.step(0x09ad, 10);
  mem.write8(regs.hl, 0x80);
  m.step(0x09af, 10); // (0x8044) -- object X
  regs.l = regs.inc8(regs.l);
  m.step(0x09b0, 4);
  mem.write8(regs.hl, 0x1e);
  m.step(0x09b2, 10); // (0x8045) -- object Y
  regs.l = regs.inc8(regs.l);
  m.step(0x09b3, 4);
  mem.write8(regs.hl, 0x03);
  m.step(0x09b5, 10); // (0x8046)
  regs.l = regs.inc8(regs.l);
  m.step(0x09b6, 4);
  mem.write8(regs.hl, 0xe0);
  m.step(0x09b8, 10); // (0x8047)
  regs.xor(regs.a);
  m.step(0x09b9, 4); // A = 0
  mem.write8(0x83cd, regs.a);
  m.step(0x09bc, 13);
  mem.write8(0x842d, regs.a);
  m.step(0x09bf, 13);
  mem.write8(0x842c, regs.a);
  m.step(0x09c2, 13);
  mem.write8(0x8269, regs.a);
  m.step(0x09c5, 13);
  regs.a = regs.inc8(regs.a);
  m.step(0x09c6, 4); // A = 1
  mem.write8(0x83c3, regs.a);
  m.step(0x09c9, 13);
  m.ret();
}
