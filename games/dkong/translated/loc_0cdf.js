// SPDX-License-Identifier: GPL-3.0-only

/** loc_0cdf  (ROM 0x0CDF–0x0CF1) — Board 2 (50m conveyor) setup: DE=layout ptr,
 *  latches, (0x6089)=9 mode; tail-jumps to the shared draw tail loc_0cc6 (DE live-out). */
export function loc_0cdf(m) {
  const { regs, mem } = m;
  regs.de = 0x3b5d;
  m.step(0x0ce2, 10); // ld de,0x3b5d -- conveyor layout ptr (live-out)
  regs.hl = 0x7d86;
  m.step(0x0ce5, 10); // ld hl,0x7d86
  mem.write8(regs.hl, 0x01, 7);
  m.step(0x0ce7, 10); // ld (hl),0x01 -- (0x7D86)=1
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0ce8, 6); // inc hl
  mem.write8(regs.hl, 0x00, 7);
  m.step(0x0cea, 10); // ld (hl),0x00 -- (0x7D87)=0
  regs.a = 0x09;
  m.step(0x0cec, 7); // ld a,0x09
  mem.write8(0x6089, regs.a);
  m.step(0x0cef, 13); // ld (0x6089),a -- board mode 9
  m.step(0x0cc6, 10); // jp 0x0cc6 -- TAIL into the shared draw tail
  return m.call(0x0cc6);
}
