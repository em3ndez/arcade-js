// SPDX-License-Identifier: GPL-3.0-only
/** armAttractScreenShowingHighScore — arm a fresh screen once a per-frame countdown lapses. Every call first ticks that
 * countdown; the rest runs only on the call that zeroes it — push four fixed commands onto the ring,
 * seed a marker into two cells, patch six cells from the record list that follows this routine (each
 * destination gets a value with a marker beside it), print the six-digit readout, set two sub-state
 * cells, and push a fifth command only when the gate cell is non-zero. LIVE-OUT: memory. */

import { paintHighScoreReadout } from "./paintHighScoreReadout.js";
import { postCommand } from "./postCommand.js";
import { blankNextLine } from "./blankNextLine.js";
import { FREE_PLAY, SEQUENCE_PHASE, SEQUENCE_SUBSTEP, HIGH_SCORE_PATCH_TABLE, HIGH_SCORE_MARKER_CELL_UPPER, HIGH_SCORE_MARKER_CELL_LOWER } from "./names.js";

const CELL_SEED = 0x13;
const PATCH_COUNT = 6;
const PATCH_MARKER = 0x05;

export function armAttractScreenShowingHighScore(m) {
  const { mem8 } = m;

  // blankNextLine returns whether its line counter reached zero (Z set); the guard bails while
  // it has not, so consume that return instead of reading the flag back.
  if (!blankNextLine(m)) return;

  postCommand(m, 1, 5);
  postCommand(m, 1, 6);
  postCommand(m, 1, 7);
  postCommand(m, 6, 1);

  mem8[HIGH_SCORE_MARKER_CELL_LOWER] = CELL_SEED;
  mem8[HIGH_SCORE_MARKER_CELL_UPPER] = CELL_SEED;

  let cursor = HIGH_SCORE_PATCH_TABLE;
  for (let i = 0; i < PATCH_COUNT; i++) {
    const dest = mem8[cursor] | (mem8[cursor + 1] << 8);
    mem8[dest] = mem8[cursor + 2];
    mem8[dest + 1] = PATCH_MARKER;
    cursor += 3;
  }

  paintHighScoreReadout(m);

  mem8[SEQUENCE_PHASE] = 1;
  mem8[SEQUENCE_SUBSTEP] = 2;
  if (mem8[FREE_PLAY] === 0) return;

  return postCommand(m, 1, 13);
}
