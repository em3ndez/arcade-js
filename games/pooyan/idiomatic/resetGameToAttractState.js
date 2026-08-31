// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundCommand00 } from "./queueSoundCommand00.js";
import { u16 } from "../../../core/int.js";
import { zeroSpriteListAndActorArena } from "./zeroSpriteListAndActorArena.js";
import {
  GAME_ACTIVE_FLAG,
  PLAY_STATE_INDEX,
  ACTIVE_PLAYER,
  TWO_PLAYER_FLAG,
  ATTRACT_SUBSTATE,
  MAIN_GAME_STATE,
  FLIP_SCREEN_FLAG,
  LAUNCH_ARMED_FLAG,
  DISPLAY_MSG_BUF,
  ATTRACT_INIT_MESSAGE_SRC,
} from "./names.js";

// Sentinel that ends the packed attract-message source table (0x1e4c): the copy loop
// stops the instant it reads this raw byte, before any shift/store. It is checked as a
// literal 0x7f on the source byte, so it can never be confused with an unpacked tile code
// (every stored tile code is a source byte shifted right by one, i.e. at most 0x7f>>1).
const MSG_TERMINATOR = 0x7f; // sentinel ending the table

/**
 * resetGameToAttractState — cold return to the attract loop.
 *
 * WHAT IT IS
 *   The cold-teardown tail of the top-level play-state machine (ROM 0x1d3c-0x1d6d).
 *   When a game has fully ended and there are no credits left to continue, the round-end
 *   chain hands control here to wipe every trace of the finished game and put the machine
 *   back into its idle demo/attract state — the same state the cabinet sits in before a
 *   coin is inserted.
 *
 * ROLE IN THE MACHINE
 *   The machine's beat is driven by the top-level selector MAIN_GAME_STATE (0x8805):
 *   state 0 boot/attract entry, state 1 the attract sub-state machine, state 2 board
 *   build, state 3 live play, state 4 idle. A running game lives in state 3, whose
 *   handler dispatches on PLAY_STATE_INDEX (0x880a). This routine is the terminal branch
 *   of that dispatch: it is reached only when the player is out of lives AND no credit
 *   remains, so instead of reseeding another turn the machine is torn all the way down and
 *   MAIN_GAME_STATE is dropped to 1 — the demo/attract sub-state machine takes over.
 *
 * GROUNDING: [seen]
 *
 * LIVE-OUT: none — a teardown tail; every effect lands in memory (the state block, the
 *   fresh-start flags, the zeroed board RAM, the queued sound command, and the display
 *   message buffer). It returns nothing to its caller.
 */
export function resetGameToAttractState(m) {
  const { mem8 } = m;

  // Step 1 — zero the in-play state block. These five cells describe "a game is in
  // progress"; clearing them all to 0 is the machine forgetting the game that just ended.
  //   GAME_ACTIVE_FLAG (0x8806): the in-play gate — cleared so gameplay handlers now
  //     return early instead of updating the world.
  //   PLAY_STATE_INDEX (0x880a): the play sub-state index — reset so the play frame
  //     dispatch starts from the beginning next time state 3 is entered.
  //   ACTIVE_PLAYER (0x880d): selects the player-0 vs player-1 score/state banks —
  //     forced back to player 0.
  //   TWO_PLAYER_FLAG (0x880e): whether this was a two-player game — cleared so the next
  //     game starts single-player until a 2P start is pressed.
  //   ATTRACT_SUBSTATE (0x8e51): the demo-sequence sub-state selector — reset so the
  //     attract loop that is about to run starts from its first phase.
  mem8[GAME_ACTIVE_FLAG] = 0;
  mem8[PLAY_STATE_INDEX] = 0;
  mem8[ACTIVE_PLAYER] = 0;
  mem8[TWO_PLAYER_FLAG] = 0;
  mem8[ATTRACT_SUBSTATE] = 0;

  // Step 2 — seed the three fresh-start flags to 1. Where step 1 cleared "in a game",
  // this establishes "ready to attract".
  //   MAIN_GAME_STATE (0x8805) = 1: hand the top level to the attract sub-state machine
  //     — this is the write that actually returns the cabinet to its demo loop.
  //   FLIP_SCREEN_FLAG (0x881f) = 1: restore normal (upright) screen orientation; this
  //     value is mirrored to the flip-screen hardware latch each vblank.
  //   LAUNCH_ARMED_FLAG (0x8f3f) = 1: arm the arrow/formation launch one-shot so the
  //     demo's first attack sequence can fire.
  mem8[MAIN_GAME_STATE] = 1;
  mem8[FLIP_SCREEN_FLAG] = 1;
  mem8[LAUNCH_ARMED_FLAG] = 1;

  // Step 3 — wipe the board working RAM: the sprite display list and the whole
  // actor/object arena. This removes every actor, projectile, and sprite the finished
  // game left on screen so the attract demo starts on a clean field.
  zeroSpriteListAndActorArena(m); // zero the board RAM regions

  // Step 4 — post sound command 0 to the audio CPU (the "silence / reset" selector),
  // cutting off any sound the game was playing as it tears down.
  queueSoundCommand00(m); // post sound command 0

  // Step 5 — repaint the attract screen's text. The source is a packed ROM table at
  // ATTRACT_INIT_MESSAGE_SRC (0x1e4c) whose bytes carry each tile code shifted left by
  // one; the destination is the 7-cell display message buffer DISPLAY_MSG_BUF (0x89f0)
  // the renderer reads. Walk both pointers in lock-step, unpacking each source byte
  // (>> 1 to recover the tile code) into the buffer, until the raw 0x7f terminator ends
  // the table.
  let src = ATTRACT_INIT_MESSAGE_SRC;
  let dst = DISPLAY_MSG_BUF;
  for (;;) {
    const b = mem8[src];
    if (b === MSG_TERMINATOR) return; // terminator: nothing more to unpack
    mem8[dst] = b >> 1; // recover the tile code (source stores it shifted left by one)
    src = u16(src + 1); // advance the source pointer, wrapping in 16-bit address space
    dst = u16(dst + 1); // advance the destination pointer, likewise 16-bit-wrapped
  }
}
