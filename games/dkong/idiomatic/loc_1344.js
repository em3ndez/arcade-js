// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1344 — an in-game sub-state handler: take a life off the current player, save the live
 * context into player 2's slot, then pick the next sub-state or run game-over.
 *
 * Silence sound; clear PLAY_INTRO (before the copy, so the saved context carries it clear);
 * decrement LIVES (byte 0 of the live 8-byte context) and copy that block into P2_CONTEXT; then
 * branch on the decremented lives: nonzero keeps playing (GAME_SUBSTATE 0x17, or 0x08 when
 * player 1 is also out), zero runs this player's game over (rank P2_SCORE, post two render
 * tasks, stamp a fixed tile block, arm SUBSTATE_TIMER to 0xC0, select GAME_SUBSTATE 0x11).
 *
 * The decrement is unguarded: entered with LIVES 0 it wraps to 0xFF (nonzero), taking the
 * still-playing arm.
 *
 * LIVE-OUT: memory-only.
 */

import { silenceSound } from "./silenceSound.js";
import { loc_13ca } from "./loc_13ca.js";
import { enqueueTask } from "./enqueueTask.js";
import { fillTileBlock } from "./fillTileBlock.js";
import {
  LIVES, // the live player-context block, byte 0
  PLAY_INTRO,
  P1_CONTEXT, // player 1's saved context; byte 0 is player 1's lives
  P2_CONTEXT, // player 2's saved context — the copy destination
  GAME_SUBSTATE,
  SUBSTATE_TIMER,
  P2_SCORE,
} from "./names.js";

const CONTEXT_BYTES = 8;
const BLOCK_FILL_TOPLEFT = 0x76d3;

export function loc_1344(m) {
  const { regs, mem8 } = m;

  silenceSound(m);

  mem8[PLAY_INTRO] = 0;

  // Clear PLAY_INTRO before this copy so the saved block carries the flag clear.
  const lives = (mem8[LIVES] - 1) & 0xff;
  mem8[LIVES] = lives;
  for (let i = 0; i < CONTEXT_BYTES; i++) {
    mem8[(P2_CONTEXT + i) & 0xffff] = mem8[(LIVES + i) & 0xffff];
  }

  if (lives !== 0) {
    // Still playing: 0x17 normally; 0x08 only when player 1 is also out of lives.
    mem8[GAME_SUBSTATE] = mem8[P1_CONTEXT] !== 0 ? 0x17 : 0x08;
    return;
  }

  // Lives exhausted — this player's game over.
  regs.a = 0x03;
  regs.hl = P2_SCORE;
  loc_13ca(m);

  regs.d = 0x03;
  regs.e = 0x03;
  enqueueTask(m);
  regs.d = 0x03;
  regs.e = 0x00;
  enqueueTask(m);

  regs.hl = BLOCK_FILL_TOPLEFT;
  fillTileBlock(m);

  mem8[SUBSTATE_TIMER] = 0xc0;
  mem8[GAME_SUBSTATE] = 0x11;
}
