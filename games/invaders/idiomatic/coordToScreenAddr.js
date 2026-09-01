// SPDX-License-Identifier: GPL-3.0-only

// Shift the coordinate right by 3 and force its high byte into the video-RAM window.
export function coordToScreenAddr(m, hl = m.regs.hl) {
  const shifted = hl >> 3;
  const high = ((shifted >> 8) & 0x3f) | 0x20;
  return (m.regs.hl = (high << 8) | (shifted & 0xff));
}
