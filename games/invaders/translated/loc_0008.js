// SPDX-License-Identifier: GPL-3.0-only
// loc_0008  (ROM 0x0008-0x000e) -- RST1 (mid-screen) interrupt vector: saves PSW/BC/DE/HL,
// then tail-jumps to the mid-screen body at loc_008c (its own head), so it delegates.
export function loc_0008(m) {
  const { regs } = m;

  m.push16(regs.af); m.step(0x0009, 11); // 0008  push psw
  m.push16(regs.bc); m.step(0x000a, 11); // 0009  push b
  m.push16(regs.de); m.step(0x000b, 11); // 000a  push d
  m.push16(regs.hl); m.step(0x000c, 11); // 000b  push h
  m.step(0x008c, 10); return m.call(0x008c); // 000c  jmp 0x008c (tail delegate)
}
