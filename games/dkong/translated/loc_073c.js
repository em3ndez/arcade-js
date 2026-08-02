// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_073c  (ROM 0x073C–0x0762) — game state 1.
 *
 *   073c  21 0a 60     ld   hl,0x600a
 *   073f  3a 01 60     ld   a,(0x6001)
 *   0742  a7           and  a
 *   0743  c2 5c 07     jp   nz,0x075c
 *   0746  7e           ld   a,(hl)
 *   0747  ef           rst  0x28
 *   0748  <10-entry table: 0779 0763 123c 1977 127c 07c3 07cb 084b 0000 0000>
 *   075c  36 00        ld   (hl),0x00        ; loc_075c
 *   075e  21 05 60     ld   hl,0x6005
 *   0761  34           inc  (hl)
 *   0762  c9           ret
 *
 * The SECOND inline-jump-table dispatch site in the ROM, and it works the
 * same way as the NMI's at 0x00C9: `rst 0x28` pops its own return address to
 * find the table, so the ten words at 0x0748 are DATA and control never
 * resumes there. The tracer bounded this table at 0x075C independently,
 * from the `jp nz` target -- which is also the continuation this routine
 * falls to when it does NOT dispatch.
 *
 * Two entries are 0x0000, i.e. unused sub-state slots. Entries 2, 3 and 4
 * point into 0x12xx/0x19xx, regions nothing has reached yet.
 *
 * When 0x6001 is non-zero the dispatch is skipped entirely and the routine
 * clears 0x600A and ADVANCES THE GAME STATE by incrementing 0x6005 -- so
 * this is the state that steps the machine on to the next one.
 */
export function loc_073c(m) {
  const { regs, mem } = m;

  regs.hl = 0x600a;
  m.step(0x073f, 10);
  regs.a = mem.read8(0x6001);
  m.step(0x0742, 13);
  regs.and(regs.a);
  m.step(0x0743, 4);

  if (regs.fNZ) {
    // loc_075c -- skip the sub-state dispatch and advance the game state.
    m.step(0x075c, 10);
    mem.write8(regs.hl, 0x00);
    m.step(0x075e, 10);
    regs.hl = 0x6005;
    m.step(0x0761, 10);
    mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
    m.step(0x0762, 11);
    m.ret();
    return;
  }
  m.step(0x0746, 10);

  regs.a = mem.read8(regs.hl); // sub-state from 0x600A
  m.step(0x0747, 7);
  m.push16(0x0748); // rst 0x28 pushes the table base
  m.step(0x0028, 11);
  m.call(0x0028, SUBSTATE_TABLE_073C);
}

/** Handlers reached from the 0x0748 table; two slots are unused (0x0000). */
const SUBSTATE_TABLE_073C = "0x0748 (game state 1 sub-state)";
