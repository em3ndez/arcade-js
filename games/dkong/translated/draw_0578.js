// SPDX-License-Identifier: GPL-3.0-only

/**
 * draw_0578  (ROM 0x0578–0x0592) — render a 3-byte BCD counter.
 *
 *   0578  dd 21 41 76  ld   ix,0x7641
 *   057c  eb           ex   de,hl
 *   057d  11 e0 ff     ld   de,0xffe0
 *   0580  01 04 03     ld   bc,0x0304
 *   0583  7e           ld   a,(hl)           ; loop
 *   0584  0f           rrca
 *   0585  0f           rrca
 *   0586  0f           rrca
 *   0587  0f           rrca
 *   0588  cd 93 05     call 0x0593
 *   058b  7e           ld   a,(hl)
 *   058c  cd 93 05     call 0x0593
 *   058f  2b           dec  hl
 *   0590  10 f1        djnz 0x0583
 *   0592  c9           ret
 *
 * Three source bytes, two BCD digits each, high nibble first -- so six
 * digits drawn from HL downward into IX, stepping DE = 0xFFE0 (one tilemap
 * row) per digit. Vertical again, like handler_05e9.
 *
 * `enteredAt057C` skips the `ld ix` when reached from draw_056b, which has
 * already chosen a different destination.
 */
export function draw_0578(m, enteredAt057C = false) {
  const { regs } = m;

  if (!enteredAt057C) {
    regs.ix = 0x7641;
    m.step(0x057c, 14);
  }
  regs.exDeHl();
  m.step(0x057d, 4);
  regs.de = 0xffe0;
  m.step(0x0580, 10);
  regs.bc = 0x0304;
  m.step(0x0583, 10);

  m.call(0x0583);
}
