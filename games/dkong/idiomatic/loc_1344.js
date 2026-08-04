// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1344 — one in-game sub-state handler: take a life off the current player, save the live
 * context into player 2's slot, then either pick the next sub-state or run this player's
 * game-over sequence.
 *
 * In order:
 *   1. Silence every sound output, for the transition.
 *   2. Clear PLAY_INTRO — before the copy below, so the saved context carries it clear.
 *   3. Decrement LIVES, the first byte of the live eight-byte player-context block, and copy
 *      that whole block — decremented lives and cleared intro flag included — into P2_CONTEXT.
 *   4. Branch on the DECREMENTED lives:
 *      - lives != 0, still playing: GAME_SUBSTATE := 0x17, except in the one case where the
 *        OTHER player is out as well (the first byte of P1_CONTEXT, player 1's saved lives,
 *        is 0), which selects 0x08 instead.
 *      - lives == 0, this player's game over: rank the finished P2_SCORE, post two render
 *        tasks, stamp a fixed 5×14 tile block, arm SUBSTATE_TIMER to 0xC0, and select
 *        GAME_SUBSTATE 0x11.
 *
 * The decrement is unguarded. Entered with LIVES already 0 it wraps to 0xFF, which is
 * non-zero, so that entry takes the still-playing arm rather than game over.
 *
 * The routine reads no incoming register — every value is loaded fresh — so its inputs are
 * the memory it reads, and it writes memory only.
 *
 * The name is kept address-shaped deliberately. The mechanism is settled, but the
 * game-semantic identity of this handler — whether "player 2" here is a player index or a
 * context-slot index, and what the 0x17-versus-0x08 choice means — is one reader's inference
 * from this body, with nothing in the file able to confirm it.
 *
 * Reads: LIVES and the seven bytes after it; the first byte of P1_CONTEXT.
 * Writes: PLAY_INTRO; LIVES; the eight bytes of P2_CONTEXT; GAME_SUBSTATE; and on the
 * game-over arm SUBSTATE_TIMER, plus whatever the score rank, the two tasks and the tile fill
 * stamp between them.
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

const CONTEXT_BYTES = 8; // the live context block, LIVES first
const BLOCK_FILL_TOPLEFT = 0x76d3; // top-left tilemap cell of the game-over block fill

export function loc_1344(m) {
  const { regs, mem } = m;

  // 1. Silence sound for the transition.
  silenceSound(m);

  // 2. Clear the play-intro flag.
  mem.write8(PLAY_INTRO, 0);

  // 3. Decrement LIVES, then copy the 8-byte live context block — now holding the
  //    decremented lives and the zeroed PLAY_INTRO — into P2_CONTEXT. The order matters:
  //    the flag is cleared BEFORE the block is read out.
  const lives = (mem.read8(LIVES) - 1) & 0xff;
  mem.write8(LIVES, lives);
  for (let i = 0; i < CONTEXT_BYTES; i++) {
    mem.write8((P2_CONTEXT + i) & 0xffff, mem.read8((LIVES + i) & 0xffff));
  }

  // 4. Branch on the decremented lives.
  if (lives !== 0) {
    // Still playing: 0x17 normally; 0x08 only when player 1 is also out of lives.
    mem.write8(GAME_SUBSTATE, mem.read8(P1_CONTEXT) !== 0 ? 0x17 : 0x08);
    return;
  }

  // Lives exhausted — this player's game over.
  // Rank the finished score, with the player-2 selector.
  regs.a = 0x03;
  regs.hl = P2_SCORE;
  loc_13ca(m);

  // Post the two game-over render tasks: opcode 3 with arg 3, then opcode 3 with arg 0.
  regs.d = 0x03;
  regs.e = 0x03;
  enqueueTask(m);
  regs.d = 0x03;
  regs.e = 0x00;
  enqueueTask(m);

  // Stamp the fixed 5x14 tile block.
  regs.hl = BLOCK_FILL_TOPLEFT;
  fillTileBlock(m);

  // Arm the sub-state countdown and select the next sub-state.
  mem.write8(SUBSTATE_TIMER, 0xc0);
  mem.write8(GAME_SUBSTATE, 0x11);
}
