// SPDX-License-Identifier: GPL-3.0-only
import { blockCopy } from "./blockCopy.js";
import { OBJECT_WORK_BUFFER, ALIEN_SHOT_SPRITE_FRAME_CEILING } from "./names.js";

/**
 * copyRecordToWorkBuffer — lift an object's 11-byte record into the shared scratch buffer.
 *
 * WHAT IT IS
 *   Stashes the accumulator (A) into a scratch cell, then block-copies an eleven-byte object strip
 *   from the caller's source (DE) into the fixed 11-byte work buffer at OBJECT_WORK_BUFFER.
 *
 * ROLE IN THE MACHINE
 *   The object-table handlers process one object's move-record at a time in a fixed scratch strip
 *   and write it back afterwards (see mechanisms.md "Generic record helpers"). This routine is the
 *   "lift in" half: it primes the shared work buffer OBJECT_WORK_BUFFER with an object's eleven bytes so the
 *   handler can edit them in place; its twin copyWorkBufferToRecord (0x055b) copies the same eleven
 *   bytes back out. The alien-shot slot handlers call it at the top of their step. Before the copy
 *   it also parks A into ALIEN_SHOT_SPRITE_FRAME_CEILING — a scratch cell the handler reads back later (the incoming A
 *   carries a per-call value the copy loop would otherwise clobber). Copy length 0x0b (11) is the
 *   size of one object move-record strip.
 *
 * ROM 0x0550.  Grounding: [seen].
 *
 * LIVE-OUT: memory only (ALIEN_SHOT_SPRITE_FRAME_CEILING set, the 11 bytes at OBJECT_WORK_BUFFER overwritten); the seam completes
 * the ret. A and DE default from the registers when the caller does not pass them.
 */
export function copyRecordToWorkBuffer(m, a = m.regs.a, de = m.regs.de) {
  // Stash A into the scratch cell ALIEN_SHOT_SPRITE_FRAME_CEILING so it survives the copy below (the block move does not
  // preserve A on the Z80; the handler reads this back afterward).
  m.mem8[ALIEN_SHOT_SPRITE_FRAME_CEILING] = a;
  // Copy the 11-byte object strip from the caller's source DE into the shared work buffer OBJECT_WORK_BUFFER.
  blockCopy(m, de, OBJECT_WORK_BUFFER, 0x0b);
}
