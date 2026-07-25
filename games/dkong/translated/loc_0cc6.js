// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0cc6  (ROM 0x0CC6–0x0CD3) — the tail every board-setup arm converges on: walks the selected layout via 0x0DA7, then tail-jumps to 0x3FA0.
 *
 *   0cc6  cd a7 0d     call 0x0da7
 *   0cc9  3a 27 62     ld   a,(0x6227)
 *   0ccc  fe 04        cp   0x04
 *   0cce  cc 00 0d     call z,0x0d00
 *   0cd1  c3 a0 3f     jp   0x3fa0
 *
 * The tail every dispatch arm converges on. DE still points at whichever
 * table its arm selected, and 0x0DA7 walks it.
 *
 * `call z,0x0D00` fires only when 0x6227 is 4.
 *
 * SCOPE, because this routine is shared by all four dispatch arms and the
 * justification is not: on the arm we reach (0x0CD4, entered when 0x6227 is
 * 1) it can never fire. But the FALL-THROUGH arm at 0x0CB6 is entered when
 * 0x6227 is not in {1,2,3} -- which includes exactly 4. So the one arm where
 * this CAN legitimately fire is the one the original note did not cover, and
 * a future session translating 0x0CB6 would be told the state machine had
 * diverged when it had not.
 *
 * Left as a throw rather than a silent skip because on this path reaching it
 * does mean divergence. Traces show 0x0D00 executed by no tape on hand -- a
 * dynamic claim, distinct from its being statically reachable, which it is.
 */
export function loc_0cc6(m) {
  const { regs, mem } = m;

  m.push16(0x0cc9);
  m.step(0x0da7, 17);
  m.call(0x0da7);

  regs.a = mem.read8(0x6227);
  m.step(0x0ccc, 13);
  regs.cp(0x04);
  m.step(0x0cce, 7);
  if (regs.fZ) {
    m.push16(0x0cd1); // call z,0x0d00 taken (0x6227==4, board 4 rivet)
    m.step(0x0d00, 17);
    m.call(0x0d00);
  } else {
    m.step(0x0cd1, 10); // call z,0x0d00 not taken
  }

  m.step(0x3fa0, 10); // jp -- TAIL jump, no return address pushed
  m.call(0x3fa0);
}
