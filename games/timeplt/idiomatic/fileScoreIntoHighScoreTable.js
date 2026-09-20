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
import { fetchTableByte } from "./fetchTableByte.js";
import { ACTIVE_PLAYER, HIGH_SCORE_REC0_SCORE_HI, HIGH_SCORE_SLIDE_SRC, HIGH_SCORE_TABLE_BASE, HIGH_SCORE_TABLE_END, PLAYER1_SCORE_HI, PLAYER2_SCORE_HI, SCRATCH_PTR_A, SCRATCH_PTR_B, HIGH_SCORE_INITIALS_CELL_BASE } from "./names.js";

const RECORD_COUNT = 0x05;
const RECORD_STRIDE = 0x08;


const NAME_SENTINEL = 0xf1;

export function fileScoreIntoHighScoreTable(m) {
  const { regs, mem8, mem16 } = m;

  regs.hl = HIGH_SCORE_REC0_SCORE_HI;
  regs.b = RECORD_COUNT;
  // player one selected when the active-player flag reads zero
  let de = mem8[ACTIVE_PLAYER] === 0 ? PLAYER1_SCORE_HI : PLAYER2_SCORE_HI;

  let savedDe = de;
  let filed = false;
  for (;;) {
    savedDe = de;
    const savedHl = regs.hl;
    isScoreBelow(m, de);
    if (regs.fNC) { filed = true; break; } // not below -> this is the slot
    de = savedDe;
    regs.hl = savedHl;
    regs.a = RECORD_STRIDE;
    fetchTableByte(m); // walk the standing pointer down one record
    if (regs.djnz() !== 0) continue;
    break;
  }

  if (!filed) { regs.scf(); return; } // beat nothing

  regs.b = regs.dec8(regs.b);
  let slotPtr;
  if (regs.fZ) {
    slotPtr = HIGH_SCORE_TABLE_END; // slot is the bottom record; nothing to slide
  } else {
    regs.hl = HIGH_SCORE_SLIDE_SRC;
    regs.de = HIGH_SCORE_TABLE_END;
    regs.c = (regs.b << 3) & 0xff; // remaining records, eight cells each, into the copy count
    regs.b = 0x00;
    m.lddrAt(0x4cf4, 0x4cf6);
    regs.exDeHl();
    slotPtr = regs.hl;
  }

  for (let i = 0; i < 3; i++) {
    slotPtr = u16(slotPtr - 1);
    mem8[slotPtr] = NAME_SENTINEL;
  }
  mem16[SCRATCH_PTR_A] = slotPtr;
  slotPtr = u16(slotPtr - 1);
  regs.hl = slotPtr;
  regs.de = savedDe;
  regs.bc = 0x0003;
  regs.exDeHl();
  m.lddrAt(0x4d09, 0x4d0b); // copy the three score cells in

  regs.a = mem8[regs.de]; // the rank the copy uncovered
  regs.hl = HIGH_SCORE_INITIALS_CELL_BASE;
  regs.add(regs.a);
  fetchTableByte(m);
  mem16[SCRATCH_PTR_B] = regs.hl;

  // renumber the rank column top to bottom, 0 upward, one write per record
  let rankAddr = HIGH_SCORE_TABLE_BASE;
  for (let rank = 0; rank < RECORD_COUNT; rank++) {
    mem8[rankAddr] = rank;
    rankAddr = u16(rankAddr + RECORD_STRIDE);
  }

  regs.scf();
  regs.ccf(); // carry clear -> filed
}
