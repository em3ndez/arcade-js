// SPDX-License-Identifier: GPL-3.0-only
// loc_08d1  (ROM 0x08d1-0x08d7) -- called from 0x07d1 and 0x0b54. Reads input port 2, keeps the
// low two bits, and returns A = (port2 & 3) + 3 (a 3..6 selector).
export function loc_08d1(m) {
  const { regs } = m;

  regs.a = m.io.portIn(0x02); m.step(0x08d3, 10); // 08d1  in 0x02
  regs.and(0x03); m.step(0x08d5, 7); // 08d3  ani 0x03
  regs.add(0x03); m.step(0x08d7, 7); // 08d5  adi 0x03
  return m.ret(10); // 08d7  ret
}
