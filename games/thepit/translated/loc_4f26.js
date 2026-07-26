// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4f26  (ROM 0x4f26-0x4f37, The Pit) -- steps an object's C "column" index DOWN
 * by one and requests sound 8. C is a cyclic index whose live range is [0x0a, 0x23],
 * with 0xff used as the "off / not engaged" sentinel. The routine:
 *
 *   - calls loc_4c6f (the sound-request-8 stub) -- this CLOBBERS A and the flags, but
 *     the next three instructions re-establish both, so nothing here depends on them;
 *   - `dec c` -- move the index down one;
 *   - if the decrement UNDERFLOWED to 0xfe (i.e. C was the 0xff sentinel), wrap C back
 *     to the top-of-range 0x23 (re-enter the range from the top);
 *   - then compare 0x09 with C: if C is still ABOVE the lower bound (C > 0x09, carry
 *     set), keep it and `ret c`; otherwise C has fallen to/through the floor, so force
 *     the 0xff clamp sentinel and `ret`.
 *
 * Returns with C = the new index (0x0a..0x23 in range, or 0xff when clamped). This is
 * the DOWN sibling of loc_4f38 (inc c; 0x00->0x0a wrap; 0x23 upper clamp; same sound 8).
 *
 * loc_4f26:
 *   4f26  cd 6f 4c     call 0x4c6f          ; request sound 8 (resumes at 0x4f29)
 *   4f29  0d           dec  c               ; step the index down one
 *   4f2a  3e fe        ld   a,0xfe
 *   4f2c  b9           cp   c               ; C == 0xfe ? (underflow from 0xff sentinel)
 *   4f2d  20 02        jr   nz,0x4f31       ; not the wrap case -> skip the reset
 *   4f2f  0e 23        ld   c,0x23          ; wrap: re-enter range from the top
 * loc_4f31:
 *   4f31  3e 09        ld   a,0x09
 *   4f33  b9           cp   c               ; 0x09 - C : carry set iff C > 0x09
 *   4f34  d8           ret  c               ; still above the floor -> keep C, return
 *   4f35  0e ff        ld   c,0xff          ; hit/passed the floor -> clamp to sentinel
 *   4f37  c9           ret
 *
 * CONTROL-FLOW MODELLING (doc 03): `call 0x4c6f` is an ordinary mid-body call -- it
 * pushes its own return address 0x4f29 and control resumes here after it -- so it is
 * `m.push16(0x4f29); m.step(0x4c6f,17); m.call(0x4c6f)` with no return threaded through.
 * `jr nz` is the ordinary conditional branch (taken 12 / not taken 7). Both `ret c`
 * (taken 11 / not taken 5) and the final `ret` (10) are ordinary returns to loc_4f26's
 * caller. `dec c` uses dec8 (S/Z/H/PV/N set, carry preserved); `cp c` uses cp (compare,
 * result discarded, full flags including the carry `ret c` reads).
 */
export function loc_4f26(m) {
  const { regs } = m;

  m.push16(0x4f29); m.step(0x4c6f, 17); m.call(0x4c6f); // 4f26  call 0x4c6f -- request sound 8 (resumes at 0x4f29)
  regs.c = regs.dec8(regs.c); // 4f29  dec c -- step the index down one (carry preserved)
  m.step(0x4f2a, 4);
  regs.a = 0xfe; // 4f2a  ld a,0xfe
  m.step(0x4f2c, 7);
  regs.cp(regs.c); // 4f2c  cp c -- A(0xfe) - C ; Z iff C == 0xfe (underflow from 0xff)
  m.step(0x4f2d, 4);
  if (regs.fNZ) { m.step(0x4f31, 12); } // 4f2d  jr nz,0x4f31 -- not the wrap case
  else {
    m.step(0x4f2f, 7); // 4f2d  jr nz not taken (C == 0xfe -> wrap)
    regs.c = 0x23; // 4f2f  ld c,0x23 -- re-enter range from the top
    m.step(0x4f31, 7);
  }

  regs.a = 0x09; // 4f31  ld a,0x09
  m.step(0x4f33, 7);
  regs.cp(regs.c); // 4f33  cp c -- A(0x09) - C ; carry set iff C > 0x09
  m.step(0x4f34, 4);
  if (regs.fC) { m.ret(11); return; } // 4f34  ret c -- C above the floor -> keep it, return
  m.step(0x4f35, 5); // 4f34  ret c not taken (C <= 0x09)

  regs.c = 0xff; // 4f35  ld c,0xff -- clamp to the off/not-engaged sentinel
  m.step(0x4f37, 7);
  m.ret(10); // 4f37  ret
}
