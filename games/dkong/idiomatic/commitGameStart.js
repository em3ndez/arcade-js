// SPDX-License-Identifier: GPL-3.0-only
/**
 * commitGameStart — commit a credited game start: spend the credit(s), seed the
 * player context records, wipe the screen, and advance into gameplay.  ROM 0x08F8.
 *
 * Dispatched every frame while the machine is CREDITED (GAME_STATE == 2) and this
 * sub-state is selected (GAME_SUBSTATE == 1), as arm 1 of loc_08b2's rst-0x28 table.
 * It reads which start button is pressed (readStartButtonSelector returns the mask in
 * A: 0x04 = START1 / 1-player, 0x08 = START2 / 2-player) and dispatches:
 *
 *   1-PLAYER (A == 0x04): spend one credit, then CLEAR player 2's saved 8-byte
 *     context (no P2 this game). twoPlayer = false.
 *   2-PLAYER (A == 0x08): spend two credits (one per player), SEED player 2's context
 *     (byte 0 = starting lives from DIP_LIVES, bytes 1-7 = a fixed 7-byte ROM
 *     template), post the "bring player 2 in" task, then twoPlayer = true.
 *   NEITHER (A == 0x00 waiting, or 0x0C both buttons held): do NOTHING and return —
 *     which is why this routine re-runs every frame from the credit until exactly one
 *     start button is seen.
 *
 * The shared tail then runs for both start arms: record the 1P/2P flag, wipe the
 * playfield + sprites, seed player 1's context (same lives + template layout), post
 * the "bring player 1 in" task, and END this sub-state machine — GAME_SUBSTATE = 0
 * and GAME_STATE = 3 (advance into gameplay).
 *
 * Memory-equivalent to the frozen oracle — equivalence-08f8.test.js.
 * GATE:     crafted-entry (memory-equivalence). A coin+start1 tape reaches the NEITHER
 *           arm (33 credited-wait frames) and one real 1-PLAYER start; the 2-PLAYER
 *           and both-buttons arms are crafted from a real credited entry (CREDITS and
 *           the IN2 start bits poked identically on both sides). Teeth: two broken twins.
 * LIVE-OUT: memory-only. The caller (loc_08b2's rst-0x28 dispatch) consumes no register
 *           or flag — it makes no `ret cc` and branches on nothing this routine sets — so
 *           the oracle's residual A/DE/HL/F are dead ABI, not reproduced. SP/pc are the
 *           dropped stack model: this routine leaves both at entry (the JS call stack
 *           replaces the Z80 one); the oracle's callee-balanced push/call/ret plus its own
 *           final `ret` move SP/pc, but every stack byte sits in the dead STACK_SCRATCH.
 * NAMES:    P1_CONTEXT (0x6040), P2_CONTEXT (0x6048), DIP_LIVES (0x6020),
 *           GAME_STATE (0x6005), GAME_SUBSTATE (0x600A), TWO_PLAYER_GAME (0x600F),
 *           ACTIVE_PLAYER_INDEX (0x600E) from names.js — the 16-bit `ld (0x600E),hl` at
 *           game start writes ACTIVE_PLAYER_INDEX (low byte, 0 = player 1 up) and
 *           TWO_PLAYER_GAME (high byte) in one store. Hex-kept: CONTEXT_TEMPLATE (0x095E,
 *           the 7-byte ROM template, read twice — it is ROM data adjacent to this routine,
 *           not work RAM); the two start-task message words (opcode 0x01, arg = player index).
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
import { readStartButtonSelector } from "./readStartButtonSelector.js"; // ROM 0x08D5
import { spendCredit } from "./spendCredit.js"; //                         ROM 0x0977
import { clearPlayfieldAndSprites } from "./clearPlayfieldAndSprites.js"; // ROM 0x0874
import { enqueueTask } from "./enqueueTask.js"; //                         ROM 0x309F

// A player's saved context is an 8-byte record: byte 0 = starting lives, bytes 1-7 = a
// fixed template. CONTEXT_TEMPLATE is the 7-byte source in ROM (immediately past this
// routine's code at 0x095D); the oracle copies it into bytes 1-7 with an `ldir`.
const CONTEXT_BYTES = 0x08;
const CONTEXT_TEMPLATE = 0x095e;
const CONTEXT_TEMPLATE_BYTES = 0x07;

// Deferred tasks posted to bring each player into play. enqueueTask reads the message
// from the Z80 D/E pair (D = opcode, E = argument): both arms use opcode 0x01 with the
// argument being the player index — the tail always posts player 0 (P1), the 2-player
// arm additionally posts player 1 (P2). Kept hex: the opcode's handler is outside here.
const START_TASK_P1 = 0x0100; // D = 0x01, E = 0x00
const START_TASK_P2 = 0x0101; // D = 0x01, E = 0x01

/**
 * Seed an 8-byte player context record at `base`: byte 0 = the DIP-configured starting
 * lives, bytes 1-7 = the fixed ROM template. (The oracle's `ld (de),a` + `ldir`.)
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

  // Read the pressed start button (returned in A): 0x04 = 1-player, 0x08 = 2-player,
  // anything else (0x00 none / 0x0C both) means keep waiting.
  readStartButtonSelector(m); // ROM 0x08D5
  const selector = regs.a;

  let twoPlayer;
  if (selector === 0x04) {
    // ---- 1-PLAYER start ----
    spendCredit(m); // ROM 0x0977 — one credit
    // No player 2: clear its saved context record.
    for (let i = 0; i < CONTEXT_BYTES; i++) mem.write8(P2_CONTEXT + i, 0x00);
    twoPlayer = false;
  } else if (selector === 0x08) {
    // ---- 2-PLAYER start ----
    spendCredit(m); // ROM 0x0977 — two credits, one per player
    spendCredit(m);
    seedPlayerContext(m, P2_CONTEXT); // seed player 2's fresh context
    regs.de = START_TASK_P2; // enqueueTask reads D/E — opcode 0x01, player 1 (P2)
    enqueueTask(m); // ROM 0x309F
    twoPlayer = true;
  } else {
    // ---- no clean start yet (0x00 waiting, or 0x0C both buttons) — do nothing ----
    return;
  }

  // ---- shared start tail (ROM 0x0938): runs for both the 1P and 2P arms ----
  // The oracle's `ld (0x600E),hl` store: low byte -> ACTIVE_PLAYER_INDEX (0 = player 1 up),
  // high byte -> TWO_PLAYER_GAME.
  mem.write8(ACTIVE_PLAYER_INDEX, 0x00);
  mem.write8(TWO_PLAYER_GAME, twoPlayer ? 0x01 : 0x00);
  clearPlayfieldAndSprites(m); // ROM 0x0874 — wipe the screen for the new scene
  seedPlayerContext(m, P1_CONTEXT); // seed player 1's fresh context
  regs.de = START_TASK_P1; // opcode 0x01, player 0 (P1)
  enqueueTask(m); // ROM 0x309F

  // End this sub-state machine and advance the game into gameplay.
  mem.write8(GAME_SUBSTATE, 0x00); // 0x600A = 0
  mem.write8(GAME_STATE, 0x03); //    0x6005 = 3
}
