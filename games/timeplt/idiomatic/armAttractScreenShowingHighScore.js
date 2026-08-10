// SPDX-License-Identifier: GPL-3.0-only
/** armAttractScreenShowingHighScore — arm a fresh screen once a per-frame countdown lapses. Every call first ticks that
 * countdown; the rest runs only on the call that zeroes it — push four fixed commands onto the ring,
 * seed a marker into two cells, patch six cells from the record list that follows this routine (each
 * destination gets a value with a marker beside it), print the six-digit readout, set two sub-state
 * cells, and push a fifth command only when the gate cell is non-zero. LIVE-OUT: memory. */

import { paintHighScoreReadout } from "./paintHighScoreReadout.js";
import { postCommand } from "./postCommand.js";

// the countdown guard is still frozen, reached through the dispatch registry
const COUNTDOWN = 0x01c2;

const CELL_SEED = 0x13;
const PATCH_LIST = 0x163f;
const PATCH_COUNT = 6;
const PATCH_MARKER = 0x05;

export function armAttractScreenShowingHighScore(m) {
  const { regs, mem8 } = m;

  m.push16(0x1601);
  m.call(COUNTDOWN);
  if (regs.fNZ) return;

  regs.de = 0x0105; postCommand(m);
  regs.de = 0x0106; postCommand(m);
  regs.de = 0x0107; postCommand(m);
  regs.de = 0x0601; postCommand(m);

  mem8[0xa701] = CELL_SEED;
  mem8[0xa6e1] = CELL_SEED;

  let cursor = PATCH_LIST;
  for (let i = 0; i < PATCH_COUNT; i++) {
    const dest = mem8[cursor] | (mem8[cursor + 1] << 8);
    mem8[dest] = mem8[cursor + 2];
    mem8[dest + 1] = PATCH_MARKER;
    cursor += 3;
  }

  paintHighScoreReadout(m);

  mem8[0xa9ab] = 1;
  mem8[0xa9ac] = 2;
  if (mem8[0xa9c0] === 0) return;

  regs.de = 0x010d; postCommand(m);
}
