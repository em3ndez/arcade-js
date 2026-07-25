// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_07c3  (ROM 0x07C3–0x07CA) — 0x0748 dispatch table, entry index 5.
 *
 *   07c3  cd 74 08     call 0x0874        ; init/fill; takes NO register input
 *   07c6  21 0a 60     ld   hl,0x600a
 *   07c9  34           inc  (hl)          ; advance the 0x600A sub-state -- RMW MEMORY
 *   07ca  c9           ret
 */
export function loc_07c3(m) {
  const { regs, mem } = m;

  m.push16(0x07c6); // call 0x0874 pushes the return address 0x07C6
  m.step(0x0874, 17); // call 0x0874
  m.call(0x0874);

  regs.hl = 0x600a;
  m.step(0x07c9, 10); // ld hl,0x600a
  regs.incMem8(mem, regs.hl); // inc (hl) -- flag-correct RMW on the 0x600A byte
  m.step(0x07ca, 11); // inc (hl)

  m.ret(); // ret (0x07CA)
}
