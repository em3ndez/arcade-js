// SPDX-License-Identifier: GPL-3.0-only

// loc_04f2  (ROM 0x04f2-0x0500) -- pick the active player's 3-byte BCD score buffer.
// DE <- 0x88a2 (player 1) or 0x88a5 (player 2) per bit0 of the mode byte 0x880d. AF is
// saved/restored around the probe (push af / pop af), so the caller's A and flags survive.
export function loc_04f2(m) {
  const { regs, mem } = m;

  m.push16(regs.af);              m.step(0x04f3, 11); // preserve caller AF
  regs.a = mem.read8(0x880d);     m.step(0x04f6, 13);
  regs.de = 0x88a2;               m.step(0x04f9, 10);
  regs.rrca();                    m.step(0x04fa, 4);  // carry = bit0 of 0x880d
  if (regs.fNC) {
    m.step(0x04ff, 12);           // jr nc taken -> DE stays 0x88a2
  } else {
    m.step(0x04fc, 7);
    regs.de = 0x88a5;             m.step(0x04ff, 10);
  }
  regs.af = m.pop16();            m.step(0x0500, 10); // restore caller AF
  return m.ret(10);
}
