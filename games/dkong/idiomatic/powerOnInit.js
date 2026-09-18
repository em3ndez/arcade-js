// SPDX-License-Identifier: GPL-3.0-only
/**
 * powerOnInit — game-state-0 handler: the one-time power-on init. Clears the playfield and sprite
 * buffer, seeds the score slots, sets ATTRACT/LEVEL/LIVES = 1 and repaints the indicator, unpacks
 * the dip switches, raises the flip-screen latch, advances to attract on board 25m, stamps "1UP",
 * and posts the three opening tasks.
 *
 * LIVE-OUT: memory-only — seeded work RAM, the task ring and tail, indicator and marker video
 * cells, the settings block, the cleared playfield and sprite buffer, and the flip-screen latch.
 */

import {
  ATTRACT,
  LEVEL,
  LIVES,
  GAME_STATE,
  BOARD,
  GAME_SUBSTATE,
  P1_SCORE,
} from "./names.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { drawLivesAndLevel } from "./drawLivesAndLevel.js";
import { decodeDipSwitches } from "./decodeDipSwitches.js";
import { draw1UpLabel } from "./draw1UpLabel.js";
import { enqueueTask } from "./enqueueTask.js";

// Flip-screen control latch — board hardware, write-only, not readable by the processor.
const FLIPSCREEN = 0x7d82;

const SCORE_TEMPLATE_ROM = 0x01ba;
const SCORE_TEMPLATE_LEN = 9;

const OPENING_TASKS = [
  [0x03, 0x04],
  [0x02, 0x02],
  [0x02, 0x00],
];

export function powerOnInit(m) {
  const { regs, mem, mem8 } = m;

  clearPlayfieldAndSprites(m);

  for (let i = 0; i < SCORE_TEMPLATE_LEN; i++) {
    mem8[P1_SCORE + i] = mem8[SCORE_TEMPLATE_ROM + i];
  }

  // The 1 in the accumulator is the lives count the repaint reads, so set it before the writes.
  regs.a = 1;
  mem8[ATTRACT] = regs.a;
  mem8[LEVEL] = regs.a;
  mem8[LIVES] = regs.a;
  drawLivesAndLevel(m);

  decodeDipSwitches(m);

  mem.write8(FLIPSCREEN, 1);
  mem8[GAME_STATE] = 1;
  mem8[BOARD] = 1;
  mem8[GAME_SUBSTATE] = 0;

  draw1UpLabel(m);

  for (const [opcode, argument] of OPENING_TASKS) {
    enqueueTask(m, opcode, argument);
  }
}
