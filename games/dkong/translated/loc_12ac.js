// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_12ac  (ROM 0x12AC–0x12DD) — 0x639D arm 1: animate 0x694D/0x694E, or advance state.
 *
 *   12ac  df           rst  0x18
 *   12af  3e 08        ld   a,0x08
 *   12b1  32 09 60     ld   (0x6009),a    ; reload the rst 0x18 counter: 8 ticks
 *   12b5  21 9e 63     ld   hl,0x639e
 *   12b6  35           dec  (hl)
 *   12b7  ca cb 12     jp   z,0x12cb      ; 0x639E hit 0 -> advance state (tail)
 *   ... else animate the two-cell blinker at 0x694D/0x694E, then ret
 */
export function loc_12ac(m) {
  const { regs, mem } = m;

  m.push16(0x12ad);
  m.step(0x0018, 11); // rst 0x18
  if (!m.call(0x0018)) return; // counter did not expire -- dispatch abandoned

  regs.a = 0x08;
  m.step(0x12af, 7); // ld a,0x08
  mem.write8(0x6009, regs.a); // reload the rst 0x18 counter: 8 ticks
  m.step(0x12b2, 13);

  regs.hl = 0x639e;
  m.step(0x12b5, 10); // ld hl,0x639e
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl))); // dec (hl) -- carry preserved
  m.step(0x12b6, 11);
  if (regs.fZ) {
    m.step(0x12cb, 10); // jp z,0x12cb -- 0x639E reached 0
    return tail12cb(m);
  }
  m.step(0x12b9, 10); // jp z NOT taken

  // ---- animate: toggle bit 0 of (0x694D) and bit 7 of (0x694E) ----
  regs.hl = 0x694d;
  m.step(0x12bc, 10); // ld hl,0x694d
  regs.a = mem.read8(regs.hl);
  m.step(0x12bd, 7); // ld a,(hl)
  regs.rra(); // value DEAD; carry-out = bit 0 of (0x694D)
  m.step(0x12be, 4); // rra
  regs.a = 0x02;
  m.step(0x12c0, 7); // ld a,0x02
  regs.rra(); // A = 0x81 if bit0 of (0x694D) was set, else 0x01
  m.step(0x12c1, 4); // rra
  regs.b = regs.a;
  m.step(0x12c2, 4); // ld b,a
  regs.xor(mem.read8(regs.hl));
  m.step(0x12c3, 7); // xor (hl)
  mem.write8(regs.hl, regs.a);
  m.step(0x12c4, 7); // ld (hl),a
  regs.l = regs.inc8(regs.l); // inc l -- 8-bit (0x694D -> 0x694E)
  m.step(0x12c5, 4);
  regs.a = regs.b;
  m.step(0x12c6, 4); // ld a,b
  regs.and(0x80);
  m.step(0x12c8, 7); // and 0x80
  regs.xor(mem.read8(regs.hl));
  m.step(0x12c9, 7); // xor (hl)
  mem.write8(regs.hl, regs.a);
  m.step(0x12ca, 7); // ld (hl),a
  m.ret(10); // ret (0x12CA)
}

/**
 * tail12cb  (ROM 0x12CB–0x12DD) — 12AC's interior tail: advance the 0x639D state.
 */
export function tail12cb(m) {
  const { regs, mem } = m;

  regs.hl = 0x694d;
  m.step(0x12ce, 10); // ld hl,0x694d
  regs.a = 0xf4;
  m.step(0x12d0, 7); // ld a,0xf4
  mem.write8(regs.hl, regs.rl(mem.read8(regs.hl))); // rl (hl) -- result overwritten
  m.step(0x12d2, 15);
  regs.rra(); // A = 0xFA if old bit7 of (0x694D) was set, else 0x7A
  m.step(0x12d3, 4); // rra
  mem.write8(regs.hl, regs.a); // discards the rl result
  m.step(0x12d4, 7); // ld (hl),a

  regs.hl = 0x639d;
  m.step(0x12d7, 10); // ld hl,0x639d
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl))); // advance state 1 -> 2
  m.step(0x12d8, 11); // inc (hl)
  regs.a = 0x80;
  m.step(0x12da, 7); // ld a,0x80
  mem.write8(0x6009, regs.a); // reload the rst 0x18 counter: 128 ticks, NOT 8
  m.step(0x12dd, 13);
  m.ret(10); // ret (0x12DD)
}
