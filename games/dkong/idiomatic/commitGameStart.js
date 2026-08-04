// SPDX-License-Identifier: GPL-3.0-only
/**
 * commitGameStart — commit a credited game start: spend the credit(s), seed the
 * player context records, wipe the screen, and advance into gameplay.
 *
 * Dispatched every frame while the machine is CREDITED (GAME_STATE == 2) and this
 * sub-state is selected (GAME_SUBSTATE == 1). It reads which start button is pressed —
 * 0x04 for the 1-player button, 0x08 for the 2-player one — and dispatches:
 *
 *   1-PLAYER (0x04): spend one credit, then CLEAR player 2's saved 8-byte context, since
 *     there is no player 2 this game.
 *   2-PLAYER (0x08): spend two credits, one per player; SEED player 2's context (byte 0 =
 *     starting lives from DIP_LIVES, bytes 1-7 = a fixed 7-byte template) and post the
 *     "bring player 2 in" task.
 *   NEITHER (0x00 while waiting, or 0x0C with both buttons held): do NOTHING and return —
 *     which is why this routine re-runs every frame from the credit until exactly one
 *     start button is seen.
 *
 * The shared tail then runs for both start arms: record the 1P/2P flag, wipe the
 * playfield + sprites, seed player 1's context (same lives + template layout), post
 * the "bring player 1 in" task, and END this sub-state machine — GAME_SUBSTATE = 0
 * and GAME_STATE = 3, which is the advance into gameplay.
 *
 * ACTIVE_PLAYER_INDEX and TWO_PLAYER_GAME are adjacent bytes the hardware writes as ONE
 * 16-bit store: the low byte is the active player (0 = player 1 up), the high byte the
 * two-player flag.
 *
 * LIVE-OUT: memory-only — the two player-context records, the active-player/two-player
 * pair, the cleared playfield and sprites, the two posted tasks, and the state and
 * sub-state advance.
 */

import {
  P1_CONTEXT,
  P2_CONTEXT,
  DIP_LIVES,
  GAME_STATE,
  GAME_SUBSTATE,
  TWO_PLAYER_GAME,
  ACTIVE_PLAYER_INDEX,
} from "./names.js";
import { readStartButtonSelector } from "./readStartButtonSelector.js";
import { spendCredit } from "./spendCredit.js";
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js";
import { enqueueTask } from "./enqueueTask.js";

// A player's saved context is an 8-byte record: byte 0 = starting lives, bytes 1-7 = a
// fixed template. CONTEXT_TEMPLATE is that 7-byte source, sitting in program memory
// immediately past this routine's own code, and it is copied into bytes 1-7 verbatim.
const CONTEXT_BYTES = 0x08;
const CONTEXT_TEMPLATE = 0x095e;
const CONTEXT_TEMPLATE_BYTES = 0x07;

// Deferred tasks posted to bring each player into play. The task queue takes a two-byte
// message — an opcode and an argument — and both arms use opcode 0x01 with the argument
// being the player index: the shared tail always posts player 0, and the 2-player arm
// additionally posts player 1. The opcode's handler lives elsewhere.
const START_TASK_P1 = 0x0100; // opcode 0x01, argument 0x00
const START_TASK_P2 = 0x0101; // opcode 0x01, argument 0x01

/**
 * Seed an 8-byte player context record at `base`: byte 0 = the DIP-configured starting
 * lives, bytes 1-7 = the fixed template.
 */
function seedPlayerContext(m, base) {
  const { mem } = m;
  mem.write8(base, mem.read8(DIP_LIVES));
  for (let i = 0; i < CONTEXT_TEMPLATE_BYTES; i++) {
    mem.write8(base + 1 + i, mem.read8(CONTEXT_TEMPLATE + i));
  }
}

export function commitGameStart(m) {
  const { regs, mem } = m;

  // Read the pressed start button: 0x04 = 1-player, 0x08 = 2-player, anything else
  // (0x00 none / 0x0C both) means keep waiting.
  readStartButtonSelector(m);
  const selector = regs.a;

  let twoPlayer;
  if (selector === 0x04) {
    // ---- 1-PLAYER start ----
    spendCredit(m); // one credit
    // No player 2: clear its saved context record.
    for (let i = 0; i < CONTEXT_BYTES; i++) mem.write8(P2_CONTEXT + i, 0x00);
    twoPlayer = false;
  } else if (selector === 0x08) {
    // ---- 2-PLAYER start ----
    spendCredit(m); // two credits, one per player
    spendCredit(m);
    seedPlayerContext(m, P2_CONTEXT); // seed player 2's fresh context
    regs.de = START_TASK_P2; // the queue reads the message from this register pair
    enqueueTask(m);
    twoPlayer = true;
  } else {
    // ---- no clean start yet (0x00 waiting, or 0x0C both buttons) — do nothing ----
    return;
  }

  // ---- shared start tail: runs for both the 1P and 2P arms ----
  // The hardware's single 16-bit store: low byte -> ACTIVE_PLAYER_INDEX (0 = player 1 up),
  // high byte -> TWO_PLAYER_GAME.
  mem.write8(ACTIVE_PLAYER_INDEX, 0x00);
  mem.write8(TWO_PLAYER_GAME, twoPlayer ? 0x01 : 0x00);
  clearPlayfieldAndSprites(m); // wipe the screen for the new scene
  seedPlayerContext(m, P1_CONTEXT); // seed player 1's fresh context
  regs.de = START_TASK_P1; // opcode 0x01, player 0
  enqueueTask(m);

  // End this sub-state machine and advance the game into gameplay.
  mem.write8(GAME_SUBSTATE, 0x00);
  mem.write8(GAME_STATE, 0x03);
}
