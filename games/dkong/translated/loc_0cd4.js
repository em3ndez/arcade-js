// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0cd4  (ROM 0x0CD4–0x0CDE) — board-1 (25m) setup arm: selects the layout table at 0x3AE4 and queues sound 0x08; tail-jumps to loc_0cc6.
 *
 *   0cd4  11 e4 3a     ld   de,0x3ae4
 *   0cd7  3e 08        ld   a,0x08
 *   0cd9  32 89 60     ld   (0x6089),a
 *   0cdc  c3 c6 0c     jp   0x0cc6
 *
 * DE points at ROM 0x3AE4 -- a data address, handed to 0x0DA7 which reads it
 * with `ld a,(de)` and terminates on 0xAA. So this arm selects WHICH table
 * the shared tail walks.
 *
 * THE OTHER THREE ARMS ARE NOT POINTER VARIANTS OF THIS ONE. An earlier
 * version of this comment said they "differ only in that pointer and the
 * value stashed at 0x6089", which is wrong and would have told the next
 * session they were trivial. Decoded from ROM:
 *
 *   0x0CDF  ld de,0x3b5d / ld hl,0x7d86 / ld (hl),0x01 / inc hl /
 *           ld (hl),0x00 / ld a,0x09 / ld (0x6089),a / jp 0x0cc6
 *           -- rewrites BOTH palette-bank latches to bank 1. This arm does
 *              not touch 0x7D86 at all.
 *   0x0CF2  call 0x0d27 / ld a,0x0a / ld (0x6089),a / ld de,0x3be5 / jp 0x0cc6
 *           -- an extra subroutine call.
 *   0x0CB6  call 0x0d43 / ld hl,0x7d86 / ld (hl),0x01 / ld a,0x0b /
 *           ld (0x6089),a / ld de,0x3c8b
 *           -- an extra call AND writes 0x7D86 = 1 while deliberately
 *              leaving 0x7D87 alone (no `inc hl`).
 *
 * Two of the three write the very latch this routine exists to document, so
 * they are separate translations, not parameterisations of this one.
 *
 * 0x6089 IS ALREADY DOCUMENTED IN THIS FILE (see the perFrame notes): it is
 * a source for the ls175.3d sound latch at 0x7C00, and boot zeroes
 * 0x6088-0x608B as its own block. So `ld a,0x08 / ld (0x6089),a` is QUEUEING
 * A SOUND, and each arm queues a different one -- 0x08, 0x09, 0x0A, 0x0B.
 */
export function loc_0cd4(m) {
  const { regs, mem } = m;

  regs.de = 0x3ae4;
  m.step(0x0cd7, 10);
  regs.a = 0x08;
  m.step(0x0cd9, 7);
  mem.write8(0x6089, regs.a);
  m.step(0x0cdc, 13);
  // ONE step for one `jp`. A first version of this change appended a second
  // copy instead of replacing the `throw` that used to follow, charging 10
  // phantom T-states to every instruction downstream -- and it was invisible
  // because this path first executes in frame 518, after all 517 compared
  // images are complete. Second time in this file that an edit added a step
  // beside the throw rather than in place of it.
  m.step(0x0cc6, 10); // jp 0x0cc6 -- the shared tail of all four arms
  m.call(0x0cc6);
}
