// SPDX-License-Identifier: GPL-3.0-only
/**
 * runHighScoreInitialsEntry — the high-score initials-entry screen: build the display, let the
 * player dial in their three initials, then show the final score readouts.
 *
 * When the player earns a top-three score the game runs this screen so they can enter their
 * initials against that rank's record. In order it: (1) builds the fixed screen — decode the
 * cabinet dip switches, blank the display, paint the shared panel (edge columns + both score
 * HUDs), then this screen's own flat colour columns, a variant-selected label strip naming the
 * rank, and a fixed prompt strip, with the three initials counted into a small down-counter; (2)
 * runs the entry loop — one initial cell blinks (its letter, then a cursor glyph, on a fixed
 * cadence) while each pass hands the frame's input to the per-frame handler that steps the letter
 * up/down or commits it, a commit moving the cell on, counting one off, and restarting the idle
 * timeout; the loop ends when all three are committed or the player sits idle past the timeout;
 * (3) on completion rebuilds the screen, plays a confirmation sound, holds briefly, clears the
 * rank selector, and draws the final score readouts — an idle timeout instead just returns with
 * the entry abandoned. The rank selector picks the label strip, the blink position, its colour,
 * and which of the three high-score records the initials fill. The per-frame handler reads its
 * working cursors out of the machine registers, so the loop seats them there and threads them
 * through it: the video cell, the colour cell, the record being filled, the colour, and the
 * current letter code — a genuine register boundary; the rest is ordinary memory work.
 */

import {
  PLAY_PHASE_COUNTER,
  VARIANT,
  TILE_COL,
  TILE_ROW,
  PLOT_RUN_LENGTH,
  HIGH_SCORE_TABLE,
  INITIALS_REMAINING,
} from "./names.js";
import { applyDipSwitches } from "./applyDipSwitches.js";
import { blankScreen } from "./blankScreen.js";
import { drawSharedPanel } from "./drawSharedPanel.js";
import { fillColourColumnAt } from "./fillColourColumnAt.js";
import { rowColToTileOffset } from "./rowColToTileOffset.js";
import { deriveTileWriteCursors } from "./deriveTileWriteCursors.js";
import { copyTileColumn } from "./copyTileColumn.js";
import { waitFrames } from "./waitFrames.js";
import { stepHighScoreInitialsEntry } from "./stepHighScoreInitialsEntry.js";
import { setupBoardDisplay } from "./setupBoardDisplay.js";
import { requestSound5 } from "./requestSound5.js";
import { renderScoreReadouts } from "./renderScoreReadouts.js";

const INITIALS_COUNT = 3; // a high-score entry is three letters

const CURSOR_TILE = 36; // the cursor glyph the cell alternates to while blinking
const HOME_LETTER = 10; // the letter code every initial starts on
const BLINK_LETTER_FRAMES = 8; // frames the letter is shown each blink
const BLINK_CURSOR_FRAMES = 4; // frames the cursor glyph is shown each blink
const IDLE_TIMEOUT_FRAMES = 60; // frames of no committed input before the entry is abandoned
const FINISH_BOARD_MODE = 0xd0; // board-mode / screen-wide colour byte for the completion rebuild
const FINISH_HOLD_FRAMES = 60; // frames the completed screen is held before the readouts

// The frame waits and the per-frame handler still take the machine's Z80 return path, so
// their non-tail calls are bracketed with the return address the caller would push.
const RESUME_AFTER_LETTER = 0x4ebd;
const RESUME_AFTER_CURSOR = 0x4ec4;
const RESUME_AFTER_STEP = 0x4ec7;
const RESUME_AFTER_FINISH_HOLD = 0x4eda;

/** Label strip naming the rank, by selector: rank 2, rank 1, or (otherwise) rank 0. */
function rankLabelStrip(selector) {
  if (selector === 3) return 0x4a8e;
  if (selector === 2) return 0x4a7b;
  return 0x4a68;
}

/**
 * Where this rank's initials are entered: the record being filled (the three 5-byte
 * high-score records sit back to back), the on-screen video + colour cells the initials
 * blink in, and the colour painted into that cell.
 */
function rankDisplay(selector) {
  if (selector === 3) return { record: HIGH_SCORE_TABLE + 10, videoCell: 0x915f, colourCell: 0x895f, colour: 7 };
  if (selector === 2) return { record: HIGH_SCORE_TABLE + 5, videoCell: 0x927f, colourCell: 0x8a7f, colour: 4 };
  return { record: HIGH_SCORE_TABLE + 0, videoCell: 0x939f, colourCell: 0x8b9f, colour: 6 };
}

/** Seat the tile cursor at (column, row) and derive its colour-RAM / video-RAM write cursors. */
function seatCell(m, column, row) {
  m.mem8[TILE_COL] = column;
  m.mem8[TILE_ROW] = row;
  rowColToTileOffset(m);
  deriveTileWriteCursors(m);
}

export function* runHighScoreInitialsEntry(m) {
  const { mem8, regs } = m;

  const rank = mem8[VARIANT]; // which top-three rank is being entered

  // 1. Build the fixed part of the screen.
  mem8[PLAY_PHASE_COUNTER] = 0;
  applyDipSwitches(m);
  blankScreen(m);
  drawSharedPanel(m);

  // Three flat colour columns down the panel.
  fillColourColumnAt(m, 7, 3);
  fillColourColumnAt(m, 9, 3);
  fillColourColumnAt(m, 13, 6);

  // The rank's label strip (18 tiles) with a colour column beside it.
  seatCell(m, 15, 8);
  mem8[PLOT_RUN_LENGTH] = 18;
  copyTileColumn(m, rankLabelStrip(rank));
  fillColourColumnAt(m, 15, 6);

  // The fixed prompt strip (26 tiles) with its colour column.
  seatCell(m, 22, 3);
  mem8[PLOT_RUN_LENGTH] = 26;
  copyTileColumn(m, 0x4aa9);
  fillColourColumnAt(m, 22, 7);

  // Three initials still to enter.
  mem8[INITIALS_REMAINING] = INITIALS_COUNT;

  // 2. Seat this rank's cursors in the register file (the per-frame handler's ABI) and
  //    paint its colour into its colour cell.
  const display = rankDisplay(rank);
  regs.b = display.colour;
  regs.ix = display.record;
  regs.hl = display.videoCell;
  regs.de = display.colourCell;

  mem8[PLAY_PHASE_COUNTER] = 0; // restart the idle timeout
  regs.c = HOME_LETTER; // the letter shown starts at its home code
  mem8[regs.de] = regs.b; // paint the initial's colour into its colour cell

  // The entry loop: blink the cell and hand each frame's input to the per-frame handler.
  for (;;) {
    mem8[regs.hl] = regs.c; // draw the current letter
    m.push16(RESUME_AFTER_LETTER);
    yield* waitFrames(m, BLINK_LETTER_FRAMES);

    mem8[regs.hl] = CURSOR_TILE; // swap to the cursor glyph (the blink)
    m.push16(RESUME_AFTER_CURSOR);
    yield* waitFrames(m, BLINK_CURSOR_FRAMES);

    m.push16(RESUME_AFTER_STEP);
    yield* stepHighScoreInitialsEntry(m); // step the letter up/down, or commit this initial

    if (mem8[INITIALS_REMAINING] !== 0) {
      // Still entering: abandon the entry only once the player has sat idle past the timeout.
      if (mem8[PLAY_PHASE_COUNTER] >= IDLE_TIMEOUT_FRAMES) return m.ret();
      continue;
    }
    break; // all three initials committed
  }

  // 3. Completed: rebuild the screen, confirm, hold, clear the rank selector, show the readouts.
  setupBoardDisplay(m, FINISH_BOARD_MODE);
  requestSound5(m);
  m.push16(RESUME_AFTER_FINISH_HOLD);
  yield* waitFrames(m, FINISH_HOLD_FRAMES);
  mem8[VARIANT] = 0;
  return renderScoreReadouts(m); // draw the final score readouts — this hand-off is the exit
}
