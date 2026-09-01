// SPDX-License-Identifier: GPL-3.0-only

// Read player-input port 2, keep its low two bits, biased into the 3..6 selector.
export function loc_08d1(m) {
  return (m.regs.a = (m.io.portIn(0x02) & 0x03) + 0x03);
}
