// SPDX-License-Identifier: GPL-3.0-only
import {
  TWO_PLAYER_FLAG,
  PLAYER1_LIVES,
  ACTIVE_PLAYER,
  SPEED_INDEX,
  PLAYER0_STATE_BANK,
  PLAY_STATE_INDEX,
} from "./names.js";
/**
 * saveLivePageToPlayer0Bank — freeze the live actor/state page into player 0's saved bank
 * and, in a two-player game, hand the turn to player 1.
 *
 * ROM 0x1bab-0x1bcb. [seen]. The live page is block-copied into player 0's saved bank; byte0
 * of each record (sprite colour, sourced from a zero cell) stays 0.
 *
 * ROLE. Pooyan keeps one LIVE page of per-actor and per-round state at SPEED_INDEX (0x8900) —
 * the working copy the game engine reads and writes every frame — plus a saved BANK per player
 * (player 0 at 0x8940, player 1 at 0x8980). When a turn ends the live page must be parked in
 * the outgoing player's bank so it can be reloaded when that player plays again. This routine
 * is the specialised "park into player 0" case: it always copies to the player-0 bank, and it
 * exists on the path where the machine is about to switch the active player over to player 1.
 *
 * The turn-hand-off is conditional: only when this is a two-player game (TWO_PLAYER_FLAG,
 * 0x880e, nonzero) AND player 1 still has lives left (PLAYER1_LIVES, 0x8988, nonzero) does it
 * latch ACTIVE_PLAYER (0x880d) to 1 — bank/score selection elsewhere reads that latch to route
 * to player 1's banks. If player 1 is out of lives (or the game is one-player) the latch is
 * left alone and the copy still happens.
 *
 * The copied span is 0x3f (63) bytes — the whole live page short of its final byte.
 *
 * A pure leaf: it touches only these cells and calls nothing.
 *
 * LIVE-OUT: memory-only — the 0x3f-byte player-0 bank at 0x8940, the (conditional) active-player
 * latch at 0x880d, and PLAY_STATE_INDEX (0x880a) cleared to 0. No register or flag is returned.
 */

// SPEED_INDEX (0x8900) is byte 0 of the live actor/state page; this alias names the page as the
// copy SOURCE so the loop below reads clearly as "live page -> saved bank".
const LIVE_PAGE = SPEED_INDEX;
// 0x3f (63) bytes — the length the ROM's ldir moves (bc = 0x003f) from 0x8900..0x893e.
const BANK_SIZE = 0x3f;

export function saveLivePageToPlayer0Bank(m) {
  const { mem8 } = m;

  // Hand the turn to player 1, but only in a two-player game (TWO_PLAYER_FLAG, 0x880e) whose
  // player 1 is still alive (PLAYER1_LIVES, 0x8988). Setting ACTIVE_PLAYER (0x880d) = 1 makes
  // subsequent bank/score selection route to player 1. If either test fails the latch is left
  // as it was.
  if (mem8[TWO_PLAYER_FLAG] !== 0 && mem8[PLAYER1_LIVES] !== 0) {
    mem8[ACTIVE_PLAYER] = 1;
  }

  // Block-copy the live page (0x8900) into player 0's saved bank (0x8940). This is the ROM's
  // ldir: 63 bytes, 0x8900..0x893e -> 0x8940..0x897e, parking the outgoing state so it can be
  // restored when player 0 next takes a turn.
  for (let i = 0; i < BANK_SIZE; i++) {
    mem8[PLAYER0_STATE_BANK + i] = mem8[LIVE_PAGE + i];
  }

  // Reset the in-play sub-state index (PLAY_STATE_INDEX, 0x880a) to 0 so the incoming turn's
  // state machine restarts from its first phase rather than resuming the parked player's phase.
  mem8[PLAY_STATE_INDEX] = 0;
}
