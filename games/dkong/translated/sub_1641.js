// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_1641  (ROM 0x1641–0x1647) — call sub_1dbd, then rst-0x28 dispatch on (0x6388) via the 0x1648 table.
 */
export function sub_1641(m) {
  const { regs, mem } = m;
  m.push16(0x1644); m.step(0x1dbd, 17); m.call(0x1dbd); // call 0x1dbd
  regs.a = mem.read8(0x6388);
  m.step(0x1647, 13); // ld a,(0x6388)
  m.push16(0x1648); m.step(0x0028, 11); // rst 0x28
  return m.call(0x0028, "0x1648 (0x6388 sequence)"); // ROM table dispatch; jp (hl)
}
