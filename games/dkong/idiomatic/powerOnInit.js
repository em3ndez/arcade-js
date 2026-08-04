// SPDX-License-Identifier: GPL-3.0-only
/**
 * powerOnInit — game state 0: the one-time power-on initialization.
 *
 * GAME_STATE is 0 only at reset, and this is the handler for state 0 — so it runs exactly once,
 * and its last act but one is to advance GAME_STATE to 1, which is what makes sure it never runs
 * again. Dead straight-line code, no branches, standing the machine up from cold, in order:
 *
 *   1. CLEAR the tilemap playfield and the sprite shadow buffer.
 *   2. SEED the three score slots — player 1, player 2 and HIGH — by copying a nine-byte template
 *      out of program data: player 1 starts at zero, player 2 gets the attract placeholder, and
 *      HIGH gets the factory default high score.
 *   3. Set the baseline ATTRACT = LEVEL = LIVES = 1, then repaint the reserve-lives and level
 *      indicator. The lives count is handed over in the accumulator; because ATTRACT is already 1
 *      by then, the repaint's own attract guard skips the paint on this frame.
 *   4. Unpack the dip-switch bank into the settings block.
 *   5. Raise the flip-screen latch, advance GAME_STATE to 1 (attract), select the 25m board, and
 *      clear the in-game sub-state selector.
 *   6. Stamp player 1's static "1UP" score marker.
 *   7. Post the three opening deferred-work messages onto the task ring.
 *
 * LIVE-OUT: memory-only — the seeded work RAM, the task ring and its tail, the indicator and
 * marker video cells, the settings block, the cleared playfield and sprite buffer, and the
 * flip-screen latch.
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

// Flip-screen control latch — board hardware, not work RAM. Write-only: readable back only by
// the board, never by the processor.
const FLIPSCREEN = 0x7d82;

// The nine-byte score-slot template in program data: three bytes each for player 1, player 2 and
// HIGH, copied into the three little-endian packed-decimal score slots.
const SCORE_TEMPLATE_ROM = 0x01ba;
const SCORE_TEMPLATE_LEN = 9;

// The three opening deferred-work messages, as [opcode, argument] pairs in post order.
const OPENING_TASKS = [
  [0x03, 0x04],
  [0x02, 0x02],
  [0x02, 0x00],
];

export function powerOnInit(m) {
  const { regs, mem } = m;

  // 1. Blank the playfield tilemap and the sprite shadow buffer.
  clearPlayfieldAndSprites(m);

  // 2. Seed the three score slots from the template in program data.
  for (let i = 0; i < SCORE_TEMPLATE_LEN; i++) {
    mem.write8(P1_SCORE + i, mem.read8(SCORE_TEMPLATE_ROM + i));
  }

  // 3. Baseline: ATTRACT / LEVEL / LIVES = 1, then repaint the lives-and-level indicator.
  //    The 1 in the accumulator is the lives count that repaint reads, so it is set before the
  //    write group. ATTRACT is 1 by then, so the repaint's attract guard skips the paint.
  regs.a = 1;
  mem.write8(ATTRACT, regs.a);
  mem.write8(LEVEL, regs.a);
  mem.write8(LIVES, regs.a);
  drawLivesAndLevel(m);

  // 4. Unpack the dip-switch bank into the settings block.
  decodeDipSwitches(m);

  // 5. Screen up; advance the top-level state to attract; select the 25m board; clear the
  //    in-game sub-state selector.
  mem.write8(FLIPSCREEN, 1);
  mem.write8(GAME_STATE, 1); // attract from here on
  mem.write8(BOARD, 1); // 25m
  mem.write8(GAME_SUBSTATE, 0);

  // 6. Stamp player 1's static "1UP" score marker.
  draw1UpLabel(m);

  // 7. Post the three opening task messages. The ring primitive reads the opcode/argument pair
  //    out of a register pair and never writes it back, so each post just sets the pair first.
  for (const [opcode, argument] of OPENING_TASKS) {
    regs.d = opcode;
    regs.e = argument;
    enqueueTask(m);
  }
}
