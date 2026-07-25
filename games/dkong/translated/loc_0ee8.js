// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0ee8  (ROM 0x0EE8–0x0F18) — ROUND-2 BATCH: kind-3 record strip (girder-cap column draw). ROM.
 * 0x0EE8-0x0F1A. Reached from loc_0e4f's
 * kind!=2 branch (wired below); kind>=4 dispatches to entry_0f1b. The `jp 0x0da7`
 * exits are the walk-loop back-edge -> `return` (unwinds to sub_0da7's for(;;)).
 */
export function loc_0ee8(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x63b3);
  m.step(0x0eeb, 13); // ld a,(0x63b3) -- kind
  regs.cp(0x03);
  m.step(0x0eed, 7); // cp 0x03
  if (regs.fNZ) {
    m.step(0x0f1b, 10); // jp nz,0x0f1b -- kind 4+
    return m.call(0x0f1b);
  }
  m.step(0x0ef0, 10); // jp nz NOT taken -- kind 3

  regs.hl = mem.read16(0x63ab);
  m.step(0x0ef3, 16); // ld hl,(0x63ab)
  regs.a = 0xb3;
  m.step(0x0ef5, 7); // ld a,0xb3 -- top cap
  mem.write8(regs.hl, regs.a);
  m.step(0x0ef6, 7); // ld (hl),a
  regs.bc = 0x0020;
  m.step(0x0ef9, 10); // ld bc,0x0020
  regs.addHl(regs.bc);
  m.step(0x0efa, 11); // add hl,bc
  regs.a = mem.read8(0x63b1);
  m.step(0x0efd, 13); // ld a,(0x63b1)
  regs.sub(0x10);
  m.step(0x0eff, 7); // sub 0x10 -- FIRST step

  for (;;) {
    // loc_0eff -- borrow test
    if (regs.fC) {
      m.step(0x0f14, 10); // jp c,0x0f14 taken
      regs.a = 0xb2;
      m.step(0x0f16, 7); // ld a,0xb2 -- bottom cap
      mem.write8(regs.hl, regs.a);
      m.step(0x0f17, 7); // ld (hl),a
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x0f18, 6); // inc de
      m.step(0x0da7, 10); // jp 0x0da7 -- walk back-edge
      return;
    }
    m.step(0x0f02, 10); // jp c NOT taken
    mem.write8(0x63b1, regs.a);
    m.step(0x0f05, 13); // ld (0x63b1),a
    regs.a = 0xb1;
    m.step(0x0f07, 7); // ld a,0xb1 -- body
    mem.write8(regs.hl, regs.a);
    m.step(0x0f08, 7); // ld (hl),a
    regs.bc = 0x0020;
    m.step(0x0f0b, 10); // ld bc,0x0020
    regs.addHl(regs.bc);
    m.step(0x0f0c, 11); // add hl,bc
    regs.a = mem.read8(0x63b1);
    m.step(0x0f0f, 13); // ld a,(0x63b1)
    regs.sub(0x08);
    m.step(0x0f11, 7); // sub 0x08 -- SUBSEQUENT step
    m.step(0x0eff, 10); // jp 0x0eff -- loop
  }
}
