// SPDX-License-Identifier: GPL-3.0-only
import { fillByteRun } from "./fillByteRun.js";
import { armTileFillFromPlayfieldBase } from "./armTileFillFromPlayfieldBase.js";
import { clearActorsAndEnterContinueState } from "./clearActorsAndEnterContinueState.js";
import { stampSecondScrollColumn } from "./stampSecondScrollColumn.js";
import {
  PLAYER1_LIVES,
  PLAY_STATE_INDEX,
  PLAYER0_STATE_BANK,
  ACTIVE_PLAYER,
} from "./names.js";
/**
 * reseedOtherPlayerForTurn -- hand the turn to the other player at round-end.
 *
 * WHAT IT IS
 *   The turn-hand-off tail of the in-play sub-state dispatch machinery. Pooyan runs one or two
 *   players out of a single live round page, and the in-play sub-state index (PLAY_STATE_INDEX,
 *   0x880a) walks a fixed sequence of round/intro/teardown handlers. This is one branch of the
 *   round-end/player-swap logic that fires once a round has finished tearing down.
 *
 * ROLE IN THE MACHINE
 *   Reached when the active player (player 0) has just used up their turn but player 1 is still
 *   in the game. It hands the turn over to player 1: restart the sub-state sequence, wipe the
 *   outgoing player's saved bank, mark player 1 as the active player, re-arm the display fill,
 *   and continue into the shared board-reseed body so player 1's round paints in fresh. If
 *   player 1 has no lives either, there is nobody to hand off to, so it diverts to the
 *   full-clear/continue path instead.
 *
 *   The two players share one live state page at SPEED_INDEX (0x8900); each player also has a
 *   saved bank a fixed distance above it (player 0 at PLAYER0_STATE_BANK 0x8940, player 1 at
 *   0x8980), holding that player's paused actor/state block and their remaining lives at bank+8.
 *   ACTIVE_PLAYER (0x880d) selects whose banks and scores the round logic addresses, so the
 *   round code can stay oblivious to which player is running.
 *
 * ROM: 0x1cf6-0x1d0c.
 * Grounding: [seen]
 *
 * LIVE-OUT (what it leaves in memory before the shared reseed body runs):
 *   PLAY_STATE_INDEX (0x880a)   = 0      -- sub-state sequence restarted for the new turn
 *   PLAYER0_STATE_BANK (0x8940) = 0x3f zero bytes -- outgoing player 0's saved bank wiped
 *   ACTIVE_PLAYER (0x880d)      = 1      -- player 1 is now the live player
 *   plus the row-by-row tile fill re-armed from the fixed VRAM start.
 */

const BANK_LEN = 0x3f;

export function reseedOtherPlayerForTurn(m) {
  // mem8 is the machine's main RAM as a flat byte array; all the 0x88xx work bytes live here.
  const { mem8 } = m;

  // No one to hand off to? PLAYER1_LIVES (0x8988) is player 1's remaining-lives countdown; when
  // it is zero both players are exhausted, so there is no turn to pass. Divert to the full-clear
  // tail (clearActorsAndEnterContinueState, 0x1d15), which tears the round down and either offers
  // a continue or drops back to attract. (ROM 0x1cf6: ld a,(0x8988); and a; jr z,0x1d15.)
  if (mem8[PLAYER1_LIVES] === 0) return clearActorsAndEnterContinueState(m);

  // Restart the sub-state sequence. Clearing the in-play sub-state index (PLAY_STATE_INDEX,
  // 0x880a) to 0 rewinds the dispatch so the incoming player begins from the fresh round intro.
  // (ROM 0x1cfc: xor a; ld (0x880a),a.)
  mem8[PLAY_STATE_INDEX] = 0;

  // Wipe the outgoing player's saved bank. Player 0 has just finished their turn and is being
  // displaced, so their 0x3f-byte saved state block at PLAYER0_STATE_BANK (0x8940) is zero-filled
  // to clear it out before the board reseeds for the new turn. (ROM 0x1d00: ld hl,0x8940;
  // ld b,0x3f; rst 0x10 with fill constant 0.)
  fillByteRun(m, PLAYER0_STATE_BANK, 0, BANK_LEN); // zero-fill player zero's state bank

  // Make player 1 the live player. ACTIVE_PLAYER (0x880d) selects whose banks/score/lives the
  // round logic addresses; bit 0 set = player 1. The value comes for free: the byte-run fill
  // above left the accumulator holding its zero fill constant, so the machine reaches 1 with a
  // single increment rather than a fresh load. (ROM 0x1d06: inc a; ld (0x880d),a.)
  mem8[ACTIVE_PLAYER] = 1; // the fill leaves A zero -> increment is one

  // Re-arm the display fill. This resets the row-by-row tilemap fill to the fixed VRAM start
  // (playfield base 0x8402) so the incoming player's board intro paints from the top row down.
  // (ROM 0x1d0a: call 0x02e3.)
  armTileFillFromPlayfieldBase(m); // reset the display pointer

  // Continue into the shared reseed body (stampSecondScrollColumn, 0x1d0d), which stamps the
  // three tiles of the second scroll column, finishing the board reseed for player 1's turn.
  // (ROM 0x1d0c falls through into 0x1d0d.)
  return stampSecondScrollColumn(m);
}
