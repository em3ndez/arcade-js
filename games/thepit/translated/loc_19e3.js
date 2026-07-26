// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_19e3  (ROM 0x19e3-0x1a01, The Pit) — store the actor's sprite/state code and
 * apply a far-edge boundary latch for the moving actor whose 4-byte record lives at
 * 0x8068-0x806b. On entry A holds the direction/animation code that loc_19d0 (the
 * fall-through predecessor) selected from bit 1 of the position; it is written into
 * the record's byte 0x8069. Then, ONLY if the actor is active (0x8077 != 0) AND its
 * position 0x806b has advanced to >= 0x8a, the routine latches 0x807c = 0xb4 and
 * clears the leading byte 0x8068 = 0. Inactive, or not yet at the boundary, it does
 * neither and leaves 0x807c / 0x8068 untouched.
 *
 * Every exit is a tail-jump into loc_1b5b (the epilogue that rebuilds the display
 * record from 0x8068-0x806b) — the two conditional `jp z/jp c` and the closing
 * unconditional `jp`. None pushes a return, so loc_1b5b's own `ret` unwinds to OUR
 * caller; modelled `m.step(0x1b5b,10); return m.call(0x1b5b)` with NO trailing
 * m.ret (a second ret would double-pop). `and a` is the zero-test on 0x8077.
 *
 * Branch map:
 *   0x8077 == 0                       -> jp z  0x1b5b  (inactive; just rebuild + ret)
 *   0x8077 != 0 && 0x806b <  0x8a     -> jp c  0x1b5b  (active, short of the edge)
 *   0x8077 != 0 && 0x806b >= 0x8a     -> 0x807c := 0xb4; 0x8068 := 0; jp 0x1b5b
 *
 *   19e3  32 69 80     ld   (0x8069),a
 *   19e6  3a 77 80     ld   a,(0x8077)
 *   19e9  a7           and  a
 *   19ea  ca 5b 1b     jp   z,0x1b5b
 *   19ed  3a 6b 80     ld   a,(0x806b)
 *   19f0  fe 8a        cp   0x8a
 *   19f2  da 5b 1b     jp   c,0x1b5b
 *   19f5  3e b4        ld   a,0xb4
 *   19f7  32 7c 80     ld   (0x807c),a
 *   19fa  3e 00        ld   a,0x00
 *   19fc  32 68 80     ld   (0x8068),a
 *   19ff  c3 5b 1b     jp   0x1b5b
 */
export function loc_19e3(m) {
  const { regs, mem } = m;

  mem.write8(0x8069, regs.a);
  m.step(0x19e6, 13); // 19e3  ld (0x8069),a -- latch the direction/animation code

  regs.a = mem.read8(0x8077);
  m.step(0x19e9, 13); // 19e6  ld a,(0x8077) -- actor-active flag

  regs.and(regs.a);
  m.step(0x19ea, 4); // 19e9  and a -- Z iff 0x8077 == 0
  if (regs.fZ) {
    m.step(0x1b5b, 10); // 19ea  jp z taken -- inactive; rebuild + ret via loc_1b5b
    return m.call(0x1b5b);
  }
  m.step(0x19ed, 10); // 19ea  jp z not taken

  regs.a = mem.read8(0x806b);
  m.step(0x19f0, 13); // 19ed  ld a,(0x806b) -- position accumulator (trailing coord)
  regs.cp(0x8a);
  m.step(0x19f2, 7); // 19f0  cp 0x8a -- reached the far edge?
  if (regs.fC) {
    m.step(0x1b5b, 10); // 19f2  jp c taken -- 0x806b < 0x8a: not yet there
    return m.call(0x1b5b);
  }
  m.step(0x19f5, 10); // 19f2  jp c not taken -- at/past 0x8a: fire the latch

  regs.a = 0xb4;
  m.step(0x19f7, 7); // 19f5  ld a,0xb4
  mem.write8(0x807c, regs.a);
  m.step(0x19fa, 13); // 19f7  ld (0x807c),a -- latch the boundary state
  regs.a = 0x00;
  m.step(0x19fc, 7); // 19fa  ld a,0x00
  mem.write8(0x8068, regs.a);
  m.step(0x19ff, 13); // 19fc  ld (0x8068),a -- clear the leading byte

  m.step(0x1b5b, 10); // 19ff  jp 0x1b5b -- tail-jump; loc_1b5b's ret unwinds to OUR caller
  return m.call(0x1b5b);
}
