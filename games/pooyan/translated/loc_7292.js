// SPDX-License-Identifier: GPL-3.0-only

// loc_7292  (ROM 0x7292-0x729f) -- eagle-phase reset epilogue. Clears the eagle animation flag
// (0x8a87) and the latched X (0x8f5b), advances the outer phase (0x8f38) and clears the sub-phase
// (0x8f39). Reached both by fall-through from loc_7287 and by `jp nz,0x7292` in loc_71ce.
export function loc_7292(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x7293, 4); // 7292  xor a
  mem.write8(0x8a87, regs.a);
  m.step(0x7296, 13); // 7293  ld (0x8a87),a
  mem.write8(0x8f5b, regs.a);
  m.step(0x7299, 13); // 7296  ld (0x8f5b),a
  regs.hl = 0x8f38;
  m.step(0x729c, 10); // 7299  ld hl,0x8f38
  regs.incMem8(mem, regs.hl);
  m.step(0x729d, 11); // 729c  inc (hl) -- advance phase
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x729e, 6); // 729d  inc hl -> 0x8f39
  mem.write8(regs.hl, regs.a);
  m.step(0x729f, 7); // 729e  ld (hl),a -- clear sub-phase
  m.ret(); // 729f  ret
}
