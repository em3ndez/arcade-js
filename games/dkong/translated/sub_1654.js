// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_1654  (ROM 0x1654–0x1663) — 0x1644 idx: spawn (0x1708) + copy 0x385C + arm 0x6009=0x20, then the shared tail_1662.
 */
export function sub_1654(m) {
  const { regs, mem } = m;
  m.push16(0x1657); m.step(0x1708, 17); m.call(0x1708); // call 0x1708
  regs.hl = 0x385c;
  m.step(0x165a, 10);
  m.push16(0x165d); m.step(0x004e, 17); m.call(0x004e); // call 0x004e
  regs.a = 0x20;
  m.step(0x165f, 7);
  mem.write8(0x6009, regs.a);
  m.step(0x1662, 13); // 0x6009 = 0x20 -> tail_1662
  return m.call(0x1662);
}
