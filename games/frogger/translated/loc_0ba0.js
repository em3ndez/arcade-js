// SPDX-License-Identifier: GPL-3.0-only

// loc_0ba0  (ROM 0x0BA0-0x0BA8) — write a packed BCD byte (A) as two digits: rrca x4 lifts the high
// nibble into place and writes it via loc_0ba9, then the saved byte (C) falls through into loc_0ba9
// for the low nibble.
export function loc_0ba0(m) {
  const { regs } = m;

  regs.c = regs.a;
  m.step(0x0ba1, 4); // stash the byte

  regs.rrca();
  m.step(0x0ba2, 4);
  regs.rrca();
  m.step(0x0ba3, 4);
  regs.rrca();
  m.step(0x0ba4, 4);
  regs.rrca();
  m.step(0x0ba5, 4); // A = high nibble (rotated to bits 0-3)

  m.push16(0x0ba8);
  m.step(0x0ba9, 17); // call 0x0ba9 -- write the high digit
  m.call(0x0ba9);

  regs.a = regs.c;
  m.step(0x0ba9, 4); // restore the byte for the low nibble

  return m.call(0x0ba9); // fall through to loc_0ba9 -- write the low digit
}
