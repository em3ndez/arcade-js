// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4f38  (ROM 0x4f38-0x4f46, The Pit) -- steps an object's C "column" index UP
 * by one and requests sound 8. C is a cyclic index whose live range is [0x0a, 0x23],
 * with 0xff used as the "off / not engaged" sentinel. The routine:
 *
 *   - calls loc_4c6f (the sound-request-8 stub) -- this CLOBBERS A and the flags, but
 *     the following instructions re-establish both, so nothing here depends on them;
 *   - `inc c` -- move the index up one;
 *   - if the increment OVERFLOWED to 0x00 (i.e. C was the 0xff sentinel), reset C to
 *     the bottom-of-range 0x0a (re-enter the range from the bottom);
 *   - then compare 0x23 with C: if C is still AT/BELOW the upper bound (C <= 0x23,
 *     no carry) keep it and `ret nc`; otherwise C has passed the ceiling, so force the
 *     0xff clamp sentinel and `ret`.
 *
 * Returns with C = the new index (0x0a..0x23 in range, or 0xff when clamped). This is
 * the UP sibling of loc_4f26 (dec c; 0xff->0x0a underflow wrap to 0x23; 0x09 lower
 * clamp; same sound 8) -- here the wrap is at the top (0xff->0x00 -> 0x0a) and the
 * clamp is at the top too (C > 0x23 -> 0xff).
 *
 * loc_4f38:
 *   4f38  cd 6f 4c     call 0x4c6f          ; request sound 8 (resumes at 0x4f3b)
 *   4f3b  0c           inc  c               ; step the index up one
 *   4f3c  20 02        jr   nz,0x4f40       ; C != 0 -> skip the reset (no overflow)
 *   4f3e  0e 0a        ld   c,0x0a          ; overflow 0xff->0x00 : re-enter range at bottom
 * loc_4f40:
 *   4f40  3e 23        ld   a,0x23
 *   4f42  b9           cp   c               ; 0x23 - C : carry set iff C > 0x23
 *   4f43  d0           ret  nc              ; C at/below the ceiling -> keep C, return
 *   4f44  0e ff        ld   c,0xff          ; passed the ceiling -> clamp to sentinel
 *   4f46  c9           ret
 *
 * CONTROL-FLOW MODELLING (doc 03): `call 0x4c6f` is an ordinary mid-body call -- it
 * pushes its own return address 0x4f3b and control resumes here after it -- so it is
 * `m.push16(0x4f3b); m.step(0x4c6f,17); m.call(0x4c6f)` with no return threaded through.
 * `jr nz` is the ordinary conditional branch (taken 12 / not taken 7). Both `ret nc`
 * (taken 11 / not taken 5) and the final `ret` (10) are ordinary returns to loc_4f38's
 * caller. `inc c` uses inc8 (S/Z/H/PV set, N cleared, carry preserved -- the Z that
 * `jr nz` reads); `cp c` uses cp (compare, result discarded, full flags including the
 * carry `ret nc` reads).
 */
export function loc_4f38(m) {
  const { regs } = m;

  m.push16(0x4f3b); m.step(0x4c6f, 17); m.call(0x4c6f); // 4f38  call 0x4c6f -- request sound 8 (resumes at 0x4f3b)
  regs.c = regs.inc8(regs.c); // 4f3b  inc c -- step the index up one (carry preserved, Z iff overflow to 0x00)
  m.step(0x4f3c, 4);
  if (regs.fNZ) { m.step(0x4f40, 12); } // 4f3c  jr nz,0x4f40 -- no overflow -> skip the reset
  else {
    m.step(0x4f3e, 7); // 4f3c  jr nz not taken (C overflowed 0xff->0x00 -> wrap)
    regs.c = 0x0a; // 4f3e  ld c,0x0a -- re-enter range from the bottom
    m.step(0x4f40, 7);
  }

  regs.a = 0x23; // 4f40  ld a,0x23
  m.step(0x4f42, 7);
  regs.cp(regs.c); // 4f42  cp c -- A(0x23) - C ; carry set iff C > 0x23
  m.step(0x4f43, 4);
  if (regs.fNC) { m.ret(11); return; } // 4f43  ret nc -- C at/below the ceiling -> keep it, return
  m.step(0x4f44, 5); // 4f43  ret nc not taken (C > 0x23)

  regs.c = 0xff; // 4f44  ld c,0xff -- clamp to the off/not-engaged sentinel
  m.step(0x4f46, 7);
  m.ret(10); // 4f46  ret
}
