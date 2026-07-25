// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3d7e  (ROM 0x3d7e-0x3d89) — bumps the counter byte at 0x8057 by one while
 * MASKING BIT 3 OFF each bump (`and 0xf7`), then TAIL-jumps into loc_3e01, which
 * paints that byte down a column of colour RAM. Because bit 3 (0x08) is cleared
 * on every increment, a value in 0..7 counts 0,1,...,7 and then 0x07+1 = 0x08
 * masks back to 0x00 — i.e. an effective modulo-8 cycle, never letting bit 3 set.
 *
 *   3d7e  3a 57 80     ld   a,(0x8057)
 *   3d81  3c           inc  a
 *   3d82  e6 f7        and  0xf7
 *   3d84  32 57 80     ld   (0x8057),a
 *   3d87  c3 01 3e     jp   0x3e01
 *
 * `jp 0x3e01` is a TAIL-JUMP: an unconditional JP pushes nothing, so loc_3e01's
 * own `ret` returns to OUR caller. Modelled `m.step(0x3e01,10); return
 * m.call(0x3e01)`, NOT the `m.call; m.ret()` shape — that would pop a spurious
 * word off the stack and charge a second ret (see loc_3b81's header).
 */
export function loc_3d7e(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8057);
  m.step(0x3d81, 13); // 3d7e  ld a,(0x8057)

  regs.a = regs.inc8(regs.a);
  m.step(0x3d82, 4); // 3d81  inc a

  regs.and(0xf7);
  m.step(0x3d84, 7); // 3d82  and 0xf7

  mem.write8(0x8057, regs.a);
  m.step(0x3d87, 13); // 3d84  ld (0x8057),a

  // 3d87  jp 0x3e01 -- tail-jump; loc_3e01's ret returns to OUR caller.
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}
