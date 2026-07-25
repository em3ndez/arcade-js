// SPDX-License-Identifier: GPL-3.0-only

/**
 * tail_1662  (ROM 0x1662–0x166F) — shared tail (sub_1654 fall-through + sub_168a jp): advance 0x6388, rst-0x30 gate, rst 0x38.
 */
export function tail_1662(m) {
  const { regs, mem } = m;
  regs.hl = 0x6388;
  m.step(0x1665, 10);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x1666, 11); // inc (0x6388)
  regs.a = 0x01;
  m.step(0x1668, 7);
  m.push16(0x1669); m.step(0x0030, 11); if (!m.call(0x0030)) return; // rst 0x30 caller-skip
  regs.hl = 0x690b;
  m.step(0x166c, 10);
  regs.c = 0xfc;
  m.step(0x166e, 7);
  m.push16(0x166f); m.step(0x0038, 11); m.call(0x0038); // rst 0x38
  m.ret(10);
}
