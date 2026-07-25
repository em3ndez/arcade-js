// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0e19  (ROM 0x0E19–0x0E29) — draws the girder span, laying tile 0xC0 one tile at a time until the x-extent at 0x63B2 borrows.
 *
 *   0e19  3a b2 63     ld   a,(0x63b2)
 *   0e1c  d6 08        sub  0x08
 *   0e1e  32 b2 63     ld   (0x63b2),a
 *   0e21  da 2a 0e     jp   c,0x0e2a
 *   0e24  2c           inc  l
 *   0e25  36 c0        ld   (hl),0xc0
 *   0e27  c3 19 0e     jp   0x0e19
 *
 * DRAWS THE SPAN. 0x63B2 holds the x-extent computed by loc_0dd3; this walks
 * it down 8 pixels -- one tile -- at a time, laying tile 0xC0 in each cell,
 * until the subtraction borrows. So a record's second point defines how far
 * the girder runs and this is the fill.
 *
 * The loop counter LIVES IN MEMORY, not a register: every iteration reloads
 * 0x63B2, subtracts, and stores it back. Hoisting it into a JS local would
 * be correct arithmetically and wrong observably -- 0x63B2 is inside the
 * diffed work RAM, so its intermediate values are visible to the state gate.
 */
export function loc_0e19(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.a = mem.read8(0x63b2);
    m.step(0x0e1c, 13);
    regs.sub(0x08);
    m.step(0x0e1e, 7);
    mem.write8(0x63b2, regs.a);
    m.step(0x0e21, 13);
    if (regs.fC) {
      m.step(0x0e2a, 10); // jp c taken -- the span is exhausted
      break;
    }
    m.step(0x0e24, 10);
    regs.l = regs.inc8(regs.l); // `inc l` -- wraps within the page
    m.step(0x0e25, 4);
    mem.write8(regs.hl, 0xc0);
    m.step(0x0e27, 10);
    m.step(0x0e19, 10); // jp 0x0e19
  }

  m.call(0x0e2a);
}
