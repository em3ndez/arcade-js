// SPDX-License-Identifier: GPL-3.0-only

/**
 * tail_19d2  (ROM 0x19D2–0x19D9) — shared tail (also `jp 0x19d2` from 0x1A30). Re-arms the rst-18 counter.
 */
export function tail_19d2(m) {
  const { regs, mem } = m;
  regs.hl = 0x600a;
  m.step(0x19d5, 10); // ld hl,0x600a
  regs.incMem8(mem, regs.hl); // inc (hl) -- 0x600A++
  m.step(0x19d6, 11); // inc (hl)
  regs.hl = (regs.hl - 1) & 0xffff; // dec hl -> 0x6009
  m.step(0x19d7, 6); // dec hl
  mem.write8(regs.hl, 0x40); // 0x6009 = 0x40 -- re-arm the rst 0x18 counter
  m.step(0x19d9, 10); // ld (hl),0x40
  m.ret(10); // 0x19D9
}
