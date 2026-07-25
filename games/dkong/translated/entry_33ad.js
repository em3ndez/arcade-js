// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_33ad  (ROM 0x33AD–0x33C2) — + 0x33D9-0x33E5 (13 insns, interleaved with entry_33c3).
 *
 *   33ad  dd 7e 0d     ld   a,(ix+0x0d)
 *   33b0  fe 01        cp   0x01
 *   33b2  ca d9 33     jp   z,0x33d9      ; ==1 -> set bit 7, inc (ix+0x0e)
 *   33b5  dd 7e 07     ld   a,(ix+0x07)
 *   33b8  e6 7f        and  0x7f          ; clear bit 7
 *   33ba  dd 77 07     ld   (ix+0x07),a
 *   33bd  dd 35 0e     dec  (ix+0x0e)
 *   33c0  cd 09 34     call 0x3409
 *                      (FALL THROUGH into entry_33c3 -- NO ret of its own)
 *   33d9  dd 7e 07     ld   a,(ix+0x07)   ; the ==1 arm, physically AFTER 33c3's body
 *   33dc  f6 80        or   0x80          ; set bit 7
 *   33de  dd 77 07     ld   (ix+0x07),a
 *   33e1  dd 34 0e     inc  (ix+0x0e)
 *   33e4  c3 c0 33     jp   0x33c0
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: called from 0x323B (entry_3202, untranslated);
 * nothing in translated src invokes entry_33ad. IX live-in. One callee edge:
 * sub_3409 (integrated), shared by both arms before the fall-through.
 *
 * NO RET OF ITS OWN -- it FALLS THROUGH into entry_33c3. Modelled
 * as `return m.call(0x33c3)` with NO push16: entry_33ad has no frame of its own at
 * that point, so entry_33c3's ret ends both. The two routines are physically
 * INTERLEAVED -- the ==1 arm (0x33D9-0x33E5) sits after entry_33c3's body and
 * jumps back to the shared 0x33C0.
 *
 * TWO NEAR-MIRROR ARMS: on (ix+0x0d)==1, set bit 7 of (ix+0x07) (or 0x80)
 * and inc (ix+0x0e); else clear bit 7 (and 0x7f) and dec (ix+0x0e). Same shape,
 * INVERSE ops -- each arm derived from its own bytes, not copied (or<->and, mask
 * 0x80<->0x7f, inc<->dec all flip). The inc/dec (ix+0x0e) are memory RMW through
 * regs.incMem8/decMem8 (flag-correct), though those flags die before entry_33c3
 * re-tests via cp. Object fields not interpreted.
 */
export function entry_33ad(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(R(0x0d));
  m.step(0x33b0, 19); // ld a,(ix+0x0d)
  regs.cp(0x01);
  m.step(0x33b2, 7); // cp 0x01
  if (regs.fZ) {
    // 0x33d9 -- (ix+0x0d)==1 arm (physically after entry_33c3's body)
    m.step(0x33d9, 10); // jp z,0x33d9 TAKEN
    regs.a = mem.read8(R(0x07));
    m.step(0x33dc, 19); // ld a,(ix+0x07)
    regs.or(0x80); // set bit 7
    m.step(0x33de, 7); // or 0x80
    mem.write8(R(0x07), regs.a);
    m.step(0x33e1, 19); // ld (ix+0x07),a
    regs.incMem8(mem, R(0x0e)); // inc (ix+0x0e) -- flag-correct RMW
    m.step(0x33e4, 23); // inc (ix+0x0e)
    m.step(0x33c0, 10); // jp 0x33c0
  } else {
    // 0x33b5 -- else arm
    m.step(0x33b5, 10); // jp z NOT taken
    regs.a = mem.read8(R(0x07));
    m.step(0x33b8, 19); // ld a,(ix+0x07)
    regs.and(0x7f); // clear bit 7
    m.step(0x33ba, 7); // and 0x7f
    mem.write8(R(0x07), regs.a);
    m.step(0x33bd, 19); // ld (ix+0x07),a
    regs.decMem8(mem, R(0x0e)); // dec (ix+0x0e) -- flag-correct RMW
    m.step(0x33c0, 23); // dec (ix+0x0e)
  }

  // 0x33c0: shared call 0x3409, then FALL THROUGH into entry_33c3 (NO ret here)
  m.push16(0x33c3);
  m.step(0x3409, 17); // call 0x3409
  m.call(0x3409);
  return m.call(0x33c3); // FALL THROUGH -- entry_33c3's ret ends both
}
