// SPDX-License-Identifier: GPL-3.0-only
/**
 * commitGameStart — commit a credited game start: spend the credit(s), seed the player context
 * records, wipe the screen, and advance into gameplay.
 *
 * Dispatched every frame while CREDITED (GAME_STATE 2, GAME_SUBSTATE 1). Reads the pressed start
 * button — 0x04 = 1-player (spend one credit, clear player 2's context), 0x08 = 2-player (spend
 * two, seed player 2's context and post its "bring in" task), anything else (0x00 waiting, 0x0C
 * both held) does nothing and re-runs next frame. The shared tail then records the 1P/2P flag,
 * wipes playfield+sprites, seeds player 1's context, posts its task, and advances to
 * GAME_SUBSTATE 0 / GAME_STATE 3.
 *
 * ACTIVE_PLAYER_INDEX and TWO_PLAYER_GAME are adjacent bytes written by the hardware as one
 * 16-bit store: low byte = active player (0 = player 1 up), high byte = the two-player flag.
 *
 * LIVE-OUT: memory-only — the two player-context records, the active-player/two-player pair, the
 * cleared playfield and sprites, the two posted tasks, and the state/sub-state advance.
 */

import {
  ACTIVE_PLAYER_INDEX,
  DIP_LIVES,
  GAME_STATE,
  GAME_SUBSTATE,
  P1_CONTEXT,
  P2_CONTEXT,
  PLAYER_CONTEXT_TEMPLATE,
  START_TASK_P2,
  TWO_PLAYER_GAME,
} from "./names.js";
import { readStartButtonSelector } from "./readStartButtonSelector.js";
import { spendCredit } from "./spendCredit.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { enqueueTask } from "./enqueueTask.js";

// 8-byte player context: byte 0 = starting lives, bytes 1-7 = the fixed template in program
// memory, copied verbatim.
const CONTEXT_BYTES = 0x08;
const CONTEXT_TEMPLATE_BYTES = 0x07;

// Both arms post opcode 0x01 with the player index as argument.
const START_TASK_P1 = 0x0100; // opcode 0x01, argument 0x00

function seedPlayerContext(m, base) {
  const { mem8 } = m;
  mem8[base] = mem8[DIP_LIVES];
  for (let i = 0; i < CONTEXT_TEMPLATE_BYTES; i++) {
    mem8[base + 1 + i] = mem8[PLAYER_CONTEXT_TEMPLATE + i];
  }
}

export function commitGameStart(m) {
  const { regs, mem8 } = m;

  // 0x04 = 1-player, 0x08 = 2-player, anything else keeps waiting.
  readStartButtonSelector(m);
  const selector = regs.a;

  let twoPlayer;
  if (selector === 0x04) {
    spendCredit(m);
    for (let i = 0; i < CONTEXT_BYTES; i++) mem8[P2_CONTEXT + i] = 0x00;
    twoPlayer = false;
  } else if (selector === 0x08) {
    spendCredit(m); // two credits, one per player
    spendCredit(m);
    seedPlayerContext(m, P2_CONTEXT);
    regs.de = START_TASK_P2;
    enqueueTask(m);
    twoPlayer = true;
  } else {
    return;
  }

  // The hardware's single 16-bit store: low byte -> ACTIVE_PLAYER_INDEX (0 = player 1 up),
  // high byte -> TWO_PLAYER_GAME.
  mem8[ACTIVE_PLAYER_INDEX] = 0x00;
  mem8[TWO_PLAYER_GAME] = twoPlayer ? 0x01 : 0x00;
  clearPlayfieldAndSprites(m);
  seedPlayerContext(m, P1_CONTEXT);
  regs.de = START_TASK_P1;
  enqueueTask(m);

  mem8[GAME_SUBSTATE] = 0x00;
  mem8[GAME_STATE] = 0x03;
}
