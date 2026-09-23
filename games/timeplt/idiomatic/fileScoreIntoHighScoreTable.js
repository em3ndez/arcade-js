// SPDX-License-Identifier: GPL-3.0-only
/** fileScoreIntoHighScoreTable — try to file the active player's finished score into the five-entry high-score board.
 * The standing records are read top (highest) first; the new score is compared against each until
 * the first one it is NOT below, which is where it belongs. The records beneath that slot slide
 * down one place, the new score is written into the freed slot with its three name cells set to a
 * blank sentinel, the record's initial-glyph row pointer is looked up from the byte the copy
 * uncovered, and the rank column is renumbered top to bottom. A score that beats none is dropped.
 * LIVE-OUT: the board, the two saved pointers, and carry — clear when filed, set when dropped. */

import { u16 } from "../../../core/int.js";
import { isScoreBelow } from "./isScoreBelow.js";
import { ACTIVE_PLAYER, HIGH_SCORE_REC0_SCORE_HI, HIGH_SCORE_SLIDE_SRC, HIGH_SCORE_TABLE_BASE, HIGH_SCORE_TABLE_END, PLAYER1_SCORE_HI, PLAYER2_SCORE_HI, SCRATCH_PTR_A, SCRATCH_PTR_B, HIGH_SCORE_INITIALS_CELL_BASE } from "./names.js";

const RECORD_COUNT = 0x05;
const RECORD_STRIDE = 0x08;

const NAME_SENTINEL = 0xf1;

export function fileScoreIntoHighScoreTable(m) {
  const { regs, mem8, mem16 } = m;

  const scorePtr = mem8[ACTIVE_PLAYER] === 0 ? PLAYER1_SCORE_HI : PLAYER2_SCORE_HI;

  let standing = HIGH_SCORE_REC0_SCORE_HI;
  let filed = false;
  let rank = 0;
  for (; rank < RECORD_COUNT; rank++) {
    if (!isScoreBelow(m, scorePtr, standing)) { filed = true; break; } // not below -> this is the slot
    standing = u16(standing + RECORD_STRIDE);
  }

  if (!filed) return (regs.fC = true); // beat nothing

  // records beneath the slot, eight cells each; when the slot is the bottom record none slide
  const slideBytes = (RECORD_COUNT - 1 - rank) * RECORD_STRIDE;
  if (slideBytes > 0) {
    regs.hl = HIGH_SCORE_SLIDE_SRC;
    regs.de = HIGH_SCORE_TABLE_END;
    regs.bc = slideBytes;
    m.lddrAt(0x4cf4, 0x4cf6); // z80-primitive: LDDR block copy
  }
  let slotPtr = u16(HIGH_SCORE_TABLE_END - slideBytes);

  for (let i = 0; i < 3; i++) {
    slotPtr = u16(slotPtr - 1);
    mem8[slotPtr] = NAME_SENTINEL;
  }
  mem16[SCRATCH_PTR_A] = slotPtr;

  slotPtr = u16(slotPtr - 1);
  regs.hl = scorePtr;
  regs.de = slotPtr;
  regs.bc = 3;
  m.lddrAt(0x4d09, 0x4d0b); // z80-primitive: LDDR copies the three score cells in

  const uncovered = mem8[u16(slotPtr - 3)]; // the rank the copy uncovered
  mem16[SCRATCH_PTR_B] = u16(HIGH_SCORE_INITIALS_CELL_BASE + ((uncovered + uncovered) & 0xff));

  // renumber the rank column top to bottom, 0 upward, one write per record
  let rankAddr = HIGH_SCORE_TABLE_BASE;
  for (let r = 0; r < RECORD_COUNT; r++) {
    mem8[rankAddr] = r;
    rankAddr = u16(rankAddr + RECORD_STRIDE);
  }

  return (regs.fC = false); // carry clear -> filed
}
