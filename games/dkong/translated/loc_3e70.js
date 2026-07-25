// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3e70  (ROM 0x3E70–0x3E87) — (>=0x3000, my region). ROUND-3: loc_1dc9 tail-jumps.
 * here (0x6342 bit 0 set). A live-in. rra-driven 3-way param encoder: on the first
 * clear low bit picks (DE,B) = bit0=0->(1,0x7B), bit1=0->(3,0x7D), else (5,0x7F);
 * tail-jumps to loc_1e28.
 */
export function loc_3e70(m) {
  const { regs } = m;
  regs.de = 0x0001;
  m.step(0x3e73, 10); // ld de,0x0001
  regs.b = 0x7b;
  m.step(0x3e75, 7); // ld b,0x7b
  regs.rra();
  m.step(0x3e76, 4); // rra -- bit0 -> carry
  if (regs.fNC) { m.step(0x1e28, 10); return m.call(0x1e28); } // jp nc -- DE=1,B=0x7B
  m.step(0x3e79, 10);
  regs.e = 0x03;
  m.step(0x3e7b, 7); // ld e,0x03 (DE=0x0003)
  regs.b = 0x7d;
  m.step(0x3e7d, 7); // ld b,0x7d
  regs.rra();
  m.step(0x3e7e, 4); // rra -- bit1 -> carry
  if (regs.fNC) { m.step(0x1e28, 10); return m.call(0x1e28); } // jp nc -- DE=3,B=0x7D
  m.step(0x3e81, 10);
  regs.e = 0x05;
  m.step(0x3e83, 7); // ld e,0x05 (DE=0x0005)
  regs.b = 0x7f;
  m.step(0x3e85, 7); // ld b,0x7f
  m.step(0x1e28, 10); // jp 0x1e28
  return m.call(0x1e28); // DE=5,B=0x7F
}
