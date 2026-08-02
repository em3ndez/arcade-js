// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_01c3  (ROM 0x01C3–0x0206) — game state 0.
 *
 *   01c3  cd 74 08     call 0x0874
 *   01c6  21 ba 01     ld   hl,0x01ba
 *   01c9  11 b2 60     ld   de,0x60b2
 *   01cc  01 09 00     ld   bc,0x0009
 *   01cf  ed b0        ldir
 *   01d1  3e 01        ld   a,0x01
 *   01d3  32 07 60     ld   (0x6007),a
 *   01d6  32 29 62     ld   (0x6229),a
 *   01d9  32 28 62     ld   (0x6228),a
 *   01dc  cd b8 06     call 0x06b8
 *   01df  cd 07 02     call 0x0207
 *   01e2  3e 01        ld   a,0x01
 *   01e4  32 82 7d     ld   (0x7d82),a
 *   01e7  32 05 60     ld   (0x6005),a
 *   01ea  32 27 62     ld   (0x6227),a
 *   01ed  af           xor  a
 *   01ee  32 0a 60     ld   (0x600a),a
 *   01f1  cd 53 0a     call 0x0a53
 *   01f4  11 04 03     ld   de,0x0304
 *   01f7  cd 9f 30     call 0x309f
 *   01fa  11 02 02     ld   de,0x0202
 *   01fd  cd 9f 30     call 0x309f
 *   0200  11 00 02     ld   de,0x0200
 *   0203  cd 9f 30     call 0x309f
 *   0206  c9           ret
 *
 * The `ldir` copies NINE BYTES OF DATA from ROM 0x01BA to 0x60B2 -- the
 * task-list area. That is why 0x01BA-0x01C2 shows as unreached in the
 * coverage map: it is data, not unexercised code, and it sits immediately
 * before this handler.
 *
 * Sets game state 0x6005 to 1, so the NEXT vblank dispatches through a
 * different table entry -- this handler runs once.
 */
export function loc_01c3(m) {
  const { regs, mem } = m;

  m.push16(0x01c6);
  m.step(0x0874, 17);
  m.call(0x0874);

  regs.hl = 0x01ba;
  m.step(0x01c9, 10);
  regs.de = 0x60b2;
  m.step(0x01cc, 10);
  regs.bc = 0x0009;
  m.step(0x01cf, 10);
  m.ldir(0x01d1);

  regs.a = 0x01;
  m.step(0x01d3, 7);
  mem.write8(0x6007, regs.a);
  m.step(0x01d6, 13);
  mem.write8(0x6229, regs.a);
  m.step(0x01d9, 13);
  mem.write8(0x6228, regs.a);
  m.step(0x01dc, 13);

  // A real `call` here, unlike sub_0350's tail jump into the same routine.
  // Same implementation; only the stack differs, which is exactly why the
  // tracer misclassifies 0x06B8 as never-returning (see README known issues).
  m.push16(0x01df);
  m.step(0x06b8, 17);
  m.call(0x06b8);

  m.push16(0x01e2);
  m.step(0x0207, 17);
  m.call(0x0207);

  regs.a = 0x01;
  m.step(0x01e4, 7);
  mem.write8(0x7d82, regs.a, 10); // flipscreen = 1
  m.step(0x01e7, 13);
  mem.write8(0x6005, regs.a); // advance the game state
  m.step(0x01ea, 13);
  mem.write8(0x6227, regs.a);
  m.step(0x01ed, 13);
  regs.xor(regs.a);
  m.step(0x01ee, 4);
  mem.write8(0x600a, regs.a);
  m.step(0x01f1, 13);

  m.push16(0x01f4);
  m.step(0x0a53, 17);
  m.call(0x0a53);

  // Three tasks queued, each a 16-bit (D,E) pair.
  for (const [de, after, next] of [
    [0x0304, 0x01f7, 0x01fa],
    [0x0202, 0x01fd, 0x0200],
    [0x0200, 0x0203, 0x0206],
  ]) {
    regs.de = de;
    m.step(after, 10);
    m.push16(next);
    m.step(0x309f, 17);
    m.call(0x309f);
  }

  m.ret();
}
