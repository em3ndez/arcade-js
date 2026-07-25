// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_0020  (ROM 0x0020–0x0027) — the `rst 0x20` skip helper.
 *
 *   0020  21 08 60     ld   hl,0x6008
 *   0023  35           dec  (hl)
 *   0024  28 f2        jr   z,0x0018
 *   0026  e1           pop  hl               ; loc_0026
 *   0027  c9           ret
 *
 * A TWO-LEVEL COUNTDOWN, and the second level is reached by JUMPING INTO
 * sub_0018 rather than calling it. Decrement 0x6008; while it is non-zero,
 * `pop hl / ret` discards this routine's return address and returns to the
 * caller's caller -- the skip. When it EXPIRES, control falls into 0x0018,
 * which decrements 0x6009 and applies the same test one level up.
 *
 * So the caller's remainder runs only when BOTH counters expire together.
 * Two prescalers in series, expressed as a jump between two `rst` handlers
 * that share a return convention -- which is why they must share a
 * translation convention too, both returning "did control come back".
 *
 * The `jr z` lands on sub_0018's FIRST instruction, so it is a genuine tail
 * jump: 0x0018's `ret` returns on 0x0020's behalf, and 0x0020 never reaches
 * a `ret` of its own. That is exactly the shape the tracer misclassifies as
 * non-returning.
 *
 * @returns {boolean} true when control returns after the `rst`, else false.
 */
export function sub_0020(m) {
  const { regs, mem } = m;
  regs.hl = 0x6008;
  m.step(0x0023, 10);
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)), 8); // dec (hl)
  m.step(0x0024, 11);
  if (regs.fZ) {
    m.step(0x0018, 12); // jr z taken -- TAIL jump into sub_0018
    return m.call(0x0018);
  }
  m.step(0x0026, 7); // jr z not taken
  regs.hl = m.pop16(); // pop hl -- discards this routine's return address
  m.step(0x0027, 10);
  m.ret(); // returns to the caller's CALLER
  return false;
}
