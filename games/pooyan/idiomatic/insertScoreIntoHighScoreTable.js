// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
import {
  ACTIVE_PLAYER,
  P1_SCORE_BCD,
  P2_SCORE_BCD,
  HIGH_SCORE_TABLE,
  HIGH_SCORE_INSERT_RANK,
  HIGH_SCORE_TIME_TABLE,
  PLAY_TIMER_BCD_P1,
  PLAY_TIMER_BCD_P2,
  PLAY_TIMER_GATE_P1,
  PLAY_TIMER_GATE_P2,
  PANEL_TILE_SOURCE,
} from "./names.js";
/**
 * insertScoreIntoHighScoreTable — insert the finished player's score into the sorted ten-entry high-score table.
 *
 * WHAT IT IS
 *   The high-score-board insert-sort. When a player's turn ends, this decides whether the
 *   just-finished score earned a place on the board and, if so, splices it into the correct rank
 *   and slides every lower entry down to make room. It is the transition off the playable frame:
 *   the phase-exhausted handler advancePlayStateThenInsertHighScore falls straight into it, and the
 *   play sub-state that stages name entry keys off the rank it leaves behind.
 *
 * ROLE IN THE MACHINE
 *   The board is a ten-entry table of three-byte packed-BCD scores at HIGH_SCORE_TABLE (0x8a00),
 *   kept sorted high to low. Each score is stored most-significant byte last (the low digit pair
 *   first, the high digit pair at +2), so a magnitude comparison walks the three bytes from the top
 *   down. Two side tables ride in lock-step with the board, one entry per rank: a per-entry
 *   play-time table just below the board (topped at HIGH_SCORE_TIME_TABLE, 0x89e0) that records how
 *   long that game lasted, and the status-panel tile source (PANEL_TILE_SOURCE, 0x8e00), the
 *   work-RAM cells the panel renderer paints to the screen. Everything left here is read back
 *   later — the board and its play-times by the attract-HUD renderer paintAttractHudAndHighScores,
 *   the fresh panel cells by the panel renderer, and the recorded rank by the name-entry sequence.
 *
 * ROM 0x1ab2   Grounding: [seen]
 *
 * The routine scans for the first entry the just-finished player's score (its buffer chosen by the
 * active-player select) ranks at or above, comparing MSB first. If it beats none of the ten it
 * returns unchanged. Otherwise it records the winning rank, opens a 3-byte slot by shifting the
 * tail of the table down one entry, and writes the score in. Two parallel side tables ride along:
 * a per-entry play-time pair (copied from the active play-timer bank) is shifted and a gate marker
 * seeded, and the display-tile side table is shifted and the new entry's three cells cleared to the
 * blank tile via the fill helper.
 *
 * LIVE-OUT: memory only — the board (0x8a00), the play-time side table (0x89e0 down) and the panel
 * tile source (0x8e00), plus the insert-rank cell (HIGH_SCORE_INSERT_RANK) and the finishing
 * player's play-timer gate marker.
 */

const ENTRIES = 10; // ranked slots on the board
const STRIDE = 3; // bytes per score entry (packed BCD, most-significant byte at +2)
const TILE_BLANK = 0x10; // blank tile stamped into the panel side table's new cells

/**
 * MSB-first unsigned compare of two three-byte packed-BCD records: true when the record at `a` is
 * greater than or equal to the one at `b`. The scores are stored most-significant byte last, so the
 * top byte (+2) decides first; only on a tie does it drop to the middle byte (+1), then the low
 * byte (+0). This is exactly the order the board is kept in, so the scan below stops at the first
 * rank the new score belongs at.
 */
function recordAtLeast(mem8, a, b) {
  if (mem8[a + 2] !== mem8[b + 2]) return mem8[a + 2] >= mem8[b + 2];
  if (mem8[a + 1] !== mem8[b + 1]) return mem8[a + 1] >= mem8[b + 1];
  return mem8[a] >= mem8[b];
}

/**
 * Overlap-safe descending block move that opens a slot in a table. Copies `count` bytes starting at
 * the top address and walking downward — dst, dst-1, ... each taken from the matching src cell.
 * Because both pointers descend and dst sits three bytes above src, the upward shift never clobbers
 * a source byte before it is read. Each table here is opened by shifting its tail one whole entry
 * (three bytes) up in address; the entry that had ranked tenth spills past the end and is dropped.
 */
function shiftBlockDown(mem8, srcTop, dstTop, count) {
  for (let i = 0; i < count; i++) mem8[dstTop - i] = mem8[srcTop - i];
}

export function insertScoreIntoHighScoreTable(m) {
  const { mem8 } = m;
  // Pick the finishing player's live score buffer. Bit 0 of ACTIVE_PLAYER (0x880d) selects whose
  // turn just ended: clear -> player one's buffer (P1_SCORE_BCD 0x88a2), set -> player two's
  // (P2_SCORE_BCD 0x88a5). Both use the same three-byte packed-BCD layout as a board entry, so the
  // comparison and the copy below treat the score and a board slot identically.
  const newScore = (mem8[ACTIVE_PLAYER] & 0x01) !== 0 ? P2_SCORE_BCD : P1_SCORE_BCD;

  // rank = the first entry the new score reaches or beats (MSB first). Walk the board from rank 0
  // (the current champion at HIGH_SCORE_TABLE, 0x8a00) downward, one three-byte entry at a time.
  // `rank` counts entries passed; `slot` tracks that entry's address.
  let rank = 0;
  let slot = HIGH_SCORE_TABLE;
  while (rank < ENTRIES && !recordAtLeast(mem8, newScore, slot)) {
    rank += 1;
    slot += STRIDE;
  }
  if (rank >= ENTRIES) return; // beat none of the ten -> no board place, every table left untouched

  // The score earned rank `rank` (0-based). Record it one-based in HIGH_SCORE_INSERT_RANK (0x89fc);
  // the name-entry stage reads this cell to know which row to light up (zero here means "no entry").
  mem8[HIGH_SCORE_INSERT_RANK] = rank + 1;
  // Bytes from the opened slot through the end of the board: three per entry for the insertion point
  // and every rank below it. The same span is shifted in each of the three parallel tables.
  const shift = STRIDE * (ENTRIES - rank); // bytes from the slot to the table's end

  // open the slot and write the 3-byte score. Shift the board's tail one whole entry up in address
  // (dropping what had been the tenth score), then drop the new score's three bytes into the slot.
  shiftBlockDown(mem8, HIGH_SCORE_TABLE + 0x1d, HIGH_SCORE_TABLE + 0x20, shift);
  mem8[slot] = mem8[newScore];
  mem8[slot + 1] = mem8[newScore + 1];
  mem8[slot + 2] = mem8[newScore + 2];

  // play-time side table + gate marker, per active player. The play-time table grows just below the
  // board and shifts in lock-step so rank N's play time stays beside rank N's score. ACTIVE_PLAYER
  // (0x880d) nonzero picks the second player: select that player's timer bank, and seed their gate
  // byte (PLAY_TIMER_GATE_P1 0x89e1 / P2 0x89e2) to 1, which freezes their wall-clock timer once the
  // player's game is over.
  const player1 = mem8[ACTIVE_PLAYER] !== 0;
  const timerBank = player1 ? PLAY_TIMER_BCD_P2 : PLAY_TIMER_BCD_P1;
  mem8[player1 ? PLAY_TIMER_GATE_P2 : PLAY_TIMER_GATE_P1] = 0x01;
  // Shift the play-time table's tail up one entry to match the board, then store the finished game's
  // duration into the opened slot. The timer bank holds {frame sub-counter, BCD seconds, BCD
  // minutes}; only the seconds (+1) and minutes (+2) digits are recorded, the sub-counter dropped.
  shiftBlockDown(mem8, HIGH_SCORE_TIME_TABLE - 3, HIGH_SCORE_TIME_TABLE, shift);
  const sideSlot = HIGH_SCORE_TIME_TABLE - shift;
  mem8[sideSlot] = mem8[timerBank + 2];
  mem8[sideSlot - 1] = mem8[timerBank + 1];

  // display-tile side table: shift down a slot, then blank the new entry's three cells. This is the
  // panel tile source (PANEL_TILE_SOURCE, 0x8e00) the status-panel renderer paints to the screen,
  // ten rows of three cells mirroring the board. Shift its tail up one entry to stay aligned, then
  // clear the new entry's three cells to the blank tile so the fresh row starts empty (the
  // name-entry animation fills it in afterward).
  shiftBlockDown(mem8, PANEL_TILE_SOURCE + 0x1c, PANEL_TILE_SOURCE + 0x1f, shift);
  fillByteRun(m, PANEL_TILE_SOURCE + 0x1e - shift, TILE_BLANK, STRIDE);
}
