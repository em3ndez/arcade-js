// SPDX-License-Identifier: GPL-3.0-only

// loc_1ce7  (ROM 0x1ce7-0x1ceb) -- point HL at 0x84e0, store 0x02 there, then fall through
// into loc_1cec (its own routine entry, delivered separately). The fall-through is a
// tail-delegate to the 0x1cec boundary, carrying HL=0x84e0 forward. External caller: `call
// nz,0x1ce7` at 0x1d23.
export function loc_1ce7(m) {
  const { regs, mem } = m;

  regs.hl = 0x84e0;              m.step(0x1cea, 10); // 1ce7  ld hl,0x84e0
  mem.write8(regs.hl, 0x02);     m.step(0x1cec, 10); // 1cea  ld (hl),0x02
  return m.call(0x1cec);         // fall through into loc_1cec
}
