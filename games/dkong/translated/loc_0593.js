// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0593  (ROM 0x0593–0x059A) — masks one BCD digit, stores it, and advances IX by DE.
 *
 *   0593  e6 0f        and  0x0f
 *   0595  dd 77 00     ld   (ix+0x00),a
 *   0598  dd 19        add  ix,de
 *   059a  c9           ret
 *
 * Masks to one BCD digit, stores it, and advances IX by DE -- so the caller
 * controls the step direction and the digit routine stays position-agnostic.
 */
export function loc_0593(m) {
  const { regs, mem } = m;
  regs.and(0x0f);
  m.step(0x0595, 7);
  mem.write8(regs.ix, regs.a);
  m.step(0x0598, 19); // ld (ix+d),a
  // WAS `regs.ix = (regs.ix + regs.de) & 0xffff` -- arithmetically right and
  // flag-wise wrong. `add ix,rr` sets H, N and C (and the undocumented F3/F5)
  // from the 16-bit result; the open-coded version left all of them at
  // whatever the preceding `and 0x0f` had set.
  //
  // A liveness check that stops at the routine boundary can return the right
  // verdict BY LUCK: "no reader in this routine" is not "no reader". This is a
  // two-instruction routine whose second instruction is the `ret`, so the
  // carry leaves immediately. Traced out of the caller loop at 0x0583:
  //   loop-back    -- carry DIES at `rrca` (0x0584).
  //   fall-through -- escapes `ret` 0x059A, `ret` 0x0592, reaches 0x15B0 past
  //     three flag-neutral instructions, and escapes `ret` 0x15F9 too. STILL
  //     LIVE three returns up.
  //
  // Whether any reader exists further up is unresolved and does not matter for
  // correctness now that the flags are set correctly.
  regs.addIx(regs.de);
  m.step(0x059a, 15); // add ix,de
  m.ret();
}
