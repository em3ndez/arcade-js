// SPDX-License-Identifier: GPL-3.0-only

// Mask the accumulator to its two sound-select bits and latch it to the sound port. Live-out: the port.
export function loc_1770(m, a = m.regs.a) {
  m.io.portOut(0x05, a & 0x30);
}
