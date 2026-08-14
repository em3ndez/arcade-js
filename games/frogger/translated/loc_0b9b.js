// SPDX-License-Identifier: GPL-3.0-only

// loc_0b9b  (ROM 0x0B9B-0x0B9F) — write a 16-bit BCD value (DE) as four digits: the high byte (D)
// via loc_0ba0, then the low byte (E) falls through into loc_0ba0.
export function loc_0b9b(m) {
  const { regs } = m;

  regs.a = regs.d;
  m.step(0x0b9c, 4); // high BCD byte

  m.push16(0x0b9f);
  m.step(0x0ba0, 17); // call 0x0ba0
  m.call(0x0ba0);

  regs.a = regs.e;
  m.step(0x0ba0, 4); // low BCD byte

  return m.call(0x0ba0); // fall through to loc_0ba0
}
