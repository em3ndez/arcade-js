// SPDX-License-Identifier: GPL-3.0-only

// loc_1a47  (ROM 0x1a47-0x1a63) -- clears the (H:0x04) status byte the caller seated, then block-copies
// 0x3f bytes from 0x8900 into the active player's bank (0x8940, or 0x8980 when 0x880d bit set), and
// zeroes 0x880a. Leaf: no calls; the entry `ld l,0x04` keeps the caller's H, so the first store lands
// in that caller's page (0x8904 or 0x8104).
export function loc_1a47(m) {
  const { regs, mem } = m;

  regs.l = 0x04;                m.step(0x1a49, 7);
  mem.write8(regs.hl, 0x00);    m.step(0x1a4b, 10);
  regs.de = 0x8940;             m.step(0x1a4e, 10);
  regs.hl = 0x8900;             m.step(0x1a51, 10);
  regs.bc = 0x003f;             m.step(0x1a54, 10);
  regs.a = mem.read8(0x880d);   m.step(0x1a57, 13);
  regs.and(regs.a);             m.step(0x1a58, 4);
  if (regs.fZ) {
    m.step(0x1a5d, 12);         // player 0 -> dest 0x8940
  } else {
    m.step(0x1a5a, 7);
    regs.de = 0x8980;           m.step(0x1a5d, 10); // player 1 -> dest 0x8980
  }
  m.ldirAt(0x1a5d, 0x1a5f);
  regs.xor(regs.a);             m.step(0x1a60, 4);
  mem.write8(0x880a, regs.a);   m.step(0x1a63, 13);
  return m.ret(10);
}
