// SPDX-License-Identifier: GPL-3.0-only

// Normalize the value up into range: add a step (counting each) until it is no longer negative.
export function loc_1590(m, value = m.regs.a, steps = m.regs.c) {
  do {
    steps = (steps + 1) & 0xff;
    value = (value + 0x10) & 0xff;
  } while (value & 0x80);
  return [(m.regs.a = value), (m.regs.c = steps)];
}
