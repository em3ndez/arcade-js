// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_33e7  (ROM 0x33E7–0x3408) — 34 bytes, 13 instructions.
 *
 *   33e7  cd 09 34     call 0x3409         ; runs FIRST, before any field access
 *   33ea  dd 7e 0d     ld   a,(ix+0x0d)
 *   33ed  fe 08        cp   0x08
 *   33ef  c2 05 34     jp   nz,0x3405
 *   33f2  dd 7e 14     ld   a,(ix+0x14)
 *   33f5  a7           and  a
 *   33f6  c2 01 34     jp   nz,0x3401
 *   33f9  dd 36 14 02  ld   (ix+0x14),0x02 ; reload sub-timer
 *   33fd  dd 35 0f     dec  (ix+0x0f)
 *   3400  c9           ret
 *   3401  dd 35 14     dec  (ix+0x14)      ; loc_3401
 *   3404  c9           ret
 *   3405  dd 34 0f     inc  (ix+0x0f)      ; loc_3405
 *   3408  c9           ret
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: called from 0x3291 (entry_3202, untranslated).
 * Unblocked by drain #15 (its only callee, sub_3409). IX live-in.
 *
 * Adjusts (ix+0x0f) up or down according to the state (ix+0x0d) and a period-2
 * sub-timer (ix+0x14):
 *   state != 8            -> inc (ix+0x0f)
 *   state == 8, timer != 0 -> dec (ix+0x14)
 *   state == 8, timer == 0 -> (ix+0x14) = 2, dec (ix+0x0f)
 * Object fields not interpreted. The `call 0x3409` runs BEFORE any field
 * access, so sub_3409's own effects on (ix+0x15)/(ix+0x07) land first.
 *
 * All three memory RMW (dec (ix+0x0f), dec (ix+0x14), inc (ix+0x0f)) go through
 * regs.decMem8 / regs.incMem8 -- flag-correct; each ret follows its RMW directly,
 * so those flags escape to the caller (S5). SCOPE: another caller of the
 * primitive, NOT an exercise of it -- this routine is itself unreachable, so
 * incMem8/decMem8 still has zero execution coverage.
 */
export function loc_33e7(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  m.push16(0x33ea); // call 0x3409 -- real call, rets back to 0x33EA
  m.step(0x3409, 17);
  m.call(0x3409);

  regs.a = mem.read8(R(0x0d));
  m.step(0x33ed, 19); // ld a,(ix+0x0d)
  regs.cp(0x08);
  m.step(0x33ef, 7); // cp 0x08
  if (regs.fNZ) {
    // loc_3405 -- state != 8
    m.step(0x3405, 10); // jp nz,0x3405 TAKEN
    regs.incMem8(mem, R(0x0f)); // inc (ix+0x0f)
    m.step(0x3408, 23); // inc (ix+0x0f)
    m.ret(); // 3408
    return;
  }
  m.step(0x33f2, 10); // jp nz NOT taken -- state == 8

  regs.a = mem.read8(R(0x14));
  m.step(0x33f5, 19); // ld a,(ix+0x14)
  regs.and(regs.a); // and a -- sets Z
  m.step(0x33f6, 4); // and a
  if (regs.fNZ) {
    // loc_3401 -- sub-timer still running
    m.step(0x3401, 10); // jp nz,0x3401 TAKEN
    regs.decMem8(mem, R(0x14)); // dec (ix+0x14)
    m.step(0x3404, 23); // dec (ix+0x14)
    m.ret(); // 3404
    return;
  }
  m.step(0x33f9, 10); // jp nz NOT taken -- sub-timer expired

  mem.write8(R(0x14), 0x02);
  m.step(0x33fd, 19); // ld (ix+0x14),0x02 -- reload
  regs.decMem8(mem, R(0x0f)); // dec (ix+0x0f)
  m.step(0x3400, 23); // dec (ix+0x0f)

  m.ret(); // 3400
}
